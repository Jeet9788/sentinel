import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** What the decision engine did with a transaction, with no human involved yet. */
export const decisionEnum = pgEnum("decision", ["approved", "review", "blocked"]);
export const caseStatusEnum = pgEnum("case_status", ["open", "resolved"]);
export const resolutionEnum = pgEnum("resolution", ["analyst_approved", "analyst_blocked"]);

export type TopFactor = {
  feature: string;
  label: string;
  impact: number;
  direction: "up" | "down";
};

export const transactions = pgTable(
  "transactions",
  {
    /** Client-supplied, so a retried ingest cannot create a duplicate transaction. */
    id: uuid("id").primaryKey(),
    /** Monotonic cursor for the live feed — timestamps tie, sequences don't. */
    seq: bigserial("seq", { mode: "number" }).notNull().unique(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),

    // Display metadata. Synthetic: the real dataset's fields are anonymized PCA
    // components with no human meaning. The scores are real; these names are not.
    cardLast4: varchar("card_last4", { length: 4 }).notNull(),
    merchant: text("merchant").notNull(),
    city: text("city").notNull(),

    /** Integer cents. Money never touches a float. */
    amountCents: integer("amount_cents").notNull(),
    /** The 29 model inputs, in FEATURE_NAMES order. */
    features: jsonb("features").$type<number[]>().notNull(),

    score: real("score"),
    topFactors: jsonb("top_factors").$type<TopFactor[]>(),
    decision: decisionEnum("decision").notNull(),
    /** True when the scorer failed and the transaction was routed to a human anyway. */
    scoringError: boolean("scoring_error").notNull().default(false),

    /**
     * Ground truth, which only exists because this is a replay of a labeled
     * holdout set. A production system would not have this column; we use it to
     * show caught-vs-missed honestly, and the UI says where it comes from.
     */
    isFraudTruth: boolean("is_fraud_truth"),

    modelVersion: text("model_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transactions_created_at_idx").on(table.createdAt),
    index("transactions_decision_idx").on(table.decision),
    index("transactions_score_idx").on(table.score),
  ],
);

/**
 * One case per transaction the model could not settle on its own. This is the
 * audit trail — and, incidentally, a growing pile of human-labeled examples that
 * a future retraining run could learn from.
 */
export const cases = pgTable(
  "cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .unique()
      .references(() => transactions.id, { onDelete: "cascade" }),
    status: caseStatusEnum("status").notNull().default("open"),
    resolution: resolutionEnum("resolution"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("cases_status_idx").on(table.status)],
);

/** Single row (id = 1). The live operating configuration of the system. */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  /** Below tLow: auto-approve. Between: human review. At/above tHigh: auto-block. */
  tLow: real("t_low").notNull(),
  tHigh: real("t_high").notNull(),
  simBatchMin: integer("sim_batch_min").notNull().default(3),
  simBatchMax: integer("sim_batch_max").notNull().default(8),
  simMinIntervalSeconds: integer("sim_min_interval_seconds").notNull().default(15),
  /** Server-side throttle: N open dashboards still produce one batch per interval. */
  lastTickAt: timestamp("last_tick_at", { withTimezone: true }),
});

/** Model registry. One active version at a time; the Model page reads this. */
export const models = pgTable("models", {
  version: text("version").primaryKey(),
  trainedAt: timestamp("trained_at", { withTimezone: true }).notNull(),
  metrics: jsonb("metrics").notNull(),
  active: boolean("active").notNull().default(false),
});

/** Held-out transactions the simulator replays. Seeded once from the ML pipeline. */
export const replayPool = pgTable("replay_pool", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  features: jsonb("features").$type<number[]>().notNull(),
  amountCents: integer("amount_cents").notNull(),
  isFraud: boolean("is_fraud").notNull(),
  cardLast4: varchar("card_last4", { length: 4 }).notNull(),
  merchant: text("merchant").notNull(),
  city: text("city").notNull(),
  usedCount: integer("used_count").notNull().default(0),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Case = typeof cases.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type ReplayRow = typeof replayPool.$inferSelect;
