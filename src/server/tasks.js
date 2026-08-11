import { Router } from "express";
import { db, tasksCol, usersCol, locationsCol, taskClaimsCol, auditLogCol } from "../db/index.js";
import { requireAuth, requireRoles } from "./auth.js";
import { communicationProvider, notificationProvider } from "./providers.js";

const tasksRouter = Router();

// Helper to calculate distance in km using Haversine formula
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper to reduce coordinates precision to ~111m (3 decimal places)
function roundLocation(lat, lon) {
  return {
    latitude: Math.round(lat * 1000) / 1000,
    longitude: Math.round(lon * 1000) / 1000
  };
}

// 1. Post a request (Resident role only)
tasksRouter.post("/", requireAuth, requireRoles(["resident"]), async (req, res) => {
  const resident = req.user;

  if (resident.verificationStatus !== "approved") {
    return res.status(403).json({ error: "Your account is pending verification. You cannot post requests yet." });
  }

  const { category, description, urgency } = req.body;

  if (!category || !description || !urgency) {
    return res.status(400).json({ error: "Missing required task fields (category, description, urgency)." });
  }

  if (!["Low", "Medium", "High"].includes(urgency)) {
    return res.status(400).json({ error: "Invalid urgency level." });
  }

  try {
    // Fetch all tasks for this resident to evaluate rate limits in-memory
    // This avoids requiring Firestore composite indexes
    const userTasksSnap = await tasksCol
      .where("residentId", "==", resident.id)
      .get();

    let pendingCount = 0;
    let recentCount = 0;
    const oneDayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    userTasksSnap.forEach((doc) => {
      const data = doc.data();
      if (data.status === "Pending") pendingCount++;
      if (data.createdAt && data.createdAt > oneDayAgoIso) recentCount++;
    });

    if (pendingCount >= 5) {
      return res.status(429).json({ error: "Abuse Prevention: You cannot have more than 5 concurrent Pending requests." });
    }

    if (recentCount >= 10) {
      await usersCol.doc(resident.id).update({ verificationStatus: "pending" });

      const logRef = auditLogCol.doc();
      await logRef.set({
        id: logRef.id,
        entityType: "user",
        entityId: resident.id,
        actorId: resident.id,
        oldState: "approved",
        newState: "flagged_suspended_rate_limit",
        timestamp: new Date().toISOString()
      });

      return res.status(429).json({
        error: "Abuse Prevention: Task creation rate limit exceeded. Your account has been flagged for admin review."
      });
    }

    let taskLocation = resident.location;
    let locationId = resident.locationId;

    if (!taskLocation && locationId) {
      const locDoc = await locationsCol.doc(String(locationId)).get();
      if (locDoc.exists) {
        taskLocation = locDoc.data();
      }
    }

    if (!taskLocation) {
      return res.status(400).json({ error: "Your profile is missing a location. Please update your profile location." });
    }

    const taskRef = tasksCol.doc();
    const taskId = taskRef.id;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    const newTask = {
      id: taskId,
      residentId: resident.id,
      category,
      requiredSkillCategory: category,
      description,
      urgency,
      status: "Pending",
      locationId: String(locationId || "loc-1"),
      location: taskLocation,
      createdAt,
      expiresAt
    };

    await taskRef.set(newTask);

    const logRef = auditLogCol.doc();
    await logRef.set({
      id: logRef.id,
      entityType: "task",
      entityId: String(taskId),
      actorId: resident.id,
      oldState: null,
      newState: "Pending",
      timestamp: createdAt
    });

    res.status(201).json({ task: newTask });
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

// 2. Localized Task Feed (Volunteer role only)
tasksRouter.get("/feed", requireAuth, requireRoles(["volunteer", "admin"]), async (req, res) => {
  const volunteer = req.user;

  if (volunteer.role === "volunteer" && volunteer.verificationStatus !== "approved") {
    return res.status(403).json({ error: "Your volunteer account is pending verification. Access to feed is restricted." });
  }

  try {
    let volunteerLoc = volunteer.location;
    if (!volunteerLoc && volunteer.locationId) {
      const locDoc = await locationsCol.doc(String(volunteer.locationId)).get();
      if (locDoc.exists) volunteerLoc = locDoc.data();
    }

    if (!volunteerLoc) {
      return res.status(400).json({ error: "Volunteer profile is missing a location." });
    }

    const radiusLimit = volunteerLoc.radiusPreference || 10;
    const nowIso = new Date().toISOString();

    const activeTasksSnap = await tasksCol.where("status", "==", "Pending").get();

    const feedPromises = activeTasksSnap.docs.map(async (doc) => {
      const task = doc.data();
      if (task.expiresAt && task.expiresAt <= nowIso) return null;

      let taskLoc = task.location;
      if (!taskLoc && task.locationId) {
        const lDoc = await locationsCol.doc(String(task.locationId)).get();
        if (lDoc.exists) taskLoc = lDoc.data();
      }

      if (!taskLoc) return null;

      let residentName = "Neighbor";
      let residentRatingAvg = null;
      if (task.residentId) {
        const resDoc = await usersCol.doc(task.residentId).get();
        if (resDoc.exists) {
          const resData = resDoc.data();
          residentName = resData.name || residentName;
          residentRatingAvg = resData.ratingAvg ?? null;
        }
      }

      const distance = getDistanceKm(
        volunteerLoc.latitude,
        volunteerLoc.longitude,
        taskLoc.latitude,
        taskLoc.longitude
      );

      const roundedLoc = roundLocation(taskLoc.latitude, taskLoc.longitude);
      const isSkillMatch = volunteer.skillTags?.includes(task.requiredSkillCategory) || false;

      return {
        id: task.id,
        category: task.category,
        requiredSkillCategory: task.requiredSkillCategory,
        description: task.description,
        urgency: task.urgency,
        status: task.status,
        createdAt: task.createdAt,
        expiresAt: task.expiresAt,
        distance: Math.round(distance * 100) / 100,
        latitude: roundedLoc.latitude,
        longitude: roundedLoc.longitude,
        residentName,
        residentRatingAvg,
        isSkillMatch
      };
    });

    const feedResults = await Promise.all(feedPromises);
    const feed = feedResults
      .filter((item) => item !== null && item.distance <= radiusLimit)
      .sort((a, b) => {
        if (a.isSkillMatch && !b.isSkillMatch) return -1;
        if (!a.isSkillMatch && b.isSkillMatch) return 1;
        if (Math.abs(a.distance - b.distance) > 0.5) {
          return a.distance - b.distance;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    res.json({ feed });
  } catch (err) {
    console.error("Error loading task feed:", err);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

// 3. Claim Task (Volunteer only)
tasksRouter.post("/:id/claim", requireAuth, requireRoles(["volunteer"]), async (req, res) => {
  const volunteer = req.user;
  const taskId = req.params.id;

  if (volunteer.verificationStatus !== "approved") {
    return res.status(403).json({ error: "Your account is pending verification. You cannot claim tasks." });
  }

  try {
    let updatedTask;
    let maskedChannel;

    await db.runTransaction(async (transaction) => {
      const taskRef = tasksCol.doc(String(taskId));
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        throw new Error("Task not found");
      }

      const taskData = taskDoc.data();
      if (taskData.status !== "Pending") {
        throw new Error("Task is already claimed, completed, or cancelled");
      }

      updatedTask = { ...taskData, status: "Assigned" };
      transaction.update(taskRef, { status: "Assigned" });

      const claimRef = taskClaimsCol.doc();
      const claimData = {
        id: claimRef.id,
        taskId: String(taskId),
        volunteerId: volunteer.id,
        claimedAt: new Date().toISOString(),
        releasedAt: null
      };
      transaction.set(claimRef, claimData);

      const logRef = auditLogCol.doc();
      transaction.set(logRef, {
        id: logRef.id,
        entityType: "task",
        entityId: String(taskId),
        actorId: volunteer.id,
        oldState: "Pending",
        newState: "Assigned",
        timestamp: new Date().toISOString()
      });
    });

    maskedChannel = await communicationProvider.createMaskedChannel(taskId, updatedTask.residentId, volunteer.id);

    await notificationProvider.sendNotification(
      updatedTask.residentId,
      "Task Claimed",
      `Your neighbor ${volunteer.name} has claimed your request: "${updatedTask.category}".`
    );

    res.json({
      message: "Task claimed successfully!",
      task: updatedTask,
      maskedChannel
    });
  } catch (err) {
    console.error("Claim error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// 3b. Release / Unclaim Task (Volunteer Emergency Cancellation)
tasksRouter.post("/:id/release", requireAuth, requireRoles(["volunteer"]), async (req, res) => {
  const volunteer = req.user;
  const taskId = req.params.id;

  try {
    const taskDoc = await tasksCol.doc(String(taskId)).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: "Task not found" });
    }

    const taskData = taskDoc.data();
    if (taskData.status !== "Assigned") {
      return res.status(400).json({ error: "Task is not currently assigned." });
    }

    // Find active claim doc
    const claimsSnap = await taskClaimsCol
      .where("taskId", "==", String(taskId))
      .get();

    const activeClaimDoc = claimsSnap.docs.find((d) => {
      const c = d.data();
      return c && !c.releasedAt && String(c.volunteerId) === String(volunteer.id);
    });

    if (!activeClaimDoc && taskData.volunteerId !== volunteer.id) {
      return res.status(403).json({ error: "You are not authorized to release this task." });
    }

    const nowIso = new Date().toISOString();

    if (activeClaimDoc) {
      await taskClaimsCol.doc(activeClaimDoc.id).update({
        releasedAt: nowIso,
        status: "released"
      });
    }

    // Revert task status back to Pending
    const updatedTask = { ...taskData, status: "Pending", volunteerId: null };
    await tasksCol.doc(String(taskId)).update({
      status: "Pending",
      volunteerId: null
    });

    // Disable masked channel
    await communicationProvider.disableMaskedChannel(taskId).catch(() => {});

    // Audit log
    const logRef = auditLogCol.doc();
    await logRef.set({
      id: logRef.id,
      entityType: "task",
      entityId: String(taskId),
      actorId: volunteer.id,
      oldState: "Assigned",
      newState: "Pending_Released",
      timestamp: nowIso
    });

    // Notify resident
    await notificationProvider.sendNotification(
      taskData.residentId,
      "Task Re-Opened",
      `Your volunteer had an emergency and released your request: "${taskData.category}". It has been redirected to nearby volunteers.`
    ).catch(() => {});

    res.json({
      message: "Task claim released. Request redirected back to surrounding volunteers.",
      task: updatedTask
    });
  } catch (err) {
    console.error("Release claim error:", err.message);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

// 4. Complete Task (Volunteer or Resident)
tasksRouter.post("/:id/complete", requireAuth, async (req, res) => {
  const actor = req.user;
  const taskId = req.params.id;

  try {
    const taskDoc = await tasksCol.doc(String(taskId)).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: "Task not found" });
    }

    const taskRecord = taskDoc.data();
    if (taskRecord.status !== "Assigned") {
      return res.status(400).json({ error: "Only Assigned tasks can be completed." });
    }

    const claimsSnap = await taskClaimsCol
      .where("taskId", "==", String(taskId))
      .where("releasedAt", "==", null)
      .get();

    if (claimsSnap.empty) {
      return res.status(400).json({ error: "No active volunteer claim found for this task." });
    }

    const activeClaim = claimsSnap.docs[0].data();
    const isResident = taskRecord.residentId === actor.id;
    const isVolunteer = activeClaim.volunteerId === actor.id;

    if (!isResident && !isVolunteer && actor.role !== "admin") {
      return res.status(403).json({ error: "You are not authorized to complete this task." });
    }

    await tasksCol.doc(String(taskId)).update({ status: "Completed" });
    await communicationProvider.disableMaskedChannel(taskId);

    const logRef = auditLogCol.doc();
    await logRef.set({
      id: logRef.id,
      entityType: "task",
      entityId: String(taskId),
      actorId: actor.id,
      oldState: "Assigned",
      newState: "Completed",
      timestamp: new Date().toISOString()
    });

    const notifyId = isResident ? activeClaim.volunteerId : taskRecord.residentId;
    await notificationProvider.sendNotification(
      notifyId,
      "Task Completed",
      `The task "${taskRecord.category}" has been marked as completed.`
    );

    res.json({ message: "Task marked as Completed successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Cancel Task (Resident or Admin)
tasksRouter.post("/:id/cancel", requireAuth, async (req, res) => {
  const actor = req.user;
  const taskId = req.params.id;

  try {
    const taskDoc = await tasksCol.doc(String(taskId)).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: "Task not found" });
    }

    const taskRecord = taskDoc.data();
    if (taskRecord.status !== "Pending" && taskRecord.status !== "Assigned") {
      return res.status(400).json({ error: "Can only cancel tasks in Pending or Assigned states." });
    }

    if (taskRecord.residentId !== actor.id && actor.role !== "admin") {
      return res.status(403).json({ error: "You are not authorized to cancel this task." });
    }

    const oldState = taskRecord.status;
    await tasksCol.doc(String(taskId)).update({ status: "Cancelled" });

    if (oldState === "Assigned") {
      await communicationProvider.disableMaskedChannel(taskId);

      const claimsSnap = await taskClaimsCol
        .where("taskId", "==", String(taskId))
        .where("releasedAt", "==", null)
        .get();

      if (!claimsSnap.empty) {
        const claim = claimsSnap.docs[0].data();
        await notificationProvider.sendNotification(
          claim.volunteerId,
          "Task Cancelled",
          `The request "${taskRecord.category}" has been cancelled by the resident.`
        );
      }
    }

    const logRef = auditLogCol.doc();
    await logRef.set({
      id: logRef.id,
      entityType: "task",
      entityId: String(taskId),
      actorId: actor.id,
      oldState,
      newState: "Cancelled",
      timestamp: new Date().toISOString()
    });

    res.json({ message: "Task cancelled successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get resident requests list or volunteer assigned tasks list
tasksRouter.get("/my-tasks", requireAuth, async (req, res) => {
  const user = req.user;

  try {
    if (user.role === "resident") {
      const snap = await tasksCol.where("residentId", "==", user.id).get();
      const taskList = snap.docs.map(d => d.data());

      const formattedPromises = taskList.map(async (task) => {
        let volunteerName = null;
        let volunteerRatingAvg = null;

        const claimsSnap = await taskClaimsCol
          .where("taskId", "==", String(task.id))
          .where("releasedAt", "==", null)
          .get();

        if (!claimsSnap.empty) {
          const claim = claimsSnap.docs[0].data();
          const volDoc = await usersCol.doc(claim.volunteerId).get();
          if (volDoc.exists) {
            const volData = volDoc.data();
            volunteerName = volData.name;
            volunteerRatingAvg = volData.ratingAvg;
          }
        }

        return {
          ...task,
          volunteerName,
          volunteerRatingAvg,
          maskedChannel: task.status === "Assigned" ? { proxyPhone: `+1 (555) 019-1234` } : null
        };
      });

      const formatted = await Promise.all(formattedPromises);
      formatted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ tasks: formatted });
    } else if (user.role === "volunteer") {
      const claimsSnap = await taskClaimsCol
        .where("volunteerId", "==", user.id)
        .where("releasedAt", "==", null)
        .get();

      const claims = claimsSnap.docs.map(d => d.data());

      const taskPromises = claims.map(async (claim) => {
        const taskDoc = await tasksCol.doc(String(claim.taskId)).get();
        if (!taskDoc.exists) return null;
        const task = taskDoc.data();

        let residentName = "Resident";
        let residentRatingAvg = null;

        if (task.residentId) {
          const resDoc = await usersCol.doc(task.residentId).get();
          if (resDoc.exists) {
            const resData = resDoc.data();
            residentName = resData.name;
            residentRatingAvg = resData.ratingAvg;
          }
        }

        let taskLoc = task.location;
        if (!taskLoc && task.locationId) {
          const locDoc = await locationsCol.doc(String(task.locationId)).get();
          if (locDoc.exists) taskLoc = locDoc.data();
        }

        return {
          ...task,
          residentName,
          residentRatingAvg,
          latitude: taskLoc?.latitude ?? null,
          longitude: taskLoc?.longitude ?? null,
          maskedChannel: task.status === "Assigned" ? { proxyPhone: `+1 (555) 019-1234` } : null,
          claimedAt: claim.claimedAt
        };
      });

      const results = (await Promise.all(taskPromises)).filter(Boolean);
      results.sort((a, b) => new Date(b.claimedAt || b.createdAt).getTime() - new Date(a.claimedAt || a.createdAt).getTime());
      res.json({ tasks: results });
    } else {
      const snap = await tasksCol.get();
      const allTasks = snap.docs.map(d => d.data());
      allTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ tasks: allTasks });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default tasksRouter;