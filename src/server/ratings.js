import { Router } from "express";
import { db, ratingsCol, tasksCol, usersCol, locationsCol, taskClaimsCol } from "../db/index.js";
import { requireAuth } from "./auth.js";

const ratingsRouter = Router();

// 1. Submit a rating
ratingsRouter.post("/", requireAuth, async (req, res) => {
  const rater = req.user;
  const { taskId, score, comment } = req.body;

  if (!taskId || !score) {
    return res.status(400).json({ error: "Missing required rating parameters (taskId, score)." });
  }

  const scoreNum = parseInt(score);
  if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 5) {
    return res.status(400).json({ error: "Score must be an integer between 1 and 5." });
  }

  try {
    const taskDoc = await tasksCol.doc(String(taskId)).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: "Task not found." });
    }

    const taskRecord = taskDoc.data();
    if (taskRecord.status !== "Completed") {
      return res.status(400).json({ error: "You can only rate completed tasks." });
    }

    const claimsSnap = await taskClaimsCol.where("taskId", "==", String(taskId)).get();

    if (claimsSnap.empty) {
      return res.status(400).json({ error: "Task claim record not found." });
    }

    const claim = claimsSnap.docs[0].data();

    let rateeId = "";
    if (rater.id === taskRecord.residentId) {
      rateeId = claim.volunteerId;
    } else if (rater.id === claim.volunteerId) {
      rateeId = taskRecord.residentId;
    } else {
      return res.status(403).json({ error: "You are not authorized to rate this task." });
    }

    // Check duplicate rating
    const existingRatings = await ratingsCol
      .where("taskId", "==", String(taskId))
      .where("raterId", "==", rater.id)
      .get();

    if (!existingRatings.empty) {
      return res.status(400).json({ error: "Duplicate Rating: You have already submitted a rating for this task." });
    }

    const ratingRef = ratingsCol.doc();
    const newRating = {
      id: ratingRef.id,
      taskId: String(taskId),
      raterId: rater.id,
      rateeId,
      score: scoreNum,
      comment: comment || null,
      createdAt: new Date().toISOString()
    };

    await ratingRef.set(newRating);

    // Recalculate average rating for ratee
    const allRateeSnap = await ratingsCol.where("rateeId", "==", rateeId).get();
    const allRatings = allRateeSnap.docs.map(d => d.data());
    const totalScore = allRatings.reduce((sum, r) => sum + r.score, 0);
    const avgScore = allRatings.length > 0 ? totalScore / allRatings.length : null;

    await usersCol.doc(rateeId).update({ ratingAvg: avgScore });

    res.status(201).json({ message: "Rating submitted successfully!", rating: newRating });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Profile setup & updates
ratingsRouter.put("/profile", requireAuth, async (req, res) => {
  const user = req.user;
  const { name, skillTags, radiusPreference, latitude, longitude } = req.body;

  try {
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (skillTags && Array.isArray(skillTags)) updatePayload.skillTags = skillTags;

    let locData = user.location || null;
    let locationId = user.locationId;

    if (locationId && (radiusPreference !== undefined || latitude !== undefined || longitude !== undefined)) {
      const locRef = locationsCol.doc(String(locationId));
      const locDoc = await locRef.get();
      const currentLoc = locDoc.exists ? locDoc.data() : { id: String(locationId) };

      locData = {
        ...currentLoc,
        ...(radiusPreference !== undefined ? { radiusPreference: parseFloat(radiusPreference) } : {}),
        ...(latitude !== undefined ? { latitude: parseFloat(latitude) } : {}),
        ...(longitude !== undefined ? { longitude: parseFloat(longitude) } : {})
      };

      await locRef.set(locData, { merge: true });
      updatePayload.location = locData;
    } else if (!locationId && latitude !== undefined && longitude !== undefined) {
      const locRef = locationsCol.doc();
      locationId = locRef.id;
      locData = {
        id: locationId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusPreference: radiusPreference ? parseFloat(radiusPreference) : null
      };

      await locRef.set(locData);
      updatePayload.locationId = locationId;
      updatePayload.location = locData;
    }

    if (Object.keys(updatePayload).length > 0) {
      await usersCol.doc(user.id).update(updatePayload);
    }

    const updatedUserDoc = await usersCol.doc(user.id).get();
    const updatedUser = updatedUserDoc.data();

    res.json({ message: "Profile updated successfully.", user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default ratingsRouter;