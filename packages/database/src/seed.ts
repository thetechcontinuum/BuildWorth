import { prisma } from "./client.js";

export async function seedDatabase() {
  console.log("Seeding BuildWorth database with deterministic baseline fixtures...");

  // 1. Sources
  const sources = [
    {
      key: "hackernews",
      name: "Hacker News",
      description: "Firebase & Algolia APIs for tech discussions",
      adapterType: "HACKERNEWS_API",
      accessMethod: "API",
    },
    {
      key: "reddit",
      name: "Reddit Tech & Ops",
      description: "Targeted subreddits for developer and business operations",
      adapterType: "REDDIT_OAUTH",
      accessMethod: "OAUTH_API",
    },
    {
      key: "github",
      name: "GitHub Issues",
      description: "Public repository issues and discussions on tool friction",
      adapterType: "GITHUB_REST",
      accessMethod: "API",
    },
    {
      key: "producthunt",
      name: "Product Hunt",
      description: "Launch metadata, reviews, and missing feature comments",
      adapterType: "PRODUCTHUNT_GRAPHQL",
      accessMethod: "GRAPHQL",
    },
  ];

  for (const src of sources) {
    await prisma.source.upsert({
      where: { key: src.key },
      update: {},
      create: src,
    });
  }

  // 2. Kill Switches
  const switches = ["ALL", "AI_GENERATION", "INGESTION", "AUTO_PUBLISH"];
  for (const s of switches) {
    await prisma.killSwitch.upsert({
      where: { subsystem: s },
      update: {},
      create: { subsystem: s, isActive: false, reason: "Initial default state" },
    });
  }

  console.log("Database seeded successfully.");
}

if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  seedDatabase()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
