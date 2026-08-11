import { Router } from "express";
import { chatMessagesCol, tasksCol, taskClaimsCol } from "../db/index.js";
import { requireAuth } from "./auth.js";

const chatRouter = Router();

// Helper: Verify user is participant of this task (resident or assigned volunteer)
async function verifyTaskParticipant(taskId, userId) {
  if (!taskId || !userId) {
    return { error: "Invalid task or user ID", status: 400 };
  }

  const taskDoc = await tasksCol.doc(String(taskId)).get();
  if (!taskDoc.exists) return { error: "Task not found", status: 404 };

  const task = taskDoc.data();
  if (!task) return { error: "Task data invalid", status: 404 };

  // Check if user is the resident
  if (task.residentId && String(task.residentId) === String(userId)) {
    return { task, role: "resident" };
  }

  // Fallback: Check direct volunteerId property on task if present
  if (task.volunteerId && String(task.volunteerId) === String(userId)) {
    return { task, role: "volunteer" };
  }

  // Check if user is the assigned volunteer via claims collection
  try {
    const claimsSnap = await taskClaimsCol
      .where("taskId", "==", String(taskId))
      .get();

    if (!claimsSnap.empty) {
      const activeClaim = claimsSnap.docs
        .map((doc) => doc.data())
        .find((c) => c && !c.releasedAt && c.volunteerId && String(c.volunteerId) === String(userId));

      if (activeClaim) {
        return { task, role: "volunteer" };
      }
    }
  } catch (claimErr) {
    console.error("Error querying taskClaimsCol:", claimErr);
  }

  return { error: "You are not a participant in this task", status: 403 };
}

// GET /api/chat/:taskId/messages — Fetch chat history
chatRouter.get("/:taskId/messages", requireAuth, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const verification = await verifyTaskParticipant(taskId, userId);
    if (verification.error) {
      return res.status(verification.status || 403).json({ error: verification.error });
    }

    const messagesSnap = await chatMessagesCol
      .where("taskId", "==", String(taskId))
      .get();

    const messages = (messagesSnap.docs || [])
      .map((doc) => doc.data())
      .filter((m) => m && (m.id || m.text))
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });

    return res.json({ messages });
  } catch (err) {
    console.error("Error fetching chat messages:", err);
    return res.status(500).json({ error: "Internal server error: " + (err.message || String(err)) });
  }
});

// POST /api/chat/:taskId/messages — Send a message
chatRouter.post("/:taskId/messages", requireAuth, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user?.id;
  const { text } = req.body;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Message text is required" });
  }

  try {
    const verification = await verifyTaskParticipant(taskId, userId);
    if (verification.error) {
      return res.status(verification.status || 403).json({ error: verification.error });
    }

    const msgRef = chatMessagesCol.doc();
    const message = {
      id: msgRef.id,
      taskId: String(taskId),
      senderId: userId,
      senderName: req.user.name || "Unknown",
      senderRole: verification.role,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    await msgRef.set(message);
    return res.status(201).json({ message });
  } catch (err) {
    console.error("Error sending chat message:", err);
    return res.status(500).json({ error: "Internal server error: " + (err.message || String(err)) });
  }
});

export default chatRouter;
