CREATE TYPE "public"."case_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('approved', 'review', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."resolution" AS ENUM('analyst_approved', 'analyst_blocked');--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"status" "case_status" DEFAULT 'open' NOT NULL,
	"resolution" "resolution",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "cases_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "models" (
	"version" text PRIMARY KEY NOT NULL,
	"trained_at" timestamp with time zone NOT NULL,
	"metrics" jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_pool" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "replay_pool_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"features" jsonb NOT NULL,
	"amount_cents" integer NOT NULL,
	"is_fraud" boolean NOT NULL,
	"card_last4" varchar(4) NOT NULL,
	"merchant" text NOT NULL,
	"city" text NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"t_low" real NOT NULL,
	"t_high" real NOT NULL,
	"sim_batch_min" integer DEFAULT 3 NOT NULL,
	"sim_batch_max" integer DEFAULT 8 NOT NULL,
	"sim_min_interval_seconds" integer DEFAULT 15 NOT NULL,
	"last_tick_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigserial NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"card_last4" varchar(4) NOT NULL,
	"merchant" text NOT NULL,
	"city" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"features" jsonb NOT NULL,
	"score" real,
	"top_factors" jsonb,
	"decision" "decision" NOT NULL,
	"scoring_error" boolean DEFAULT false NOT NULL,
	"is_fraud_truth" boolean,
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_decision_idx" ON "transactions" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "transactions_score_idx" ON "transactions" USING btree ("score");