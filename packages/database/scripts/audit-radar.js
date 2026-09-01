const { execSync } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);

async function runRadarAudit() {
  const isReportOnly = process.argv.includes("--report-only");
  console.log("=== BuildWorth Phase 4C Server-Authoritative Radar Audit ===");

  let dbUrl = process.env.DATABASE_URL;
  let tempDbName = null;

  if (!dbUrl) {
    tempDbName = "audit_radar_temp_" + Date.now();
    try {
      execSync(
        `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${tempDbName};"`,
        { stdio: "pipe" },
      );
      dbUrl = `postgresql://postgres:postgres@localhost:5440/${tempDbName}?schema=public`;
      execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: "pipe",
      });
      execSync(`node scripts/test-phase4c-seed-fixture.js`, {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: "pipe",
      });
    } catch (err) {
      console.error(
        "[FATAL] Missing DATABASE_URL and failed to create disposable test database:",
        err.message,
      );
      process.exit(2);
    }
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  const defects = [];

  try {
    // 1. Audit OpportunityChangeEvents
    const changeEvents = await prisma.opportunityChangeEvent.findMany({
      include: {
        fromRevision: true,
        toRevision: true,
        items: true,
      },
    });

    const seenDiffPairs = new Set();

    for (const ev of changeEvents) {
      // Check consecutive revisions
      if (ev.toRevision.revisionNumber !== ev.fromRevision.revisionNumber + 1) {
        defects.push({
          type: "NON_CONSECUTIVE_REVISION_DIFF",
          eventId: ev.id,
          details: `From rev ${ev.fromRevision.revisionNumber} to rev ${ev.toRevision.revisionNumber}`,
        });
      }

      // Check duplicate from/to pair
      const pairKey = `${ev.fromRevisionId}:${ev.toRevisionId}:${ev.diffVersion}`;
      if (seenDiffPairs.has(pairKey)) {
        defects.push({
          type: "DUPLICATE_CHANGE_EVENT_PAIR",
          eventId: ev.id,
          details: pairKey,
        });
      }
      seenDiffPairs.add(pairKey);

      // Check canonicalInputHash presence
      if (!ev.canonicalInputHash || ev.canonicalInputHash.length < 32) {
        defects.push({
          type: "MALFORMED_CANONICAL_HASH",
          eventId: ev.id,
        });
      }

      // Check items for empty or formatting-only diffs
      if (ev.items.length === 0) {
        defects.push({
          type: "EMPTY_OR_FORMATTING_ONLY_CHANGE_EVENT",
          eventId: ev.id,
        });
      }

      // Check that global items contain NO user-specific or sensitive data
      for (const item of ev.items) {
        const itemStr = JSON.stringify(item);
        if (
          itemStr.includes("founderProfile") ||
          itemStr.includes("userId") ||
          itemStr.includes("user_")
        ) {
          defects.push({
            type: "USER_DATA_IN_GLOBAL_CHANGE_EVENT",
            itemId: item.id,
            eventId: ev.id,
          });
        }
      }
    }

    // 2. Audit RadarEvaluations
    const evaluations = await prisma.radarEvaluation.findMany({
      include: {
        watch: true,
        changeEvent: true,
        founderProfileRevision: true,
      },
    });

    for (const ev of evaluations) {
      if (!ev.watch) {
        defects.push({
          type: "ORPHANED_RADAR_EVALUATION",
          evaluationId: ev.id,
        });
      }

      // Check founderProfileRevision correctness
      if (ev.founderProfileRevisionId && ev.founderProfileRevision) {
        if (ev.watch && ev.founderProfileRevision.profileId) {
          // Check if profile belongs to the watch user
          const profile = await prisma.founderProfile.findUnique({
            where: { id: ev.founderProfileRevision.profileId },
          });
          if (profile && profile.userId !== ev.watch.userId) {
            defects.push({
              type: "STALE_OR_CROSS_USER_FOUNDER_PROFILE_REVISION",
              evaluationId: ev.id,
              watchUserId: ev.watch.userId,
              profileUserId: profile.userId,
            });
          }
        }
      }

      // Check canonical hash
      if (!ev.canonicalInputHash || ev.canonicalInputHash.length < 32) {
        defects.push({
          type: "MALFORMED_EVALUATION_HASH",
          evaluationId: ev.id,
        });
      }
    }

    // 3. Audit SavedOpportunities & Entitlements
    const watches = await prisma.savedOpportunity.findMany({
      include: {
        user: {
          include: {
            billingSubscriptions: {
              where: { status: { in: ["ACTIVE", "TRIALING"] } },
            },
          },
        },
      },
    });

    // Group watches by user to verify entitlement limits
    const userWatchesMap = new Map();
    for (const w of watches) {
      const arr = userWatchesMap.get(w.userId) || [];
      arr.push(w);
      userWatchesMap.set(w.userId, arr);
    }

    for (const [userId, userWatches] of userWatchesMap.entries()) {
      const user = userWatches[0].user;
      const isPro =
        user?.tier === "PRO" ||
        (user?.billingSubscriptions && user.billingSubscriptions.length > 0);
      const limit = isPro ? 50 : 3;

      if (userWatches.length > limit) {
        defects.push({
          type: "WATCHLIST_LIMIT_EXCEEDED",
          userId,
          count: userWatches.length,
          limit,
          tier: user?.tier || "FREE",
        });
      }
    }

    // 4. Audit NotificationOutbox & Deliveries
    const outboxItems = await prisma.notificationOutbox.findMany({
      include: {
        user: true,
        radarEvaluation: true,
        deliveries: true,
      },
    });

    const dedupeKeys = new Set();

    for (const item of outboxItems) {
      // Check deduplication key
      if (dedupeKeys.has(item.deduplicationKey)) {
        defects.push({
          type: "DUPLICATE_OUTBOX_DEDUPE_KEY",
          outboxId: item.id,
          deduplicationKey: item.deduplicationKey,
        });
      }
      dedupeKeys.add(item.deduplicationKey);

      // Check Free user policy (Free user must NOT have INSTANT alerts)
      if (item.user.tier === "FREE" && item.notificationType === "RADAR_CHANGE_ALERT") {
        defects.push({
          type: "FREE_USER_WITH_INSTANT_ALERT",
          outboxId: item.id,
          userId: item.userId,
        });
      }

      // Check that payload contains NO sensitive profile answers
      const payloadStr = JSON.stringify(item.sanitizedPayload);
      if (payloadStr.includes("founderSkill") || payloadStr.includes("technicalRiskTolerance")) {
        defects.push({
          type: "SENSITIVE_PROFILE_DATA_IN_NOTIFICATION_PAYLOAD",
          outboxId: item.id,
        });
      }

      // Check delivery attempts consistency with item.attemptCount
      if (item.status !== "CANCELLED" && item.attemptCount !== item.deliveries.length) {
        defects.push({
          type: "OUTBOX_ATTEMPT_COUNT_DELIVERY_MISMATCH",
          outboxId: item.id,
          attemptCount: item.attemptCount,
          deliveryCount: item.deliveries.length,
        });
      }

      if (item.status === "CANCELLED" && item.deliveries.length > 0) {
        defects.push({
          type: "CANCELLED_OUTBOX_HAS_DELIVERIES",
          outboxId: item.id,
          deliveryCount: item.deliveries.length,
        });
      }

      // Check delivery attempts sequence, idempotency keys, and duplicate attempt numbers
      const attemptNums = new Set();
      const idempotencyKeys = new Set();
      const sortedDeliveries = [...item.deliveries].sort(
        (a, b) => a.attemptNumber - b.attemptNumber,
      );

      const expectedIdempKey = `idemp_${crypto
        .createHash("sha256")
        .update(`${item.id}:${item.deduplicationKey}`)
        .digest("hex")
        .slice(0, 24)}`;

      sortedDeliveries.forEach((del, idx) => {
        const expectedNum = idx + 1;
        if (del.attemptNumber !== expectedNum) {
          defects.push({
            type: "DELIVERY_ATTEMPT_NUMBER_NON_CONSECUTIVE",
            outboxId: item.id,
            deliveryId: del.id,
            expected: expectedNum,
            actual: del.attemptNumber,
          });
        }
        if (attemptNums.has(del.attemptNumber)) {
          defects.push({
            type: "DUPLICATE_DELIVERY_ATTEMPT_NUMBER",
            outboxId: item.id,
            deliveryId: del.id,
            attemptNumber: del.attemptNumber,
          });
        }
        attemptNums.add(del.attemptNumber);

        // Check providerIdempotencyKey validity
        if (!del.providerIdempotencyKey) {
          defects.push({
            type: "DELIVERY_MISSING_PROVIDER_IDEMPOTENCY_KEY",
            outboxId: item.id,
            deliveryId: del.id,
          });
        } else {
          idempotencyKeys.add(del.providerIdempotencyKey);
          if (del.providerIdempotencyKey !== expectedIdempKey) {
            defects.push({
              type: "DELIVERY_IDEMPOTENCY_KEY_MISMATCH",
              outboxId: item.id,
              deliveryId: del.id,
              expected: expectedIdempKey,
              actual: del.providerIdempotencyKey,
            });
          }
        }

        if (!del.providerMessageId && del.status === "SUCCESS") {
          defects.push({
            type: "SUCCESSFUL_DELIVERY_MISSING_PROVIDER_MESSAGE_ID",
            outboxId: item.id,
            deliveryId: del.id,
          });
        }
      });

      // All delivery attempts for one logical outbox must share exactly one idempotency key
      if (item.deliveries.length > 0 && idempotencyKeys.size > 1) {
        defects.push({
          type: "MULTIPLE_IDEMPOTENCY_KEYS_FOR_SAME_OUTBOX",
          outboxId: item.id,
          keys: Array.from(idempotencyKeys),
        });
      }

      // Check for deliverable instant alert on muted watch
      if (
        item.notificationType === "RADAR_CHANGE_ALERT" &&
        (item.status === "PENDING" || item.status === "PROCESSING")
      ) {
        const watch = watches.find(
          (w) => w.userId === item.userId && w.opportunityId === item.opportunityId,
        );
        if (watch && watch.mutedUntil && new Date(watch.mutedUntil) > new Date()) {
          defects.push({
            type: "MUTED_WATCH_WITH_DELIVERABLE_INSTANT_ALERT",
            outboxId: item.id,
            userId: item.userId,
            mutedUntil: watch.mutedUntil,
          });
        }
      }

      // Check that SENT items have at least one successful delivery record and at most one successful delivery (no duplicate provider logical successes)
      const successDeliveries = item.deliveries.filter((d) => d.status === "SUCCESS");
      if (item.status === "SENT") {
        if (successDeliveries.length === 0) {
          defects.push({
            type: "SENT_OUTBOX_WITHOUT_SUCCESSFUL_DELIVERY",
            outboxId: item.id,
          });
        }
      }
      if (successDeliveries.length > 1) {
        defects.push({
          type: "DUPLICATE_SUCCESSFUL_PROVIDER_DELIVERIES",
          outboxId: item.id,
          count: successDeliveries.length,
        });
      }

      // Check that DEAD_LETTER has at least 5 failed attempts
      if (item.status === "DEAD_LETTER") {
        const failedCount = item.deliveries.filter((d) => d.status === "FAILED").length;
        if (failedCount < 5 || item.attemptCount < 5) {
          defects.push({
            type: "DEAD_LETTER_INSUFFICIENT_FAILED_ATTEMPTS",
            outboxId: item.id,
            attemptCount: item.attemptCount,
            failedCount,
          });
        }
      }

      // Check that FAILED or DEAD_LETTER items have error metadata
      if ((item.status === "FAILED" || item.status === "DEAD_LETTER") && !item.sanitizedLastError) {
        defects.push({
          type: "FAILED_OUTBOX_MISSING_ERROR_METADATA",
          outboxId: item.id,
        });
      }
    }

    // 5. Audit OpportunityRadarJobs and Revisions
    const revisions = await prisma.opportunityRevision.findMany();
    const radarJobs = await prisma.opportunityRadarJob.findMany();
    const deliveries = await prisma.notificationDelivery.findMany();

    // Check for unclaimable expired leases in radar jobs
    const now = new Date();
    for (const job of radarJobs) {
      if (
        job.status === "PROCESSING" &&
        job.lockedUntil &&
        job.lockedUntil <= now &&
        !job.claimToken
      ) {
        defects.push({
          type: "EXPIRED_PROCESSING_LEASE_NOT_RECLAIMABLE",
          jobId: job.id,
        });
      }
    }

    // Check for unclaimable expired leases in outbox
    for (const item of outboxItems) {
      if (
        item.status === "PROCESSING" &&
        item.lockedUntil &&
        item.lockedUntil <= now &&
        !item.claimToken
      ) {
        defects.push({
          type: "EXPIRED_PROCESSING_OUTBOX_LEASE_NOT_RECLAIMABLE",
          outboxId: item.id,
        });
      }
    }

    // Strict non-vacuous requirement: In non-report-only strict audit, database must contain meaningful populated records
    const allowEmpty = process.argv.includes("--allow-empty");
    if (
      !allowEmpty &&
      !isReportOnly &&
      (changeEvents.length === 0 ||
        watches.length === 0 ||
        evaluations.length === 0 ||
        outboxItems.length === 0)
    ) {
      defects.push({
        type: "VACUOUS_AUDIT_INSUFFICIENT_DATA",
        details:
          "Radar audit must be run on populated state with active change events, watches, evaluations, and outbox rows, or provide --allow-empty.",
      });
    }

    const totalChangeItems = changeEvents.reduce((acc, ev) => acc + (ev.items?.length || 0), 0);
    const instantNotifications = outboxItems.filter(
      (o) => o.notificationType === "RADAR_CHANGE_ALERT",
    ).length;
    const dailyDigestNotifications = outboxItems.filter(
      (o) => o.notificationType === "RADAR_DAILY_DIGEST",
    ).length;
    const weeklyDigestNotifications = outboxItems.filter(
      (o) => o.notificationType === "RADAR_WEEKLY_DIGEST",
    ).length;
    const successfulDeliveries = deliveries.filter((d) => d.status === "SUCCESS").length;
    const failedDeliveries = deliveries.filter((d) => d.status === "FAILED").length;
    const retryableRows = outboxItems.filter(
      (o) => o.status === "PENDING" || o.status === "PROCESSING",
    ).length;
    const deadLetterRows = outboxItems.filter(
      (o) => o.status === "DEAD_LETTER" || (o.status === "FAILED" && o.attemptCount >= 5),
    ).length;
    const cancelledRows = outboxItems.filter((o) => o.status === "CANCELLED").length;

    console.log("----------------------------------------------------------------");
    console.log(`Total Opportunity Revisions Audited : ${revisions.length}`);
    console.log(`Total OpportunityRadarJobs Audited  : ${radarJobs.length}`);
    console.log(`Total Global Change Events Audited  : ${changeEvents.length}`);
    console.log(`Total Change Items Audited          : ${totalChangeItems}`);
    console.log(`Total Saved Watches Audited         : ${watches.length}`);
    console.log(`Total Radar Evaluations Audited     : ${evaluations.length}`);
    console.log(`Total Notification Outbox Items     : ${outboxItems.length}`);
    console.log(` - Instant Alerts                   : ${instantNotifications}`);
    console.log(` - Daily Digest Rows                : ${dailyDigestNotifications}`);
    console.log(` - Weekly Digest Rows               : ${weeklyDigestNotifications}`);
    console.log(` - Cancelled Rows                   : ${cancelledRows}`);
    console.log(`Total Delivery Attempts Audited     : ${deliveries.length}`);
    console.log(` - Successful Deliveries            : ${successfulDeliveries}`);
    console.log(` - Failed Delivery Attempts         : ${failedDeliveries}`);
    console.log(` - Retryable Outbox Rows            : ${retryableRows}`);
    console.log(` - Dead-Letter Outbox Rows          : ${deadLetterRows}`);
    console.log(`Total Radar Defects Found           : ${defects.length}`);
    console.log("----------------------------------------------------------------");

    if (defects.length > 0) {
      console.log("DEFECTS ENCOUNTERED:");
      defects.forEach((d, i) => console.log(` [Defect ${i + 1}]`, JSON.stringify(d)));

      if (isReportOnly) {
        console.log("Report-only mode active: Exiting with code 0.");
        process.exit(0);
      }
      process.exit(1);
    }

    console.log("Radar Audit Result: CLEAN PASS (Exit code 0)");
    process.exit(0);
  } catch (err) {
    console.error("Radar Audit Execution / DB Connection Failure:", err?.message);
    process.exit(2);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (tempDbName) {
      try {
        execSync(
          `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${tempDbName};"`,
          { stdio: "pipe" },
        );
      } catch {}
    }
  }
}

runRadarAudit();
