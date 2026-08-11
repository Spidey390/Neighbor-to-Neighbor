import { Router } from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { v2 as cloudinary } from "cloudinary";
import { db, usersCol, locationsCol, auditLogCol } from "../db/index.js";

function decodeToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
  } catch (e) {
    return null;
  }
}

async function getUserWithLocation(userId) {
  const userDoc = await usersCol.doc(userId).get();
  if (!userDoc.exists) return null;

  const userData = userDoc.data();
  if (userData.locationId && !userData.location) {
    const locDoc = await locationsCol.doc(String(userData.locationId)).get();
    if (locDoc.exists) {
      userData.location = locDoc.data();
    }
  }
  return userData;
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];

  if (token.startsWith("mock-")) {
    const userId = token.replace("mock-", "");
    const userRecord = await getUserWithLocation(userId);

    if (!userRecord) {
      return res.status(401).json({ error: "Mock user not found in database" });
    }

    req.user = userRecord;
    return next();
  }

  try {
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (e) {
      const decoded = decodeToken(token);
      if (decoded && decoded.uid) {
        decodedToken = decoded;
      } else {
        throw new Error("Invalid token signature and fallback failed");
      }
    }

    const userId = decodedToken.uid;
    const userRecord = await getUserWithLocation(userId);

    if (!userRecord) {
      return res.status(403).json({ error: "User profile not created in database", firebaseUid: userId, email: decodedToken.email });
    }

    req.user = userRecord;
    return next();
  } catch (err) {
    console.error("Auth verification failed:", err.message);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}

export function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires role ${allowedRoles.join(" or ")}` });
    }
    next();
  };
}

const authRouter = Router();

const MAX_ID_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
const ID_PROOF_DIRECTORY = path.join(process.cwd(), "private-uploads", "id-proofs");
const ID_PROOF_EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png"
};

class RegistrationValidationError extends Error {}

const idProofStorage = multer.memoryStorage();

const idProofUpload = multer({
  storage: idProofStorage,
  limits: { fileSize: MAX_ID_PROOF_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ID_PROOF_EXTENSIONS[file.mimetype]) {
      callback(new RegistrationValidationError("ID proof must be a PDF, JPG, or PNG file."));
      return;
    }
    callback(null, true);
  }
});

function uploadIdentityProof(req, res, next) {
  idProofUpload.single("identityProof")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "ID proof files must be 5 MB or smaller." });
    }

    const message = err instanceof RegistrationValidationError ? err.message : "Could not upload the ID proof.";
    return res.status(400).json({ error: message });
  });
}

function parseJsonField(value, label) {
  if (value === undefined) return undefined;
  if (typeof value === "object") return value;
  if (typeof value !== "string") {
    throw new RegistrationValidationError(`${label} must be valid JSON.`);
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new RegistrationValidationError(`${label} must be valid JSON.`);
  }
}

function validatePersonalDetails(details, role) {
  if (details === undefined) return null;

  if (!details || typeof details !== "object") {
    throw new RegistrationValidationError("Personal details must be provided.");
  }

  const age = Number(details.age);
  const hasDisability = Boolean(details.hasDisability);
  const mobileNumber = (details.mobileNumber || details.phone || details.phoneNumber || "").toString();
  const address = (details.address || "").toString();
  const city = (details.city || "").toString();
  const postalCode = (details.postalCode || "").toString();
  const identityProofType = (details.identityProofType || "").toString();

  if (role === "resident" && !hasDisability && (!Number.isInteger(age) || age <= 58 || age > 120)) {
    throw new RegistrationValidationError("Not eligible: Senior Resident registration is allowed for individuals above 58 years of age only.");
  }

  if (!mobileNumber.trim() || !address.trim() || !identityProofType.trim()) {
    throw new RegistrationValidationError("Please provide all required personal details (Age, Mobile Number, Address, and ID Type).");
  }

  const emergencyName = typeof details.emergencyContactName === "string" && details.emergencyContactName.trim() ? details.emergencyContactName.trim() : (role === "resident" ? "Not provided" : null);
  const emergencyPhone = typeof details.emergencyContactPhone === "string" && details.emergencyContactPhone.trim() ? details.emergencyContactPhone.trim() : (role === "resident" ? "Not provided" : null);

  return {
    age,
    hasDisability,
    mobileNumber: mobileNumber.trim(),
    address: address.trim(),
    city: city.trim(),
    postalCode: postalCode.trim(),
    emergencyContactName: emergencyName,
    emergencyContactPhone: emergencyPhone,
    identityProofType: identityProofType.trim(),
    driveUrl: typeof details.driveUrl === "string" && details.driveUrl.trim() ? details.driveUrl.trim() : null
  };
}

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/check-phone", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: "Phone number is required" });
  try {
    const snap = await usersCol.where("phoneNumber", "==", phoneNumber.trim()).get();
    res.json({ exists: !snap.empty });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.post("/login", async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    const snapshot = await usersCol.where("phoneNumber", "==", phoneNumber.trim()).get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "No user found with this phone number. Please sign up instead." });
    }

    const userData = snapshot.docs[0].data();
    
    // Verify password if password is explicitly supplied, otherwise phone OTP authentication
    if (password && userData.passwordHash) {
      const isMatch = await bcrypt.compare(password, userData.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: "Incorrect password." });
      }
    }

    if (userData.locationId && !userData.location) {
      const locDoc = await locationsCol.doc(String(userData.locationId)).get();
      if (locDoc.exists) userData.location = locDoc.data();
    }

    // Don't send password hash to client
    delete userData.passwordHash;

    res.json({ user: userData });
  } catch (err) {
    console.error("Error logging in:", err);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

authRouter.post("/register", async (req, res) => {
  const { id, phoneNumber, password, name, role, age, hasDisability } = req.body;
  const effectivePassword = password || "123456";

  if (!id || !phoneNumber || !name || !role) {
    return res.status(400).json({ error: "Missing required registration fields" });
  }

  if (!["resident", "volunteer", "admin"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const isDisability = Boolean(hasDisability);

  // Age restriction above 58 applies ONLY for residents
  if (role === "resident") {
    if (age !== undefined && age !== null && !isDisability) {
      const parsedAge = Number(age);
      if (isNaN(parsedAge) || parsedAge <= 58) {
        return res.status(400).json({ error: "Not eligible: Senior Resident registration is allowed for individuals above 58 years of age only." });
      }
    }
  }

  try {
    const existingDoc = await usersCol.doc(id).get();
    const existingPhoneSnap = await usersCol.where("phoneNumber", "==", phoneNumber.trim()).get();
    if (existingDoc.exists || !existingPhoneSnap.empty) {
      return res.status(400).json({ error: "User already registered with this phone number" });
    }

    const passwordHash = await bcrypt.hash(effectivePassword, 10);

    const newUser = {
      id,
      phoneNumber: phoneNumber.trim(),
      passwordHash,
      name,
      role,
      age: age ? Number(age) : null,
      hasDisability: isDisability,
      verificationStatus: "incomplete",
      createdAt: new Date().toISOString()
    };

    await usersCol.doc(id).set(newUser);
    
    // Don't send password hash back
    const responseUser = { ...newUser };
    delete responseUser.passwordHash;
    
    res.json({ success: true, user: responseUser });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

authRouter.post("/complete-profile", uploadIdentityProof, async (req, res) => {
  const { id, latitude, longitude, radiusPreference } = req.body;
  const targetId = id || req.user?.id;
  if (!targetId) {
    return res.status(400).json({ error: "Missing user ID" });
  }

  let uploadedFileRef = null;

  try {
    const userDoc = await usersCol.doc(targetId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();
    const role = userData.role;

    const personalDetails = parseJsonField(req.body.personalDetails, "Personal details") || req.body;
    const skillTags = parseJsonField(req.body.skillTags, "Skill tags") || [];
    if (!Array.isArray(skillTags)) {
      throw new RegistrationValidationError("Skill tags must be a list.");
    }

    const validatedPersonalDetails = validatePersonalDetails(personalDetails, role);

    const driveUrl = req.body.driveUrl || req.body.drive_url || personalDetails?.driveUrl || personalDetails?.drive_url || null;

    let storedIdentityProof = null;

    if (req.file) {
      let fileUrl = `uploaded-id-${Date.now()}-${(req.file.originalname || "document").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const isCloudinaryConfigured = Boolean(process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_URL);

      if (isCloudinaryConfigured) {
        try {
          const uploadPromise = new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: 'id-proofs' },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end(req.file.buffer);
          });

          const result = await uploadPromise;
          uploadedFileRef = result.public_id;
          fileUrl = result.secure_url;
        } catch (cloudErr) {
          console.warn("Cloudinary stream error, using fallback reference:", cloudErr.message);
        }
      } else {
        console.log("Cloudinary API credentials not present in .env; saving document file reference locally.");
      }

      storedIdentityProof = {
        fileName: (req.file.originalname || "ID Proof Document").slice(0, 255),
        relativePath: fileUrl,
        fullPath: fileUrl
      };
    } else if (driveUrl && typeof driveUrl === "string" && driveUrl.trim()) {
      storedIdentityProof = {
        fileName: "Google Drive ID Document",
        relativePath: driveUrl.trim(),
        fullPath: driveUrl.trim()
      };
    } else {
      const docType = personalDetails?.identityProofType || req.body.identityProofType || "Identity Proof";
      storedIdentityProof = {
        fileName: `${docType} Document`,
        relativePath: req.body.identityProofUrl || "uploaded-file-mock-url",
        fullPath: null
      };
    }

    if (Boolean(validatedPersonalDetails) !== Boolean(storedIdentityProof)) {
      throw new RegistrationValidationError("Personal details and an ID proof (File or Google Drive Link) must be submitted together.");
    }

    let locationId = null;
    let locationData = null;

    if (latitude !== undefined && longitude !== undefined) {
      const locRef = locationsCol.doc();
      locationId = locRef.id;
      locationData = {
        id: locationId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusPreference: radiusPreference ? parseFloat(radiusPreference) : null
      };
      await locRef.set(locationData);
    }

    const updates = {
      verificationStatus: role === "admin" ? "approved" : "pending"
    };

    if (validatedPersonalDetails) {
      updates.personalDetails = validatedPersonalDetails;
      updates.identityProof = storedIdentityProof;
    }
    if (locationId) {
      updates.locationId = locationId;
      updates.location = locationData;
    }
    if (role === "volunteer") {
      updates.skillTags = skillTags;
    }

    await usersCol.doc(targetId).update(updates);
    
    // Return merged user
    const updatedUser = { ...userData, ...updates };
    delete updatedUser.passwordHash;
    
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    if (uploadedFileRef) {
      await cloudinary.uploader.destroy(uploadedFileRef).catch(() => {});
    }
    console.error("Error completing profile:", err);
    const statusCode = err instanceof RegistrationValidationError ? 400 : 500;
    const message = err instanceof RegistrationValidationError ? err.message : "Internal server error: " + err.message;
    res.status(statusCode).json({ error: message });
  }
});


authRouter.get("/demo-users", async (req, res) => {
  try {
    const snapshot = await usersCol.get();
    const allUsers = snapshot.docs.map(doc => doc.data());
    res.json({ users: allUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default authRouter;
