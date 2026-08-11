import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { db, tasksCol, taskClaimsCol, auditLogCol } from "./src/db/index.js";

// Import custom routers
import authRouter from "./src/server/auth.js";
import tasksRouter from "./src/server/tasks.js";
import adminRouter from "./src/server/admin.js";
import ratingsRouter from "./src/server/ratings.js";
import chatRouter from "./src/server/chat.js";
import { communicationProvider, notificationProvider } from "./src/server/providers.js";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Create HTTP server and attach Socket.IO
  const httpServer = createHttpServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"]
  });

  app.use(express.json({ limit: "1mb" }));

  // API Route mountings
  app.use("/api/auth", authRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/ratings", ratingsRouter);
  app.use("/api/chat", chatRouter);

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ================================================
  // Socket.IO — WebRTC Signaling & Real-time Chat
  // ================================================
  const onlineUsers = new Map(); // userId -> socketId

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // User registers their userId on connect
    socket.on("register", ({ userId }) => {
      if (userId) {
        onlineUsers.set(userId, socket.id);
        console.log(`[Socket.IO] User registered: ${userId} -> ${socket.id}`);
      }
    });

    // Join a task room (for scoped chat and calls)
    socket.on("join-task", ({ taskId }) => {
      if (taskId) {
        const roomName = `task-${taskId}`;
        socket.join(roomName);
        const room = io.sockets.adapter.rooms.get(roomName);
        const roomSize = room ? room.size : 0;
        console.log(`[Socket.IO] ${socket.id} joined room ${roomName} (${roomSize} members now)`);
      }
    });

    // Leave a task room
    socket.on("leave-task", ({ taskId }) => {
      if (taskId) {
        socket.leave(`task-${taskId}`);
        console.log(`[Socket.IO] ${socket.id} left room task-${taskId}`);
      }
    });

    // ---- WebRTC Signaling ----

    // Call offer: caller sends offer to the other participant in the task room
    socket.on("call-offer", ({ taskId, offer, callerId, callerName, mode }) => {
      const roomName = `task-${taskId}`;
      const room = io.sockets.adapter.rooms.get(roomName);
      const roomSize = room ? room.size : 0;
      const roomMembers = room ? [...room] : [];
      console.log(`[Socket.IO] Call offer from ${callerName} (${callerId}) in task ${taskId}`);
      console.log(`[Socket.IO]   Room "${roomName}" has ${roomSize} members: [${roomMembers.join(", ")}]`);
      console.log(`[Socket.IO]   Sender socket: ${socket.id} — broadcasting to ${roomSize - 1} other(s)`);

      socket.to(roomName).emit(`call-offer-${taskId}`, {
        offer,
        callerId,
        callerName,
        mode
      });
    });

    // Call answer: callee sends answer back
    socket.on("call-answer", ({ taskId, answer, answererId }) => {
      socket.to(`task-${taskId}`).emit(`call-answer-${taskId}`, { answer });
      console.log(`[Socket.IO] Call answer from ${answererId} in task ${taskId}`);
    });

    // ICE candidate exchange
    socket.on("ice-candidate", ({ taskId, candidate, senderId }) => {
      socket.to(`task-${taskId}`).emit(`ice-candidate-${taskId}`, { candidate });
    });

    // Call end
    socket.on("call-end", ({ taskId, senderId }) => {
      socket.to(`task-${taskId}`).emit(`call-end-${taskId}`, { senderId });
      console.log(`[Socket.IO] Call ended in task ${taskId}`);
    });

    // Chat message: broadcast to task room
    socket.on("chat-message", ({ taskId, message }) => {
      console.log(`[Socket.IO] Chat message sent in task-${taskId}:`, message?.text);
      io.to(`task-${taskId}`).emit(`chat-message-${taskId}`, message);
      io.to(`task-${taskId}`).emit("chat-message", { taskId, message });
    });

    // Typing indicator
    socket.on("typing", ({ taskId, senderId }) => {
      socket.to(`task-${taskId}`).emit(`typing-${taskId}`, { senderId });
    });

    // Real-time task release & redirect event
    socket.on("task-released", ({ taskId }) => {
      console.log(`[Socket.IO] Task released by volunteer, redirecting: task-${taskId}`);
      io.emit("task-released", { taskId });
      io.to(`task-${taskId}`).emit(`task-released-${taskId}`, { taskId });
    });

    // Real-time task claimed event
    socket.on("task-claimed", ({ taskId }) => {
      console.log(`[Socket.IO] Task claimed by volunteer: task-${taskId}`);
      io.emit("task-claimed", { taskId });
      io.to(`task-${taskId}`).emit(`task-claimed-${taskId}`, { taskId });
    });

    // Disconnect cleanup
    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          console.log(`[Socket.IO] User disconnected: ${userId}`);
          break;
        }
      }
    });
  });

  // Background Jobs: Run every 30 seconds
  setInterval(async () => {
    try {
      const nowIso = new Date().toISOString();

      // 1. Task Auto-Expiry Job
      const pendingTasksSnap = await tasksCol.where("status", "==", "Pending").get();
      for (const doc of pendingTasksSnap.docs) {
        const t = doc.data();
        if (t.expiresAt && t.expiresAt < nowIso) {
          await doc.ref.update({ status: "Expired" });

          const logRef = auditLogCol.doc();
          await logRef.set({
            id: logRef.id,
            entityType: "task",
            entityId: String(t.id),
            actorId: null,
            oldState: "Pending",
            newState: "Expired",
            timestamp: nowIso
          });

          console.log(`[Job] Task ${t.id} has expired.`);
        }
      }

      // 2. Task Auto-Release Job (Assigned > 2 hours with no completion)
      const twoHoursAgoIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const activeClaimsSnap = await taskClaimsCol.where("releasedAt", "==", null).get();

      for (const claimDoc of activeClaimsSnap.docs) {
        const claim = claimDoc.data();
        if (claim.claimedAt && claim.claimedAt < twoHoursAgoIso) {
          const taskDoc = await tasksCol.doc(String(claim.taskId)).get();
          if (taskDoc.exists) {
            const task = taskDoc.data();
            if (task.status === "Assigned") {
              const taskId = task.id;
              const volunteerId = claim.volunteerId;
              const residentId = task.residentId;

              await tasksCol.doc(String(taskId)).update({ status: "Pending" });
              await claimDoc.ref.update({ releasedAt: nowIso });

              await communicationProvider.disableMaskedChannel(taskId);

              const logRef = auditLogCol.doc();
              await logRef.set({
                id: logRef.id,
                entityType: "task",
                entityId: String(taskId),
                actorId: null,
                oldState: "Assigned",
                newState: "Pending",
                timestamp: nowIso
              });

              await notificationProvider.sendNotification(
                volunteerId,
                "Assigned Task Released",
                `The task "${task.category}" was auto-released back to Pending due to inactivity exceeding the 2 hours limit.`
              );

              await notificationProvider.sendNotification(
                residentId,
                "Request Re-listed",
                `Your request for "${task.category}" was auto-released and re-listed as Pending because there was no action from the assigned volunteer.`
              );

              console.log(`[Job] Task ${taskId} claimed by ${volunteerId} was auto-released due to 2h timeout.`);
            }
          }
        }
      }
    } catch (err) {
      console.error("[Job Error] Background scheduler failed:", err);
    }
  }, 30000); // 30 seconds cycle

  // Serve static files in production, use Vite middleware in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Use httpServer.listen instead of app.listen for Socket.IO
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Socket.IO ready for WebRTC signaling & real-time chat`);
  });
}

startServer();
