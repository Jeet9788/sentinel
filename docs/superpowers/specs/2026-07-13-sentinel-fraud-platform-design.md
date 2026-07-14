# Sentinel — Real-Time Payment Fraud Detection Platform

**Date:** 2026-07-13
**Status:** Approved (design walked through and approved in-session)
**Purpose:** Resume-grade, end-to-end AI/ML + full-stack project targeting full-stack SWE (AI-flavored) roles. Explicitly not an AI assistant/chatbot. Built entirely by Claude; the owner's involvement is limited to a one-time Vercel login at deploy time.

## 1. Overview

Sentinel is a fraud-operations console of the kind payment companies (Stripe, Razorpay) run internally. A simulator streams card transactions through the system; a locally-trained XGBoost model scores each one in real time; a decision engine auto-approves, auto-blocks, or routes to a human review queue; analysts resolve flagged cases with a per-transaction explanation panel showing why the model fired. A dashboard shows live traffic, fraud KPIs, and model health, and thresholds are tunable from the UI.

**Elevator demo (2 minutes):** open URL → live transactions ticking in → click "Inject fraud burst" → a transaction flashes red → open it → explanation reads "flagged at 0.94: amount 38× card average, 3 AM, V14 anomalous" → click Block → dashboard "fraud prevented" counter updates.

## 2. Goals and non-goals

**Goals**

1. Genuine ML depth: severe class imbalance (0.17% positives), time-based splits, PR-AUC evaluation, threshold trade-offs, explainability.
2. Genuine full-stack depth: streaming-feel ingest, scoring API, Postgres data model, live dashboard, human-in-the-loop actions, audit trail.
3. A permanent live URL on Vercel free tier + a repo README good enough to be read by interviewers.
4. Every architectural choice has an interview-defensible rationale.

**Non-goals (v1)**

- No user auth (single-analyst demo; noted as stretch).
- No automated retraining or drift monitoring (stretch; the schema already accumulates analyst labels to enable it).
- No real payment integration; transactions come from the replay simulator.
- No LLM/chatbot components.

## 3. Architecture

One monorepo, one Vercel project, using Vercel's official Next.js + Python coexistence pattern (Python FastAPI function under `api/`, Next.js rewrites `/api/py/*` to it; in dev the rewrite targets a local uvicorn server).

```
┌─────────────────────────── VERCEL ───────────────────────────┐
│  Next.js 15 (App Router, TS, Tailwind + shadcn/ui, Recharts) │
│   ├── Pages: Overview / Queue / Transactions / Model         │
│   └── Node API routes: ingest, feed, stats, transactions,    │
│        cases, settings, simulate (tick/burst), cron/cleanup  │
│                     │ rewrite /api/py/*                      │
│                     ▼                                        │
│  Python function (FastAPI + onnxruntime + numpy)             │
│   └── POST /api/py/score → {probability, top_factors[]}      │
│       model.onnx bundled with the deployment                 │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
              Neon Postgres (Vercel Marketplace, free tier)

Local, run once per model version:
  ml/ pipeline → models/v1/{model.onnx, metrics.json, pr_curve.json,
                 shap_summary.json, feature_stats.json}  (committed)
```

**Scoring flow:** `POST /api/ingest` (Node) → calls Python `/api/py/score` → decision engine applies thresholds → `score < T_low` approve, `T_low ≤ score < T_high` open review case, `≥ T_high` block → transaction (+ case) written to Postgres in one DB transaction → UI feed picks it up.

**Simulator (presence-driven, not cron-driven).** Vercel Hobby cron jobs run at most once per day, so a per-minute cron cannot power the live feed. Instead:

- While any dashboard tab is open, the client calls `POST /api/simulate/tick` every ~20s. The endpoint is server-throttled (min interval between effective ticks, enforced via a `last_tick_at` row in `settings`), so N open tabs still produce one batch per interval. Each effective tick ingests a small randomized batch (~3–8 transactions) drawn from `replay_pool`, occasionally including a true-fraud row.
- `POST /api/simulate/burst` (demo button) ingests ~10 rows including 2–3 guaranteed high-risk rows.
- A daily Vercel cron `GET /api/cron/cleanup` (guarded by `CRON_SECRET`) trims transactions older than N days (keeps Neon free tier comfortable) and refreshes daily aggregates.
- Rationale is a feature, not a workaround: simulating traffic nobody is watching wastes compute; the system is alive exactly when observed.

**Stack versions:** Next.js 15 (App Router, TypeScript), Node 24, pnpm, Tailwind CSS + shadcn/ui, Recharts, Drizzle ORM + drizzle-kit migrations on `@neondatabase/serverless`, Python 3.12+ (FastAPI, onnxruntime, numpy for serving; + xgboost, scikit-learn, pandas, skl2onnx/onnxmltools, shap for training only, which never deploys).

## 4. Data model (Postgres, via Drizzle)

- **`transactions`** — `id uuid pk` (client-supplied for idempotency), `ts timestamptz`, display metadata (`card_last4`, `merchant`, `city` — synthetic, for UI realism), `amount numeric`, `features jsonb` (the 30-dim vector), `score real null`, `top_factors jsonb null`, `decision enum('approved','review','blocked')`, `scoring_error boolean default false`, `is_fraud_truth boolean null` (ground truth from replay pool; powers "caught vs missed" analytics; UI marks it as known-only-in-simulation), `model_version text`, `created_at`.
- **`cases`** — `id`, `transaction_id fk unique`, `status enum('open','resolved')`, `resolution enum('analyst_approved','analyst_blocked') null`, `note text null`, `created_at`, `resolved_at null`. One case per flagged transaction; this is the audit trail and a future label source.
- **`settings`** — single row: `t_low real`, `t_high real` (`0 ≤ t_low < t_high ≤ 1`), `sim_batch_min/max int`, `sim_min_interval_seconds int`, `last_tick_at timestamptz`.
- **`models`** — `version text pk`, `trained_at`, `metrics jsonb` (PR-AUC, ROC-AUC, precision/recall table), `active boolean`. Mini model registry; the Model page reads it.
- **`replay_pool`** — held-out test rows: `id`, `features jsonb`, `amount`, `is_fraud boolean`, synthetic display metadata, `used_count int`. Seeded once by `db/seed.ts` from `ml/` output (~20k sampled legit rows + all test-set fraud rows).

**Dataset honesty note (also rendered on the Model page):** the ULB dataset's features V1–V28 are PCA-anonymized for privacy; only `Time` and `Amount` are raw. Merchant/card display fields are synthetic presentation metadata; scores are computed from the real feature vectors. Standard practice for this dataset.

## 5. ML pipeline (`ml/`, runs locally; artifacts committed)

1. **`download.py`** — fetch ULB credit-card fraud dataset (284,807 rows, 492 frauds) from OpenML (no account); validate schema/row counts; cache raw CSV locally (git-ignored).
2. **`train.py`** — **time-based 80/20 split** on `Time` (train on past, evaluate on future; prevents leakage) → XGBoost binary classifier with `scale_pos_weight` for imbalance → small, honest hyperparameter search → evaluation: PR-AUC (primary), ROC-AUC, precision/recall/F1 across a threshold sweep, confusion matrices at candidate thresholds → emits a threshold table from which default `t_low`/`t_high` are chosen and justified.
3. **`export.py`** — convert to ONNX; **parity test: ONNX vs native XGBoost predictions on 1k samples must agree within 1e-5** (catches silent conversion bugs); compute global SHAP summary offline on a sample; write `models/v1/{model.onnx, metrics.json, pr_curve.json, shap_summary.json, feature_stats.json}` (the last holds per-feature training medians used by the online sensitivity explainer).
4. **`make_replay.py`** — build replay pool from **test-set rows only** (the model never trained on them, so live scores are honest); attach deterministic synthetic display metadata (faker with fixed seed); write a compact file that `db/seed.ts` loads into Neon.

**v1 model quality gate (pipeline fails if unmet):** PR-AUC ≥ 0.80 on the future-holdout; report precision at recall ∈ {0.70, 0.75, 0.80}. Target story: precision ≥ 0.85 at recall ≈ 0.75.

**Explainability, two-tier (both shown in UI, each labeled for what it is):**

- **Global (offline, exact):** SHAP feature-importance summary computed during training; rendered on the Model page.
- **Local (online, fast approximation):** per-transaction sensitivity analysis in the Python scorer — re-score with each feature neutralized to its training median; the score drop is that feature's impact; return the top ~5 factors with direction. ~30 sub-millisecond ONNX calls per transaction. Amount gets human phrasing ("38× typical amount", relative to the training median); the dataset's `Time` feature (elapsed seconds, not clock time) is phrased generically as "unusual timing pattern"; PCA components render as "pattern component V14".

## 6. API surface

**Node routes (`app/api/*`, TypeScript):**

Ingestion (score → decide → persist txn + case, idempotent by client UUID) is a **shared server function** `lib/ingest.ts`, invoked only by the tick and burst handlers — there is deliberately no unauthenticated public ingest route that would bypass their caps/throttles.

| Route | Method | Purpose |
|---|---|---|
| `/api/feed?after=<cursor>` | GET | New transactions since cursor, for 4s live-feed polling |
| `/api/stats?window=24h` | GET | KPI aggregates + timeseries (traffic, fraud rate, score histogram) |
| `/api/transactions` | GET | Ledger: filters (decision, amount range, merchant search), cursor pagination |
| `/api/cases?status=open` | GET | Review queue, sorted by score desc |
| `/api/cases/[id]/resolve` | POST | `{resolution, note?}` → resolve case, audit timestamps |
| `/api/settings` | GET/PUT | Thresholds + simulator config; server-side validation |
| `/api/simulate/tick` | POST | Presence-driven batch ingest; server-throttled |
| `/api/simulate/burst` | POST | Demo injection incl. guaranteed high-risk rows; size-capped |
| `/api/cron/cleanup` | GET | Daily retention trim; requires `CRON_SECRET` bearer |

**Python function:** `POST /api/py/score` `{features: number[30]}` → `{probability: number, top_factors: [{feature, label, impact}]}`. Stateless; loads ONNX once per warm instance (Fluid compute reuse). `GET /api/py/health` returns model version.

## 7. Pages & UX

Dark fintech-ops-console aesthetic; shadcn/ui components; Recharts; responsive.

1. **`/` Overview** — KPI tiles (24h transactions, flagged, blocked, estimated fraud $ prevented = Σ blocked-fraud amounts), live feed (latest ~25, 4s polling, entry animation, green/amber/red by decision), score-distribution histogram, traffic + fraud-rate time chart.
2. **`/queue`** — open cases table (score desc); row click → side drawer: transaction detail, score gauge, "why flagged" factor list with directions, Approve/Block + optional note.
3. **`/transactions`** — full ledger, filters + cursor pagination, status chips, scoring-error warning chips.
4. **`/model`** — model card: active version, trained date, dataset note, PR curve, confusion matrix at current thresholds, global SHAP chart, **two threshold sliders with live preview** ("at these settings: X% auto-approved / Y% review / Z% blocked; est. precision/recall") computed from `pr_curve.json` + score histogram; Save persists to `settings`.
5. **Header** — simulator status dot (ticking/idle), "Inject fraud burst" button.

## 8. Error handling policies

- **Scorer unavailable/error:** transaction is still recorded with `decision='review'`, `scoring_error=true`, surfaced with a warning chip. Policy: never silently approve, never auto-block without a score. (Fail-safe routing to humans.)
- **Atomicity:** transaction + case inserted in a single DB transaction; no orphan cases.
- **Idempotency:** ingest keyed by client UUID; retries return the existing row (safe for tick retries/double-clicks).
- **Throttling/abuse:** tick server-throttled via `last_tick_at`; burst size-capped; cleanup requires `CRON_SECRET`.
- **Validation:** settings validated server-side (`0 ≤ t_low < t_high ≤ 1`, sane simulator bounds) → 400 on violation.
- **UI resilience:** feed polling backs off on failure with a "reconnecting" indicator; case resolution uses optimistic update with rollback on error.
- **Model load failure (Python):** `/api/py/score` returns 503; ingest takes the fail-safe path.

## 9. Testing

- **ML (pytest, run with pipeline):** dataset schema check; leakage guard (`max(train.Time) < min(test.Time)`); metric floor (fail if PR-AUC < 0.80); ONNX↔native parity (≤1e-5 on 1k rows).
- **Decision engine (vitest):** threshold routing incl. boundary values (`score == t_low`, `== t_high`) and fail-safe path.
- **API integration (vitest):** ingest happy path + idempotent replay; case resolve; settings validation (against a dedicated test database).
- **E2E smoke (Playwright, minimal):** dashboard loads → burst → new rows appear → open queue → resolve a case.
- **Entry points:** `pnpm verify` = lint + typecheck + vitest; `pytest ml/` for the ML suite; `pnpm test:e2e` for Playwright (separate — needs a running dev server).

## 10. Deployment & environments

- **Vercel** (Hobby): Next.js + Python function, one project. Daily cleanup cron in `vercel.json`. Deploy requires a one-time `vercel login` by the owner.
- **Neon Postgres** via Vercel Marketplace (free tier); `DATABASE_URL` auto-wired; drizzle migrations + `db/seed.ts` run once against it.
- **Env vars:** `DATABASE_URL`, `CRON_SECRET`. Local dev uses `.env.local`.
- **Local dev:** `pnpm dev` runs Next.js and uvicorn concurrently; `next.config` rewrites `/api/py/*` → `http://127.0.0.1:8000` in dev.
- **Retention:** cleanup keeps last ~7 days of transactions.

## 11. Deliverables

1. Working local app (dev mode) with seeded database and trained model.
2. Live Vercel URL (after owner login).
3. `README.md`: architecture diagram, metrics table with the real numbers, screenshots, run instructions, design-decision rationale, suggested resume bullets.
4. This spec + implementation plan under `docs/superpowers/`.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Python function bundle exceeds Vercel limits | Serving deps are only fastapi+onnxruntime+numpy (well under limit). Fallback: score in Node via `onnxruntime-node`, keep sensitivity logic in TS. |
| OpenML unavailable | Dataset also mirrored on Hugging Face; `download.py` supports a fallback URL. |
| Hobby cron limits (daily only) | Presence-driven simulator (designed in, §3). |
| PR-AUC gate not met on first train | Threshold/hyperparameter iteration is scripted; gate is realistic for XGBoost on this dataset (typically 0.80–0.87 with time split). |
| Neon free-tier storage | Daily retention trim; replay pool ~20k rows is tiny. |

## 13. Stretch (post-v1, explicitly out of scope now)

Drift-monitoring page (score distribution shift vs training), retrain-from-analyst-labels flow, auth (Clerk), SSE instead of polling, model A/B threshold experiments.

## 14. Decision log

- **All-on-Vercel** over split FastAPI service — user choice (simplest path to a permanent live URL).
- **Presence-driven simulator** over per-minute cron — Hobby cron is daily-only; also a better story.
- **ONNX serving** over shipping xgboost — dependency size, cold-start, and a deliberate train/serve separation.
- **Two-tier explainability** — exact SHAP offline (global), fast sensitivity online (local); honest labeling of each.
- **Drizzle + Neon serverless driver** — type-safe schema as code, standard modern Vercel pairing.
- **Polling (4s) over SSE/WebSockets for v1** — serverless-friendly, simpler failure modes; SSE is stretch.
- **Replay from held-out test set only** — live demo scores are statistically honest.
