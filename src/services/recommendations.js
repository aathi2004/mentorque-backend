import { prisma } from "../lib/prisma.js";
import { cosineSimilarity } from "./embeddings.js";
import { getWeekStart } from "../utils/time.js";
import { loadWeeklyAvailability } from "./availabilityWeek.js";

/**
 * Hard requirement per call type (Layer 1 filter). A mentor MUST satisfy
 * this to be considered at all, per the assignment's matching rules:
 *   - Resume Revamp        -> mentor should be from big tech
 *   - Job Market Guidance   -> mentor should be good at communication
 *   - Mock Interviews       -> mentor should be from the same domain as the user
 */
function passesHardFilter(callType, callRequest, mentorProfile) {
  const mentorTags = mentorProfile.tags || [];

  switch (callType) {
    case "RESUME_REVAMP":
      return mentorTags.includes("big_tech");
    case "JOB_MARKET_GUIDANCE":
      return mentorTags.includes("good_communication");
    case "MOCK_INTERVIEW":
      return (
        !!callRequest.domain &&
        !!mentorProfile.domain &&
        callRequest.domain.toLowerCase() === mentorProfile.domain.toLowerCase()
      );
    default:
      return true;
  }
}

function jaccardSimilarity(a = [], b = []) {
  const setA = new Set(a.map((t) => t.toLowerCase()));
  const setB = new Set(b.map((t) => t.toLowerCase()));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Check whether a mentor has *any* free slot in the next `daysAhead` days.
 * Reuses the existing weekly-availability loader rather than duplicating
 * overlap logic - looks at the current week and next week, which covers the
 * default booking window used elsewhere in the app.
 */
async function mentorHasUpcomingAvailability(mentorId, daysAhead = 14) {
  const weeksToCheck = Math.ceil(daysAhead / 7) + 1;
  const today = new Date();
  let cursor = getWeekStart(today);
  cursor.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < weeksToCheck; i++) {
    const result = await loadWeeklyAvailability(
      { userId: null, mentorId, role: "MENTOR" },
      cursor
    );
    const hasSlot = Object.values(result.availability || {}).some(
      (daySlots) => Array.isArray(daySlots) && daySlots.length > 0
    );
    if (hasSlot) return true;
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return false;
}

/**
 * Rank mentors for a given CallRequest.
 *
 * Scoring (all in [0, 1], weighted sum):
 *   - tagScore       (0.4): Jaccard overlap between request tags and mentor tags
 *   - embeddingScore (0.4): cosine similarity between description embeddings
 *   - availability   (0.2): 1 if mentor has an upcoming free slot, else 0
 *
 * Mentors that fail the call-type hard filter are excluded entirely, not
 * just down-ranked - the brief frames these as requirements, not preferences.
 */
export async function getRecommendationsForCallRequest(callRequestId, { limit = 5 } = {}) {
  const callRequest = await prisma.callRequest.findUnique({ where: { id: callRequestId } });
  if (!callRequest) {
    const err = new Error("Call request not found");
    err.statusCode = 404;
    throw err;
  }

  const mentors = await prisma.user.findMany({
    where: { role: "MENTOR" },
    include: { mentorProfile: true },
  });

  const eligible = mentors.filter(
    (m) => m.mentorProfile && passesHardFilter(callRequest.callType, callRequest, m.mentorProfile)
  );

  const scored = await Promise.all(
    eligible.map(async (mentor) => {
      const profile = mentor.mentorProfile;
      const tagScore = jaccardSimilarity(callRequest.tags, profile.tags);
      const embeddingScore = cosineSimilarity(
        callRequest.descriptionEmbedding,
        profile.descriptionEmbedding
      );
      const isAvailable = await mentorHasUpcomingAvailability(mentor.id);
      const availabilityScore = isAvailable ? 1 : 0;

      const score = tagScore * 0.4 + embeddingScore * 0.4 + availabilityScore * 0.2;

      return {
        mentor: {
          id: mentor.id,
          name: mentor.name,
          email: mentor.email,
          timezone: mentor.timezone,
        },
        profile: {
          tags: profile.tags,
          domain: profile.domain,
          description: profile.description,
        },
        score: Math.round(score * 1000) / 1000,
        scoreBreakdown: {
          tagScore: Math.round(tagScore * 1000) / 1000,
          embeddingScore: Math.round(embeddingScore * 1000) / 1000,
          availabilityScore,
        },
        hasUpcomingAvailability: isAvailable,
      };
    })
  );

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
