#!/usr/bin/env node
const { prisma } = require("../dist/client.js");
const { provisionAdminUser } = require("../dist/admin-provision.js");

async function main() {
  const email = process.argv[2];
  const envTarget = process.argv[3] || "development";

  if (!email) {
    console.error("Usage: node scripts/provision-admin.js <email> [development|staging|test]");
    process.exit(1);
  }

  console.log(`Attempting to provision ADMIN role for ${email} on target: ${envTarget}...`);

  const result = await provisionAdminUser(prisma, email, {
    targetConfirmation: true,
    environmentConfirmation: envTarget,
    actorId: "CLI_ADMIN_PROVISION",
  });

  if (!result.success) {
    console.error(`[FAILED] ${result.error}: ${result.message}`);
    process.exit(1);
  }

  console.log(`[SUCCESS] ${result.message}`);
  console.log("User ID:", result.user.id);
  console.log("Role:", result.user.role);
}

main()
  .catch((e) => {
    console.error("Unexpected error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
