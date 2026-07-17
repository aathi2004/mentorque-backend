import { prisma } from "../lib/prisma.js";
import { embedText } from "../services/embeddings.js";
import { getRecommendationsForCallRequest } from "../services/recommendations.js";

const CALL_TYPES = ["RESUME_REVAMP", "JOB_MARKET_GUIDANCE", "MOCK_INTERVIEW"];

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
}

/** USER creates a request declaring what kind of call + tags/description they need. Cannot book. */
export async function createCallRequest(req, res, next) {
  try {
    const { callType, tags, domain, description } = req.body;
    if (!CALL_TYPES.includes(callType)) {
      return res.status(400).json({ error: `callType must be one of: ${CALL_TYPES.join(", ")}` });
    }
    const cleanDescription = typeof description === "string" ? description.trim() : "";
    if (!cleanDescription) {
      return res.status(400).json({ error: "description is required" });
    }

    const descriptionEmbedding = await embedText(cleanDescription);

    const callRequest = await prisma.callRequest.create({
      data: {
        userId: req.userId,
        callType,
        tags: sanitizeTags(tags),
        domain: domain?.trim() || null,
        description: cleanDescription,
        descriptionEmbedding,
      },
    });

    res.status(201).json(callRequest);
  } catch (e) {
    next(e);
  }
}

/** USER views their own requests. */
export async function listMyCallRequests(req, res, next) {
  try {
    const requests = await prisma.callRequest.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { meeting: true },
    });
    res.json(requests);
  } catch (e) {
    next(e);
  }
}

/** ADMIN views all pending requests to work through. */
export async function listCallRequests(req, res, next) {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    const requests = await prisma.callRequest.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, timezone: true } },
        meeting: true,
      },
    });
    res.json(requests);
  } catch (e) {
    next(e);
  }
}

/** ADMIN gets a ranked mentor shortlist for a specific request. */
export async function getRecommendations(req, res, next) {
  try {
    const { id } = req.params;
    const recommendations = await getRecommendationsForCallRequest(id);

    await prisma.callRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "RECOMMENDED" },
    });

    res.json({ recommendations });
  } catch (e) {
    next(e);
  }
}
