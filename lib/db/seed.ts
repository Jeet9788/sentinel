/**
 * Seeds the operating configuration, the model registry, and the replay pool.
 * Idempotent: safe to re-run against a live database.
 *
 * The thresholds are not hardcoded here — they come from metrics.json, which the
 * training run produced from the model's own precision/recall curve. Training
 * proposes; the analyst disposes (via the Model page).
 */
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

import { sql } from "drizzle-orm";

import metrics from "@/models/v1/metrics.json";
import { db } from "./index";
import { models, replayPool, settings } from "./schema";

const REPLAY_FILE = "db/replay_pool.jsonl.gz";
const BATCH_SIZE = 500;

type ReplayRecord = {
  features: number[];
  amountCents: number;
  isFraud: boolean;
  cardLast4: string;
  merchant: string;
  city: string;
};

async function seedSettings() {
  await db
    .insert(settings)
    .values({
      id: 1,
      tLow: metrics.suggested.tLow,
      tHigh: metrics.suggested.tHigh,
      simBatchMin: 3,
      simBatchMax: 8,
      simMinIntervalSeconds: 15,
    })
    .onConflictDoNothing();
  console.log(`settings: tLow=${metrics.suggested.tLow} tHigh=${metrics.suggested.tHigh}`);
}

async function seedModel() {
  await db
    .insert(models)
    .values({
      version: metrics.version,
      trainedAt: new Date(metrics.trainedAt),
      metrics,
      active: true,
    })
    .onConflictDoUpdate({
      target: models.version,
      set: { metrics, trainedAt: new Date(metrics.trainedAt), active: true },
    });
  console.log(`models: ${metrics.version} (PR-AUC ${metrics.prAuc}, ROC-AUC ${metrics.rocAuc})`);
}

async function seedReplayPool() {
  const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(replayPool);
  if (existing.count > 0) {
    console.log(`replay_pool: ${existing.count} rows already present, skipping`);
    return;
  }

  const lines = createInterface({
    input: createReadStream(REPLAY_FILE).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let batch: ReplayRecord[] = [];
  let total = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    await db.insert(replayPool).values(batch);
    total += batch.length;
    batch = [];
  };

  for await (const line of lines) {
    if (!line.trim()) continue;
    batch.push(JSON.parse(line) as ReplayRecord);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  console.log(`replay_pool: ${total} rows loaded`);
}

async function main() {
  await seedSettings();
  await seedModel();
  await seedReplayPool();
  console.log("seed complete");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
