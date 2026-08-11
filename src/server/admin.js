import { Router } from "express";
import { db, usersCol, auditLogCol, flagsCol, tasksCol, locationsCol } from "../db/index.js";
import { requireAuth, requireRoles } from "./auth.js";

const adminRouter = Router();

// 1. Submit a Flag (accessible by any authenticated user)
adminRouter.post("/flags", requireAuth, async (req, res) => {
  const reporter = req.user;
  const { targetType, targetId, reason } = req.body;

  if (!targetType || !targetId || !reason) {
    return res.status(400).json({ error: "Missing required flag parameters (targetType, targetId, reason)." });
  }

  if (!["user", "task"].includes(targetType)) {
    return res.status(400).json({ error: "Invalid targetType. Must be 'user' or 'task'." });
  }

  try {
    const flagRef = flagsCol.doc();
    const flagId = flagRef.id;
    const newFlag = {
      id: flagId,
      reporterId: reporter.id,
      targetType,
      targetId: String(targetId),
      reason,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    await flagRef.set(newFlag);

    const logRef = auditLogCol.doc();
    await logRef.set({
      id: logRef.id,
      entityType: "flag",
      entityId: String(flagId),
      actorId: reporter.id,
      oldState: null,
      newState: "pending",
      timestamp: new Date().toISOString()
    });

    res.status(201).json({ message: "Content flagged successfully for admin review.", flag: newFlag });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Admin: List pending verification users (Admin only)
adminRouter.get("/pending-users", requireAuth, requireRoles(["admin"]), async (req, res) => {
  try {
    const snapshot = await usersCol.where("verificationStatus", "==", "pending").get();
    const pendingUsers = snapshot.docs.map(doc => doc.data());
    pendingUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ users: pendingUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Admin: Approve/Reject user accounts with 24h SLA warning check
adminRouter.post("/users/:id/verify", requireAuth, requireRoles(["admin"]), async (req, res) => {
  const adminActor = req.user;
  const targetId = req.params.id;
  const { decision } = req.body; // "approved" or "rejected"

  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'." });
  }

  try {
    const userDoc = await usersCol.doc(targetId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found." });
    }

    const targetUser = userDoc.data();

    // SLA Check: Log a warning if pending verification exceeds 24 hours
    if (targetUser.createdAt) {
      const pendingDurationMs = Date.now() - new Date(targetUser.createdAt).getTime();
      if (pendingDurationMs > 24 * 60 * 60 * 1000) {
        console.warn(`[SLA WARNING] User verification SLA breached! User ${targetId} (${targetUser.name}) was registered at ${targetUser.createdAt} and remained pending for ${Math.round(pendingDurationMs / (1000 * 60 * 60))} hours, exceeding the 24h SLA limits.`);
      }
    }

    await usersCol.doc(targetId).update({ verificationStatus: decision });
    const updated = { ...targetUser, verificationStatus: decision };

    const logRef = auditLogCol.doc();
    await logRef.set({
      id: logRef.id,
      entityType: "user",
      entityId: targetId,
      actorId: adminActor.id,
      oldState: targetUser.verificationStatus,
      newState: decision,
      timestamp: new Date().toISOString()
    });

    res.json({ message: `User account has been successfully ${decision}.`, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Admin: Suspend or ban user accounts (Admin only)
adminRouter.post("/users/:id/suspend", requireAuth, requireRoles(["admin"]), async (req, res) => {
  const adminActor = req.user;
  const targetId = req.params.id;
  const { action } = req.body; // "suspend" or "approved"

  if (!["suspend", "approved"].includes(action)) {
    return res.status(400).json({ error: "Action must be 'suspend' or 'approved'." });
  }

  const newStatus = action === "suspend" ? "suspended" : "approved";

  try {
    const userDoc = await usersCol.doc(targetId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found." });
    }

    const targetUser = userDoc.data();
    await usersCol.doc(targetId).update({ verificationStatus: newStatus });
    const updated = { ...targetUser, verificationStatus: newStatus };

    if (newStatus === "suspended") {
      const activeTasksSnap = await tasksCol
        .where("residentId", "==", targetId)
        .get();

      const batch = db.batch();
      activeTasksSnap.docs.forEach((doc) => {
        const taskData = doc.data();
        if (taskData.status === "Pending" || taskData.status === "Assigned") {
          batch.update(doc.ref, { status: "Cancelled" });
        }
      });
      await batch.commit();
    }

    const logRef = auditLogCol.doc();
    await logRef.set({
      id: logRef.id,
      entityType: "user",
      entityId: targetId,
      actorId: adminActor.id,
      oldState: targetUser.verificationStatus,
      newState: newStatus,
      timestamp: new Date().toISOString()
    });

    res.json({ message: `User status updated to ${newStatus}.`, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Admin: List and manage moderation flags
adminRouter.get("/flags", requireAuth, requireRoles(["admin"]), async (req, res) => {
  try {
    const snapshot = await flagsCol.get();
    const flagPromises = snapshot.docs.map(async (doc) => {
      const flagData = doc.data();
      let reporterName = "Unknown";
      if (flagData.reporterId) {
        const repDoc = await usersCol.doc(flagData.reporterId).get();
        if (repDoc.exists) {
          reporterName = repDoc.data().name || reporterName;
        }
      }
      return {
        flag: flagData,
        reporterName
      };
    });

    const list = await Promise.all(flagPromises);
    list.sort((a, b) => new Date(b.flag.createdAt).getTime() - new Date(a.flag.createdAt).getTime());
    res.json({ flags: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Admin: Assign owner to flag
adminRouter.post("/flags/:id/assign", requireAuth, requireRoles(["admin"]), async (req, res) => {
  const adminActor = req.user;
  const flagId = req.params.id;
  const { adminOwnerId } = req.body;

  try {
    const flagDoc = await flagsCol.doc(String(flagId)).get();
    if (!flagDoc.exists) {
      return res.status(404).json({ error: "Flag not found." });
    }

    const existingFlag = flagDoc.data();
    if (existingFlag.createdAt) {
      const flagAgeMs = Date.now() - new Date(existingFlag.createdAt).getTime();
      if (flagAgeMs > 48 * 60 * 60 * 1000) {
        console.warn(`[SLA WARNING] Flag dispute SLA breached! Flag ${flagId} has remained unresolved/unassigned for ${Math.round(flagAgeMs / (1000 * 60 * 60))} hours, exceeding the 48h dispute SLA.`);
      }
    }

    const assignedId = adminOwnerId || adminActor.id;
    await flagsCol.doc(String(flagId)).update({ adminOwnerId: assignedId });
    const updated = { ...existingFlag, adminOwnerId: assignedId };

    res.json({ message: "Admin assigned to flag successfully.", flag: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Admin: Resolve a flag
adminRouter.post("/flags/:id/resolve", requireAuth, requireRoles(["admin"]), async (req, res) => {
  const adminActor = req.user;
  const flagId = req.params.id;

  try {
    const flagDoc = await flagsCol.doc(String(flagId)).get();
    if (!flagDoc.exists) {
      return res.status(404).json({ error: "Flag not found." });
    }

    const existingFlag = flagDoc.data();
    await flagsCol.doc(String(flagId)).update({ status: "resolved" });
    const updated = { ...existingFlag, status: "resolved" };

    const logRef = auditLogCol.doc();
    await logRef.set({
      id: logRef.id,
      entityType: "flag",
      entityId: String(flagId),
      actorId: adminActor.id,
      oldState: "pending",
      newState: "resolved",
      timestamp: new Date().toISOString()
    });

    res.json({ message: "Flag resolved successfully.", flag: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Admin: Searchable Audit Logs View
adminRouter.get("/audit-log", requireAuth, requireRoles(["admin"]), async (req, res) => {
  const search = (req.query.search || "").toLowerCase();

  try {
    const snapshot = await auditLogCol.get();
    const logPromises = snapshot.docs.map(async (doc) => {
      const log = doc.data();
      let actorName = null;
      if (log.actorId) {
        const actorDoc = await usersCol.doc(log.actorId).get();
        if (actorDoc.exists) actorName = actorDoc.data().name;
      }
      return { log, actorName };
    });

    let logs = await Promise.all(logPromises);

    if (search) {
      logs = logs.filter(item => {
        const typeMatch = item.log.entityType?.toLowerCase().includes(search);
        const stateMatch = item.log.newState?.toLowerCase().includes(search);
        const nameMatch = item.actorName?.toLowerCase().includes(search);
        return typeMatch || stateMatch || nameMatch;
      });
    }

    logs.sort((a, b) => new Date(b.log.timestamp).getTime() - new Date(a.log.timestamp).getTime());
    res.json({ auditLogs: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Admin: DPDP Act 2023 Data Erasure Endpoint
adminRouter.post("/users/:id/erasure", requireAuth, requireRoles(["admin"]), async (req, res) => {
  const adminActor = req.user;
  const targetId = req.params.id;

  try {
    const userDoc = await usersCol.doc(targetId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found." });
    }

    const targetUser = userDoc.data();

    if (targetUser.locationId) {
      await locationsCol.doc(String(targetUser.locationId)).delete().catch(() => {});
    }

    await usersCol.doc(targetId).update({
      name: "[ANONYMIZED USER]",
      email: `anonymized-${Date.now()}@example.com`,
      photoUrl: null,
      phoneMaskedId: null,
      verificationStatus: "erased"
    });

    const logRef = auditLogCol.doc();
    await logRef.set({
      id: logRef.id,
      entityType: "user",
      entityId: targetId,
      actorId: adminActor.id,
      oldState: targetUser.verificationStatus,
      newState: "erased_dpdp_compliance",
      timestamp: new Date().toISOString()
    });

    res.json({ message: "DPDP Act 2023 Compliance: User PII has been successfully deleted/anonymized from our records." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default adminRouter;