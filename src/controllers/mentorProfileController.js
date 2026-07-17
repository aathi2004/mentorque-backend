import { prisma } from "../lib/prisma.js";
import { embedText } from "../services/embeddings.js";

const ALLOWED_TAGS = [
  "tech",
  "non_tech",
  "big_tech",
  "public_company",
  "india",
  "ireland",
  "senior_developer",
  "good_communication",
];

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
}

export async function listMentorProfiles(req, res, next) {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        mentorProfile: {
          select: { id: true, tags: true, domain: true, description: true, updatedAt: true },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json(mentors);
  } catch (e) {
    next(e);
  }
}

export async function getMentorProfile(req, res, next) {
  try {
    const { mentorId } = req.params;
    const profile = await prisma.mentorProfile.findUnique({ where: { userId: mentorId } });
    res.json(profile);
  } catch (e) {
    next(e);
  }
}

/** Admin manages mentor metadata (tags + description), per the assignment brief. */
export async function upsertMentorProfile(req, res, next) {
  try {
    const { mentorId } = req.params;
    const { tags, domain, description } = req.body;

    const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
    if (!mentor || mentor.role !== "MENTOR") {
      return res.status(404).json({ error: "Mentor not found" });
    }

    const cleanTags = sanitizeTags(tags);
    const cleanDescription = typeof description === "string" ? description.trim() : "";
    const descriptionEmbedding = cleanDescription ? await embedText(cleanDescription) : [];

    const profile = await prisma.mentorProfile.upsert({
      where: { userId: mentorId },
      create: {
        userId: mentorId,
        tags: cleanTags,
        domain: domain?.trim() || null,
        description: cleanDescription,
        descriptionEmbedding,
      },
      update: {
        tags: cleanTags,
        domain: domain?.trim() || null,
        description: cleanDescription,
        descriptionEmbedding,
      },
    });

    res.json(profile);
  } catch (e) {
    next(e);
  }
}

export function getAllowedTags(req, res) {
  res.json({ tags: ALLOWED_TAGS });
}
