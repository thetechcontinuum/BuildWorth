const path = require("path");
const { PrismaClient } = require(path.resolve("node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client"));
const { execSync } = require("child_process");

async function executeRealCliDefectCycle() {
  console.log("=== Real CLI Audit & Complete Defect Cycle Against PostgreSQL ===");
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const runAuditCli = (envDbUrl = dbUrl) => {
    try {
      const stdout = execSync("node packages/database/scripts/audit-founder-fit.js", {
        stdio: "pipe",
        env: { ...process.env, DATABASE_URL: envDbUrl },
      }).toString();
      return { exitCode: 0, output: stdout.trim() };
    } catch (err) {
      return {
        exitCode: err.status,
        output: (err.stdout ? err.stdout.toString() : "") + (err.stderr ? err.stderr.toString() : "").trim(),
      };
    }
  };

  try {
    const evaluation = await prisma.founderFitEvaluation.findFirst({
      where: { profileRevision: { profile: { user: { email: "strict.audit.persisted@buildworth.io" } } } },
      include: { profileRevision: { include: { skills: true } } },
    });

    if (!evaluation) {
      throw new Error("No evaluation found! Run seed-audit-evaluation.js first.");
    }

    const validHash = evaluation.inputHash;
    const skillRecord = evaluation.profileRevision.skills.find(s => s.skillKey === "TYPESCRIPT");

    console.log("1. Running Clean CLI Audit (Expect Exit 0)...");
    const res1 = runAuditCli();
    console.log("   Exit code:", res1.exitCode);
    console.log("   Summary line:", res1.output.split("\n").slice(-2).join(" | "));
    if (res1.exitCode !== 0) throw new Error("Step 1 failed");

    console.log("2. Corrupting persisted inputHash in PostgreSQL...");
    await prisma.founderFitEvaluation.update({
      where: { id: evaluation.id },
      data: { inputHash: "0000000000000000000000000000000000000000000000000000000000000000" },
    });

    console.log("3. Running CLI Audit on Corrupted Hash (Expect Exit 1)...");
    const res2 = runAuditCli();
    console.log("   Exit code:", res2.exitCode);
    console.log("   Summary line:", res2.output.split("\n").slice(-2).join(" | "));
    if (res2.exitCode !== 1) throw new Error("Step 3 failed");

    console.log("4. Restoring valid hash in PostgreSQL...");
    await prisma.founderFitEvaluation.update({
      where: { id: evaluation.id },
      data: { inputHash: validHash },
    });

    console.log("5. Running CLI Audit after Restore (Expect Exit 0)...");
    const res3 = runAuditCli();
    console.log("   Exit code:", res3.exitCode);
    console.log("   Summary line:", res3.output.split("\n").slice(-2).join(" | "));
    if (res3.exitCode !== 0) throw new Error("Step 5 failed");

    console.log("6. Modifying persisted founder skill proficiency in PostgreSQL without recalculating...");
    await prisma.founderSkill.update({
      where: { id: skillRecord.id },
      data: { proficiency: "BASIC" },
    });

    console.log("7. Running CLI Audit on Modified Source Input (Expect Exit 1)...");
    const res4 = runAuditCli();
    console.log("   Exit code:", res4.exitCode);
    console.log("   Summary line:", res4.output.split("\n").slice(-2).join(" | "));
    if (res4.exitCode !== 1) throw new Error("Step 7 failed");

    console.log("8. Restoring original founder skill proficiency...");
    await prisma.founderSkill.update({
      where: { id: skillRecord.id },
      data: { proficiency: "EXPERT" },
    });

    console.log("9. Running CLI Audit after Data Restore (Expect Exit 0)...");
    const res5 = runAuditCli();
    console.log("   Exit code:", res5.exitCode);
    console.log("   Summary line:", res5.output.split("\n").slice(-2).join(" | "));
    if (res5.exitCode !== 0) throw new Error("Step 9 failed");

    console.log("10. Running CLI Audit against unreachable database (Expect Exit 2)...");
    const res6 = runAuditCli("postgresql://postgres:wrong@localhost:5999/nonexistent?connect_timeout=1");
    console.log("   Exit code:", res6.exitCode);
    console.log("   Summary line:", res6.output.split("\n").slice(-2).join(" | "));
    if (res6.exitCode !== 2) throw new Error("Step 10 failed");

    console.log("\n=======================================================");
    console.log("All 10 Real CLI Defect-Cycle Steps Successfully Verified!");
    console.log("=======================================================");
  } finally {
    await prisma.$disconnect();
  }
}

executeRealCliDefectCycle().catch(err => {
  console.error("Defect cycle runner failed:", err);
  process.exit(1);
});
