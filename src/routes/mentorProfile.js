import { Router } from "express";
import {
  listMentorProfiles,
  getMentorProfile,
  upsertMentorProfile,
  getAllowedTags,
} from "../controllers/mentorProfileController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const mentorProfileRoutes = Router();

mentorProfileRoutes.use(authenticate);

// Any authenticated role can read mentor metadata (needed to show recommendations context).
mentorProfileRoutes.get("/tags", getAllowedTags);
mentorProfileRoutes.get("/", requireRole("ADMIN"), listMentorProfiles);
mentorProfileRoutes.get("/:mentorId", requireRole("ADMIN"), getMentorProfile);

// Only Admin manages mentor metadata (tags + descriptions), per the brief.
mentorProfileRoutes.put("/:mentorId", requireRole("ADMIN"), upsertMentorProfile);
