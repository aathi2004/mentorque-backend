/**
 * Seeds the database with demo data for the mentoring call scheduling assignment:
 *   - 1 Admin        (from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME env vars)
 *   - 5 Mentors      (with MentorProfile: tags, domain, description)
 *   - 10 Users       (with a few having a draft CallRequest so the admin has
 *                     something to recommend against immediately)
 *   - Weekly recurring availability templates for every mentor and user
 *
 * All accounts use the password "password123" (except admin, which uses env).
 * Run: node src/scripts/seed.js
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { replaceTemplate } from "../services/availabilityWeek.js";
import { embedText } from "../services/embeddings.js";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "password123";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin User";

const MENTORS = [
  {
    name: "Priya Sharma",
    email: "priya.mentor@example.com",
    tags: ["tech", "big_tech", "senior_developer", "good_communication"],
    domain: "Frontend",
    description:
      "Senior frontend engineer at a large tech company in India, 8 years building consumer web products. Loves helping people polish resumes and prep for frontend interviews.",
  },
  {
    name: "Rahul Menon",
    email: "rahul.mentor@example.com",
    tags: ["tech", "big_tech", "senior_developer"],
    domain: "Backend",
    description:
      "Backend/infra engineer at a big tech company, ex-startup founder. Comfortable with system design mock interviews and technical resume reviews for backend roles.",
  },
  {
    name: "Aoife Byrne",
    email: "aoife.mentor@example.com",
    tags: ["tech", "public_company", "ireland", "good_communication"],
    domain: "Data Science",
    description:
      "Data scientist based in Ireland at a publicly listed company. Strong communicator, enjoys job market strategy conversations and helping people navigate career pivots into data.",
  },
  {
    name: "Karan Verma",
    email: "karan.mentor@example.com",
    tags: ["non_tech", "public_company", "india", "good_communication"],
    domain: "Product",
    description:
      "Product manager at a public company in India. Great at communication-focused coaching - job market guidance, interview storytelling, and stakeholder-style mock interviews.",
  },
  {
    name: "Siobhan O'Connor",
    email: "siobhan.mentor@example.com",
    tags: ["tech", "big_tech", "ireland", "senior_developer", "good_communication"],
    domain: "Mobile",
    description:
      "Senior mobile engineer at a big tech company in Ireland. Runs resume revamps and mock interviews for iOS/Android roles, known for clear, structured feedback.",
  },
];

const USERS = [
  {
    name: "Aditya Rao",
    email: "aditya.user@example.com",
    tags: ["tech", "asks_a_lot_of_questions"],
    domain: "Frontend",
    request: {
      callType: "RESUME_REVAMP",
      description: "Frontend developer with 2 years experience, want my resume reviewed by someone from a big tech background before I apply to senior roles.",
    },
  },
  {
    name: "Meera Iyer",
    email: "meera.user@example.com",
    tags: ["tech", "good_communication"],
    domain: "Backend",
    request: {
      callType: "MOCK_INTERVIEW",
      description: "Backend engineer prepping for system design rounds, want a mock interview with someone from the same domain.",
    },
  },
  {
    name: "Sanjay Gupta",
    email: "sanjay.user@example.com",
    tags: ["non_tech"],
    domain: "Product",
    request: {
      callType: "JOB_MARKET_GUIDANCE",
      description: "Switching from consulting into product management, need guidance on how the job market is looking and how to position myself.",
    },
  },
  {
    name: "Fatima Sheikh",
    email: "fatima.user@example.com",
    tags: ["tech", "asks_a_lot_of_questions"],
    domain: "Data Science",
    request: {
      callType: "MOCK_INTERVIEW",
      description: "Data analyst moving into data science, want a mock interview focused on case studies and SQL from someone in that domain.",
    },
  },
  { name: "Devika Nair", email: "devika.user@example.com", tags: ["tech"], domain: "Mobile" },
  { name: "Arjun Malhotra", email: "arjun.user@example.com", tags: ["non_tech", "good_communication"], domain: "Product" },
  { name: "Neha Kapoor", email: "neha.user@example.com", tags: ["tech"], domain: "Frontend" },
  { name: "Vikram Singh", email: "vikram.user@example.com", tags: ["tech", "good_communication"], domain: "Backend" },
  { name: "Ananya Das", email: "ananya.user@example.com", tags: ["tech", "asks_a_lot_of_questions"], domain: "Data Science" },
  { name: "Rohan Kulkarni", email: "rohan.user@example.com", tags: ["non_tech"], domain: "Product" },
];

// A modest weekly recurring pattern: three weekday afternoon hours (UTC), so
// there's realistic overlap to demo without every slot always matching.
function weeklyPattern(hours) {
  const pattern = [];
  for (let dow = 1; dow <= 5; dow++) {
    // skip Friday for ~half the mentors/users to create some non-overlap too
    for (const hour of hours) pattern.push({ dayOfWeek: dow, hour });
  }
  return pattern;
}

async function upsertPerson({ name, email, role, password }) {
  const hashed = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name, role, password: hashed },
    });
  }
  return prisma.user.create({
    data: { id: uuidv4(), name, email, password: hashed, role, timezone: "UTC" },
  });
}

async function main() {
  console.log("Seeding admin...");
  await upsertPerson({ name: ADMIN_NAME, email: ADMIN_EMAIL, role: "ADMIN", password: ADMIN_PASSWORD });

  console.log("Seeding mentors...");
  for (const [i, m] of MENTORS.entries()) {
    const user = await upsertPerson({ name: m.name, email: m.email, role: "MENTOR", password: DEFAULT_PASSWORD });

    const descriptionEmbedding = await embedText(m.description);
    await prisma.mentorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tags: m.tags, domain: m.domain, description: m.description, descriptionEmbedding },
      update: { tags: m.tags, domain: m.domain, description: m.description, descriptionEmbedding },
    });

    // Alternate hour ranges so overlap with users isn't 100% guaranteed everywhere.
    const hours = i % 2 === 0 ? [10, 11, 14] : [13, 15, 16];
    await replaceTemplate({ userId: null, mentorId: user.id, role: "MENTOR" }, weeklyPattern(hours));
    console.log(`  - ${m.name} (${m.email})`);
  }

  console.log("Seeding users...");
  for (const [i, u] of USERS.entries()) {
    const user = await upsertPerson({ name: u.name, email: u.email, role: "USER", password: DEFAULT_PASSWORD });

    const hours = i % 2 === 0 ? [10, 11, 14] : [11, 13, 15];
    await replaceTemplate({ userId: user.id, mentorId: null, role: "USER" }, weeklyPattern(hours));

    if (u.request) {
      const existingRequest = await prisma.callRequest.findFirst({ where: { userId: user.id } });
      if (!existingRequest) {
        const descriptionEmbedding = await embedText(u.request.description);
        await prisma.callRequest.create({
          data: {
            userId: user.id,
            callType: u.request.callType,
            tags: u.tags,
            domain: u.domain,
            description: u.request.description,
            descriptionEmbedding,
          },
        });
      }
    }
    console.log(`  - ${u.name} (${u.email})`);
  }

  console.log("\nSeed complete.");
  console.log(`Admin:   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`Mentors/Users password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
