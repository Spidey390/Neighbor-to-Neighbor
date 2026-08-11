import "dotenv/config";
import { db, usersCol, tasksCol, auditLogCol, locationsCol } from "./index.js";

async function seed() {
  console.log("Seeding Firestore database...");

  // 1. Create a Location
  const locRef = locationsCol.doc("loc-1");
  const locationData = {
    id: "loc-1",
    latitude: 37.7749,
    longitude: -122.4194,
    radiusPreference: 10
  };
  await locRef.set(locationData);

  // 2. Create Sandbox Users
  const users = [
    {
      id: "admin-1",
      phoneNumber: "1234567890",
      name: "Admin Control",
      role: "admin",
      verificationStatus: "approved",
      locationId: "loc-1",
      location: locationData,
      createdAt: new Date().toISOString()
    },
    {
      id: "resident-1",
      phoneNumber: "+91 90000 00001",
      name: "Jane Doe",
      role: "resident",
      verificationStatus: "approved",
      locationId: "loc-1",
      location: locationData,
      createdAt: new Date().toISOString()
    },
    {
      id: "volunteer-1",
      phoneNumber: "+91 90000 00002",
      name: "Alice Green",
      role: "volunteer",
      verificationStatus: "approved",
      locationId: "loc-1",
      location: locationData,
      skillTags: ["Plumbing", "Groceries", "Moving"],
      createdAt: new Date().toISOString()
    }
  ];

  for (const user of users) {
    await usersCol.doc(user.id).set(user, { merge: true });
  }

  // 3. Create initial tasks
  const task1Data = {
    id: "task-1",
    residentId: "resident-1",
    category: "Groceries",
    requiredSkillCategory: "Groceries",
    description: "Need help picking up groceries from Trader Joe's.",
    urgency: "Medium",
    status: "Pending",
    locationId: "loc-1",
    location: locationData,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  };

  const task2Data = {
    id: "task-2",
    residentId: "resident-1",
    category: "Home Repair",
    requiredSkillCategory: "Plumbing",
    description: "Leaky faucet in the kitchen.",
    urgency: "High",
    status: "Assigned",
    locationId: "loc-1",
    location: locationData,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  };

  await tasksCol.doc("task-1").set(task1Data, { merge: true });
  await tasksCol.doc("task-2").set(task2Data, { merge: true });

  // 4. Create Audit Logs
  await auditLogCol.doc("log-1").set({
    id: "log-1",
    entityType: "user",
    entityId: "volunteer-1",
    actorId: "admin-1",
    oldState: "pending",
    newState: "approved",
    timestamp: new Date().toISOString()
  });

  await auditLogCol.doc("log-2").set({
    id: "log-2",
    entityType: "task",
    entityId: "task-1",
    actorId: "resident-1",
    oldState: null,
    newState: "Pending",
    timestamp: new Date().toISOString()
  });

  console.log("Firestore database seeding completed successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
