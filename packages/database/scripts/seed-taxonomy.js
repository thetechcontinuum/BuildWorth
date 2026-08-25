const path = require("path");
const { PrismaClient } = require(path.resolve(__dirname, "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client"));
const { INITIAL_SKILL_TAXONOMY } = require("../../scoring/dist/founder-fit/taxonomy-data.js");

async function seedTaxonomy() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  console.log("Seeding canonical skill taxonomy v1.0.0...");

  const taxonomy = await prisma.skillTaxonomyVersion.upsert({
    where: { version: "1.0.0" },
    update: { isActive: true },
    create: {
      version: "1.0.0",
      description: "Canonical startup engineering, GTM, design, operations, and compliance skill taxonomy",
      isActive: true,
    },
  });

  for (const item of INITIAL_SKILL_TAXONOMY) {
    const skill = await prisma.skillDefinition.upsert({
      where: { key: item.key },
      update: {
        displayName: item.displayName,
        category: item.category,
        description: item.description,
        taxonomyId: taxonomy.id,
      },
      create: {
        key: item.key,
        displayName: item.displayName,
        category: item.category,
        description: item.description,
        taxonomyId: taxonomy.id,
      },
    });

    for (const alias of item.aliases) {
      await prisma.skillAlias.upsert({
        where: { alias },
        update: { skillId: skill.id },
        create: {
          alias,
          skillId: skill.id,
        },
      });
    }
  }

  console.log(`Successfully seeded ${INITIAL_SKILL_TAXONOMY.length} skills with aliases in taxonomy v1.0.0`);
  await prisma.$disconnect();
}

module.exports = { seedTaxonomy };

if (require.main === module) {
  seedTaxonomy().catch(err => {
    console.error("Taxonomy seed failed:", err);
    process.exit(1);
  });
}
