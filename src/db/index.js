import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// Initialize the Firebase Admin App
if (!getApps().length) {
  let certConfig = null;
  let projectId = process.env.FIREBASE_PROJECT_ID;

  // Try finding service-account.json
  const possiblePaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), "service-account.json"),
    path.resolve(process.cwd(), "..", "service-account.json"),
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const sa = JSON.parse(fs.readFileSync(p, "utf8"));
        certConfig = cert(sa);
        if (!projectId && sa.project_id) {
          projectId = sa.project_id;
        }
        break;
      } catch (err) {
        console.warn("Could not parse service account file at:", p);
      }
    }
  }

  const options = {};
  if (certConfig) {
    options.credential = certConfig;
  }
  if (projectId) {
    options.projectId = projectId;
  }

  initializeApp(options);
}

export const db = getFirestore();

// Export Collection References
export const usersCol = db.collection("users");
export const tasksCol = db.collection("tasks");
export const taskClaimsCol = db.collection("task_claims");
export const auditLogCol = db.collection("audit_log");
export const ratingsCol = db.collection("ratings");
export const flagsCol = db.collection("flags");
export const locationsCol = db.collection("locations");
export const chatMessagesCol = db.collection("chat_messages");

// Export Types
export { Timestamp, FieldValue };