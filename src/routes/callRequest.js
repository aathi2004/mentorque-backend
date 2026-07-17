import { Router } from "express";
import {
  createCallRequest,
  listMyCallRequests,
  listCallRequests,
  getRecommendations,
} from "../controllers/callRequestController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const callRequestRoutes = Router();

callRequestRoutes.use(authenticate);

// USER: submit and view their own requests. Users can never book (enforced by
// there being no booking endpoint reachable with a USER role token).
callRequestRoutes.post("/", requireRole("USER"), createCallRequest);
callRequestRoutes.get("/mine", requireRole("USER"), listMyCallRequests);

// ADMIN: review all requests and pull ranked mentor recommendations.
callRequestRoutes.get("/", requireRole("ADMIN"), listCallRequests);
callRequestRoutes.get("/:id/recommendations", requireRole("ADMIN"), getRecommendations);
