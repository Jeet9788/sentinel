# Sentinel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Sentinel — a real-time payment fraud detection platform (trained XGBoost model → ONNX scoring API → decision engine → live ops console) deployed on Vercel with Neon Postgres, per the approved spec at `docs/superpowers/specs/2026-07-13-sentinel-fraud-platform-design.md`.

**Architecture:** One monorepo, one Vercel project. Next.js (App Router, TS) serves the UI and Node API routes; a Python FastAPI function (`api/index.py`, reached via `/api/py/*` rewrites) serves ONNX model inference + per-transaction explanations. A local Python pipeline (`ml/`) trains the model and emits committed artifacts. Postgres via Drizzle ORM — PGlite (embedded) locally, Neon in production, selected by `DATABASE_URL` presence.

**Tech Stack:** Next.js 15+ (create-next-app latest), TypeScript, Tailwind + shadcn/ui, Recharts, Drizzle ORM + drizzle-kit, @neondatabase/serverless, @electric-sql/pglite, Vitest, Playwright, Python 3.11+ (xgboost, scikit-learn, pandas, onnxmltools for training; fastapi, onnxruntime, numpy for serving), pnpm, Vercel.

## Global Constraints

- Spec is authoritative: `docs/superpowers/specs/2026-07-13-sentinel-fraud-platform-design.md`. Re-read the relevant spec section before each task.
- **Feature order is canonical everywhere** (TS, Python, JSON, DB): `["V1","V2",...,"V28","Amount"]` — **29 features**, exactly this order. `Time` is NOT a feature (it cannot generalize across a chronological split; see spec §4 and `ml/common.py`). Anywhere this plan says 30, read 29.
- **Money is stored as integer cents** (`amount_cents`); formatted only at display time.
- Model quality gate: **PR-AUC (average precision) ≥ 0.80 on the future holdout** — the pipeline test fails otherwise.
- ONNX↔native parity: max abs probability diff ≤ 1e-5 on 1,000 sampled rows.
- Decision routing: `score < t_low` → `approved`; `t_low ≤ score < t_high` → `review`; `score ≥ t_high` → `blocked`. Constraint `0 ≤ t_low < t_high ≤ 1`.
- Fail-safe: scoring failure → record transaction with `decision='review'`, `scoring_error=true`. Never silently approve; never auto-block without a score.
- Ingest is idempotent by client-supplied UUID; txn + case insert is atomic (one DB transaction).
- No public unauthenticated ingest route — only `simulate/tick` (server-throttled) and `simulate/burst` (size-capped) create transactions; `cron/cleanup` requires `CRON_SECRET`.
- API JSON uses camelCase. All app API routes are dynamic (`export const dynamic = 'force-dynamic'`).
- Serving Python deps (root `requirements.txt`) are ONLY `fastapi`, `onnxruntime`, `numpy`. Training deps live in `ml/requirements.txt` and never deploy.
- Commit after every task (message prefix `feat:`/`test:`/`chore:`; end body with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`).
- Execution environment is Windows; run commands through the Bash tool (Git Bash). Python is invoked as `python`.
- UI work: load the `dataviz` skill before any chart code and `frontend-design:frontend-design` before the app shell. Dark fintech-ops-console aesthetic.

## File Structure (locked)

```
app/                        # Next.js App Router
  layout.tsx  page.tsx (Overview)  queue/page.tsx
  transactions/page.tsx  model/page.tsx  globals.css
  api/feed/route.ts  api/stats/route.ts  api/transactions/route.ts
  api/cases/route.ts  api/cases/[id]/resolve/route.ts
  api/settings/route.ts  api/simulate/tick/route.ts
  api/simulate/burst/route.ts  api/cron/cleanup/route.ts
components/                 # nav, kpi-tiles, live-feed, charts/, queue/, model/
lib/
  features.ts  decision.ts  scorer.ts  ingest.ts  replay.ts
  stats.ts  threshold-preview.ts  format.ts
  db/schema.ts  db/index.ts  db/migrate.ts  db/seed.ts
api/                        # Python (Vercel function)
  __init__.py  index.py  explain.py  _model/{model.onnx,feature_stats.json}
ml/
  requirements.txt  common.py  download.py  train.py  export.py  make_replay.py
  tests/test_pipeline.py
models/v1/                  # committed artifacts (onnx + json)
db/replay_pool.jsonl.gz     # committed seed data
drizzle/                    # generated SQL migrations
tests/  decision.test.ts  threshold-preview.test.ts  api.test.ts
e2e/    smoke.spec.ts
requirements.txt  next.config.ts  vercel.json  drizzle.config.ts  vitest.config.ts  playwright.config.ts
```

---

### Task 0: Environment audit + scaffold

**Files:** Create: Next app at repo root via create-next-app, `.gitignore` additions, `package.json` scripts, `requirements.txt`, `ml/requirements.txt`.

**Interfaces — Produces:** working `pnpm dev` (Next only, for now), `python` ≥3.11 with ml deps installed, pnpm available.

- [ ] **Step 1: Audit tools.** Run: `node -v; python --version; git --version; pnpm -v || npm -v`. Need Node ≥20 and Python ≥3.11. If pnpm missing: `corepack enable && corepack prepare pnpm@latest --activate` (fallback: `npm i -g pnpm`). **If Node or Python is missing entirely, STOP and surface to the user — that's an install only they can decide on.**
- [ ] **Step 2: Scaffold Next.js in place** (dir already has `docs/` + `.git`; create-next-app refuses non-empty dirs — scaffold to temp and move):

```bash
cd /c/dev && npx --yes create-next-app@latest sentinel-tmp --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --turbopack --use-pnpm --yes
# move everything incl. dotfiles except .git
shopt -s dotglob; mv /c/dev/sentinel-tmp/* /c/dev/folder/ 2>/dev/null; rmdir /c/dev/sentinel-tmp
```

If the scaffolder's `.gitignore` collides, merge manually. Set `"name": "sentinel"` in package.json.
- [ ] **Step 3: Add deps.**

```bash
pnpm add drizzle-orm @neondatabase/serverless @electric-sql/pglite recharts zod
pnpm add -D drizzle-kit vitest @vitejs/plugin-react concurrently @playwright/test tsx @types/node
```

- [ ] **Step 4: shadcn init + components.** `npx --yes shadcn@latest init -d` then `npx --yes shadcn@latest add button card table badge sheet slider input textarea tabs tooltip sonner separator skeleton`.
- [ ] **Step 5: Python deps.** Create `requirements.txt` (root): `fastapi`, `onnxruntime`, `numpy`, `uvicorn` (uvicorn is dev-only but harmless). Create `ml/requirements.txt`: `xgboost`, `scikit-learn`, `pandas`, `numpy`, `onnxmltools`, `onnx`, `onnxruntime`, `pytest`. Install both: `python -m pip install -r requirements.txt -r ml/requirements.txt`.
- [ ] **Step 6: Scripts + gitignore.** In `package.json` set:

```json
"scripts": {
  "dev": "concurrently -k \"next dev\" \"python -m uvicorn api.index:app --port 8000\"",
  "dev:next": "next dev",
  "build": "next build",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "verify": "pnpm lint && pnpm typecheck && pnpm test",
  "test:e2e": "playwright test",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx lib/db/migrate.ts",
  "db:seed": "tsx lib/db/seed.ts",
  "ml:all": "python ml/download.py && python ml/train.py && python ml/export.py && python ml/make_replay.py"
}
```

Append to `.gitignore`: `.data/`, `ml/data/`, `__pycache__/`, `.venv/`, `.vercel`, `.env*`, `test-results/`, `playwright-report/`.
- [ ] **Step 7: Verify.** `pnpm dev:next` starts and http://localhost:3000 renders the starter page (curl 200). Kill it.
- [ ] **Step 8: Commit.** `chore: scaffold Next.js app with deps and tooling`

---

### Task 1: ML — download + dataset validation

**Files:** Create `ml/common.py`, `ml/download.py`, `ml/tests/test_pipeline.py` (first tests).

**Interfaces — Produces:** `ml/common.py`: `FEATURE_NAMES: list[str]` (30, canonical order), `RAW_CSV = ml/data/creditcard.csv`, `load_raw() -> pd.DataFrame` (returns validated df with columns FEATURE_NAMES + `Class`). `download.py` is idempotent (skips if cached).

- [ ] **Step 1: Write failing tests** in `ml/tests/test_pipeline.py`:

```python
import pandas as pd
from ml.common import FEATURE_NAMES, load_raw

def test_feature_names_canonical():
    assert FEATURE_NAMES == ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]
    assert len(FEATURE_NAMES) == 30

def test_raw_dataset_shape():
    df = load_raw()
    assert list(df.columns) == FEATURE_NAMES + ["Class"]
    assert len(df) == 284807
    assert int(df["Class"].sum()) == 492
    assert df.isna().sum().sum() == 0
```

Run `python -m pytest ml/tests -v` → fails (module missing). Note: run pytest from repo root; add `ml/__init__.py` and `ml/tests/__init__.py` so `ml.common` imports.
- [ ] **Step 2: Implement.** `ml/common.py`: constants + `load_raw()` reading `ml/data/creditcard.csv` (raise with hint to run download.py if absent), dtype float for features, int for Class. `ml/download.py`:

```python
"""Fetch the ULB credit-card fraud dataset (OpenML id 1597) to ml/data/creditcard.csv."""
import os, pathlib
import pandas as pd
from sklearn.datasets import fetch_openml
from common import FEATURE_NAMES  # when run as script; tests import ml.common

OUT = pathlib.Path(__file__).parent / "data" / "creditcard.csv"

def main():
    if OUT.exists():
        print(f"cached: {OUT}"); return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    url = os.environ.get("SENTINEL_DATA_URL")
    if url:  # manual fallback: any CSV with the same columns
        df = pd.read_csv(url)
    else:
        bunch = fetch_openml(data_id=1597, as_frame=True, parser="auto")
        df = bunch.frame.rename(columns={"class": "Class"})
        df["Class"] = df["Class"].astype(str).str.strip("'\"").astype(int)
    df = df[FEATURE_NAMES + ["Class"]]
    df.to_csv(OUT, index=False)
    print(f"wrote {OUT} rows={len(df)} frauds={int(df.Class.sum())}")

if __name__ == "__main__":
    main()
```

Handle the import dual-mode (script vs package) with a try/except import at top of each ml script: `try: from ml.common import ... except ImportError: from common import ...`.
- [ ] **Step 3: Run** `python ml/download.py` (takes a minute; ~150MB memory). Then `python -m pytest ml/tests -v` → both PASS.
- [ ] **Step 4: Commit** (`ml/data/` is gitignored): `feat: ML data download with dataset validation`

---

### Task 2: ML — train.py (time split, XGBoost, gate)

**Files:** Create `ml/train.py`; extend `ml/common.py` and `ml/tests/test_pipeline.py`.

**Interfaces — Produces:** `common.py`: `time_split(df, train_frac=0.8) -> (train, test)` (split on `Time` quantile), `MODELS_DIR = models/v1`. `train.py` writes `ml/data/model.json` (xgboost native), `models/v1/metrics.json`, `models/v1/pr_curve.json`. Shapes:
- `metrics.json`: `{version:"v1", trainedAt: iso, dataset:{rows,frauds,trainRows,testRows,testFrauds,splitTime}, prAuc: float, rocAuc: float, params: {...}, suggested:{tLow: float, tHigh: float}, thresholdTable:[{threshold,precision,recall,flaggedRate}] (~20 rows)}`
- `pr_curve.json`: `[{threshold,precision,recall,flaggedRate}]` (~200 rows, threshold ascending).

- [ ] **Step 1: Failing tests** (append):

```python
def test_time_split_no_leakage():
    df = load_raw(); train, test = time_split(df)
    assert train["Time"].max() < test["Time"].min()
    assert abs(len(train) / len(df) - 0.8) < 0.01

def test_metrics_gate():
    m = json.loads((MODELS_DIR / "metrics.json").read_text())
    assert m["prAuc"] >= 0.80
    assert 0 <= m["suggested"]["tLow"] < m["suggested"]["tHigh"] <= 1

def test_pr_curve_shape():
    curve = json.loads((MODELS_DIR / "pr_curve.json").read_text())
    assert len(curve) >= 100
    assert all(set(r) == {"threshold","precision","recall","flaggedRate"} for r in curve[:5])
```

- [ ] **Step 2: Implement `train.py`.** Logic (complete, no improvisation):
  1. `train, test = time_split(load_raw())`. Validation = last 10% of train by Time (for param pick + early stopping).
  2. Grid: `max_depth ∈ {4,6}`, `learning_rate ∈ {0.05,0.1}`; fixed `n_estimators=600, subsample=0.9, colsample_bytree=0.9, eval_metric="aucpr", early_stopping_rounds=50, scale_pos_weight=neg/pos (train), tree_method="hist", random_state=42, n_jobs=-1`. Fit `xgboost.XGBClassifier` on train-minus-val, eval on val; keep best val aucpr; then refit best params on full train (early stopping against val).
  3. `proba = model.predict_proba(test[FEATURE_NAMES])[:,1]`; `prAuc = average_precision_score`, `rocAuc = roc_auc_score`.
  4. Curve: `precision_recall_curve` → downsample to ≤200 evenly spaced thresholds; add `flaggedRate = (proba >= t).mean()` per row.
  5. Suggested thresholds from the curve: `tHigh` = smallest threshold with precision ≥ 0.95 (fallback 0.9 if none); `tLow` = largest threshold with recall ≥ 0.90 (fallback 0.5·tHigh). Enforce `tLow < tHigh` (if violated, set `tLow = tHigh/2`) and round to 3 decimals.
  6. Save xgboost native `model.save_model("ml/data/model.json")`; write both JSON artifacts; print a human-readable threshold table.
- [ ] **Step 3: Run** `python ml/train.py` (expect 1–4 min CPU). Inspect printed table. Run `python -m pytest ml/tests -v` → PASS incl. gate. **If prAuc < 0.80:** first check the split/labels for bugs, then widen grid (`max_depth 8`, `n_estimators 1000`); if still short, report the honest number to the user before proceeding — do not weaken the test.
- [ ] **Step 4: Commit** artifacts + code: `feat: XGBoost training pipeline with PR-AUC gate`

---

### Task 3: ML — export.py (ONNX, parity, SHAP, stats)

**Files:** Create `ml/export.py`; extend tests. Outputs: `models/v1/model.onnx`, `models/v1/feature_stats.json`, `models/v1/shap_summary.json`, copies `model.onnx` + `feature_stats.json` → `api/_model/`.

**Interfaces — Produces:**
- `feature_stats.json`: `{order: FEATURE_NAMES, medians: {name: float}, amountMedian: float}` (medians over TRAIN split only).
- `shap_summary.json`: `[{feature: str, meanAbsContrib: float}]` all 30, sorted desc — from `booster.predict(dm, pred_contribs=True)` on ≤5000 test rows (drop bias column).
- `model.onnx`: input name `input`, `float32[None,30]`; probability of class 1 read from output `probabilities[:,1]` (zipmap disabled).

- [ ] **Step 1: Failing tests** (append):

```python
def test_onnx_parity():
    import onnxruntime as ort, xgboost as xgb, numpy as np
    df = load_raw(); _, test = time_split(df)
    sample = test.sample(1000, random_state=0)[FEATURE_NAMES].to_numpy(np.float32)
    clf = xgb.XGBClassifier(); clf.load_model("ml/data/model.json")
    native = clf.predict_proba(sample)[:, 1]
    sess = ort.InferenceSession(str(MODELS_DIR / "model.onnx"))
    onnx_p = sess.run(None, {"input": sample})[1][:, 1]  # adjust index to probabilities output
    assert np.max(np.abs(native - onnx_p)) <= 1e-5

def test_feature_stats():
    s = json.loads((MODELS_DIR / "feature_stats.json").read_text())
    assert s["order"] == FEATURE_NAMES and len(s["medians"]) == 30

def test_shap_summary():
    rows = json.loads((MODELS_DIR / "shap_summary.json").read_text())
    assert len(rows) == 30 and rows[0]["meanAbsContrib"] >= rows[-1]["meanAbsContrib"]
```

- [ ] **Step 2: Implement `export.py`:** load model.json into XGBClassifier; convert via `onnxmltools.convert_xgboost(clf, initial_types=[("input", FloatTensorType([None, 30]))], target_opset=...default)` with `options={id(clf): {"zipmap": False}}` if supported through convert API — if the options route fails, convert then verify output structure at runtime and adapt the session output indexing in one place (`get_prob(outputs)` helper used by tests and serving docs). Compute medians on train split; SHAP via `clf.get_booster().predict(xgb.DMatrix(sample), pred_contribs=True)` → `mean(|contrib|)` per feature (exclude last bias column). Write artifacts; `shutil.copy` onnx + feature_stats into `api/_model/` (mkdir).
- [ ] **Step 3: Run** `python ml/export.py` then full `python -m pytest ml/tests -v` → PASS.
- [ ] **Step 4: Commit**: `feat: ONNX export with parity test, SHAP summary, feature stats`

---

### Task 4: ML — make_replay.py (replay pool)

**Files:** Create `ml/make_replay.py`; extend tests. Output: `db/replay_pool.jsonl.gz` (committed).

**Interfaces — Produces:** gzipped JSONL, one object per line:
`{"features": [30 floats], "amountCents": int, "isFraud": bool, "cardLast4": "4821", "merchant": "Prime Mart", "city": "Austin"}`
Contents: **test-split rows only** — all test frauds + 15,000 sampled test legits, shuffled (seed 42). Display metadata is deterministic: pick from curated lists (≥40 merchants, ≥25 cities in the script) by `hash = row_index * 2654435761 % 2**32`; `cardLast4 = f"{hash % 10000:04d}"`.

- [ ] **Step 1: Failing test** (append):

```python
def test_replay_pool():
    import gzip
    rows = [json.loads(l) for l in gzip.open("db/replay_pool.jsonl.gz", "rt")]
    assert 15000 <= len(rows) <= 16000
    frauds = [r for r in rows if r["isFraud"]]
    assert len(frauds) >= 80          # all test-split frauds present
    r = rows[0]
    assert len(r["features"]) == 30 and isinstance(r["amountCents"], int)
    assert set(r) == {"features","amountCents","isFraud","cardLast4","merchant","city"}
```

- [ ] **Step 2: Implement** (`amountCents = round(Amount*100)`; features as plain floats list in FEATURE_NAMES order). Run script, run tests → PASS.
- [ ] **Step 3: Run the whole pipeline once from scratch to prove reproducibility:** `pnpm ml:all` then `python -m pytest ml/tests -v` → all PASS.
- [ ] **Step 4: Commit** incl. `db/replay_pool.jsonl.gz`: `feat: replay pool builder from held-out test split`

---

### Task 5: Python scoring function (FastAPI + ONNX + explanations)

**Files:** Create `api/__init__.py` (empty), `api/index.py`, `api/explain.py`, `ml/tests/test_api.py`.

**Interfaces — Produces (consumed by lib/scorer.ts and prod):**
- `POST /api/py/score` body `{"features": [30 numbers]}` → 200 `{"probability": float, "modelVersion": "v1", "topFactors": [{"feature": "V14", "label": "pattern component V14", "impact": float, "direction": "up"|"down"}] (≤5, sorted by |impact| desc)}`; 400 `{"detail": ...}` if features missing/wrong length; 503 if model failed to load.
- `GET /api/py/health` → `{"status":"ok","modelVersion":"v1"}`.

- [ ] **Step 1: Failing tests** `ml/tests/test_api.py` using `fastapi.testclient.TestClient`:

```python
from fastapi.testclient import TestClient
from api.index import app
client = TestClient(app)

def test_health():
    r = client.get("/api/py/health")
    assert r.status_code == 200 and r.json()["modelVersion"] == "v1"

def test_score_legit_and_fraud():
    import gzip, json
    rows = [json.loads(l) for l in gzip.open("db/replay_pool.jsonl.gz", "rt")]
    fraud = next(r for r in rows if r["isFraud"]); legit = next(r for r in rows if not r["isFraud"])
    pf = client.post("/api/py/score", json={"features": fraud["features"]}).json()
    pl = client.post("/api/py/score", json={"features": legit["features"]}).json()
    assert 0 <= pl["probability"] <= 1 and 0 <= pf["probability"] <= 1
    assert len(pf["topFactors"]) == 5 and {"feature","label","impact","direction"} <= set(pf["topFactors"][0])

def test_score_validation():
    assert client.post("/api/py/score", json={"features": [1.0]*29}).status_code == 400
```

- [ ] **Step 2: Implement.** `api/explain.py`: loads `api/_model/feature_stats.json`; `top_factors(session, features: np.ndarray, p_orig: float) -> list[dict]` — for each i in 30: copy vector, set `x[i] = median[i]`, rescore (batch all 30 neutralizations into ONE `session.run` call on a `[30,30]` matrix for speed), `impact = p_orig - p_neutralized`, direction `"up" if impact > 0 else "down"`; labels: `Amount` → `f"{amount/amount_median:.1f}× typical amount"` (guard div-by-zero), `Time` → `"unusual timing pattern"`, else `f"pattern component {name}"`; return top 5 by |impact|. `api/index.py`: FastAPI app; module-level try/except loads `onnxruntime.InferenceSession("api/_model/model.onnx")` (resolve path relative to file: `Path(__file__).parent / "_model" / "model.onnx"`); pydantic body model; probability extraction via the `get_prob` output-indexing helper matching Task 3.
- [ ] **Step 3: Run** `python -m pytest ml/tests/test_api.py -v` → PASS. Also boot `python -m uvicorn api.index:app --port 8000` and `curl -s localhost:8000/api/py/health` → ok. Kill server.
- [ ] **Step 4: Commit**: `feat: FastAPI ONNX scoring function with sensitivity explanations`

---

### Task 6: DB layer (Drizzle schema, driver switch, migrate, seed)

**Files:** Create `lib/db/schema.ts`, `lib/db/index.ts`, `lib/db/migrate.ts`, `lib/db/seed.ts`, `drizzle.config.ts`; generate `drizzle/0000_*.sql`.

**Interfaces — Produces:**
- Tables (exact Drizzle names): `transactions(id uuid pk, seq bigserial unique, ts timestamptz notNull, cardLast4 varchar(4), merchant text, city text, amountCents integer notNull, features jsonb $type<number[]> notNull, score real, topFactors jsonb $type<TopFactor[]>, decision decisionEnum notNull, scoringError boolean notNull default false, isFraudTruth boolean, modelVersion text notNull, createdAt timestamptz default now)` with indexes on `createdAt`, `decision`; `cases(id uuid pk defaultRandom, transactionId uuid fk→transactions.id onDelete cascade, unique, status caseStatusEnum default 'open', resolution resolutionEnum, note text, createdAt default now, resolvedAt)` index on `status`; `settings(id integer pk, tLow real, tHigh real, simBatchMin integer, simBatchMax integer, simMinIntervalSeconds integer, lastTickAt timestamptz)`; `models(version text pk, trainedAt timestamptz, metrics jsonb, active boolean)`; `replayPool(id integer pk generatedAlwaysAsIdentity, features jsonb notNull, amountCents integer notNull, isFraud boolean notNull, cardLast4 varchar(4), merchant text, city text, usedCount integer default 0)`.
- Enums: `decision: approved|review|blocked`; `case_status: open|resolved`; `resolution: analyst_approved|analyst_blocked`.
- `lib/db/index.ts` exports `db` (drizzle instance; **Neon `drizzle-orm/neon-serverless` Pool when `DATABASE_URL` set, else PGlite** at dir `process.env.PGLITE_DIR ?? '.data/pglite'`, with `memory://` supported for tests) and `export type DB = typeof db`. Both drivers support `db.transaction()`.
- `migrate.ts` runs the right migrator for the active driver (`drizzle-orm/neon-serverless/migrator` or `drizzle-orm/pglite/migrator`) against `./drizzle`.
- `seed.ts`: idempotent (upserts): settings row id=1 from `models/v1/metrics.json` `suggested` (+ `simBatchMin=3,simBatchMax=8,simMinIntervalSeconds=15`); `models` row v1 (active) with metrics json; streams `db/replay_pool.jsonl.gz` into `replayPool` in batches of 500 (skip if table already has rows). Prints counts.

- [ ] Step 1: Write `schema.ts` exactly as above; `drizzle.config.ts` (dialect postgresql, schema path, out `./drizzle`). Run `pnpm db:generate` → SQL file appears.
- [ ] Step 2: Write `index.ts`, `migrate.ts`, `seed.ts`. Run `pnpm db:migrate && pnpm db:seed` (PGlite). Expected output: `replay_pool: ~15.1k rows, settings: 1, models: 1`.
- [ ] Step 3: Sanity query via `tsx -e` snippet selecting counts through `db` to confirm the driver switch reads the same data. 
- [ ] Step 4: Commit: `feat: drizzle schema, dual-driver db, migrations and seed`

---

### Task 7: Decision engine + scorer client + ingest (core logic, TDD)

**Files:** Create `lib/features.ts`, `lib/decision.ts`, `lib/scorer.ts`, `lib/ingest.ts`, `tests/decision.test.ts`, `tests/ingest.test.ts`, `vitest.config.ts`.

**Interfaces — Produces:**
- `lib/features.ts`: `export const FEATURE_NAMES = ["Time","V1",...,"V28","Amount"] as const;`
- `lib/decision.ts`: `export type Decision = 'approved'|'review'|'blocked'; export function decide(score: number, t: {tLow: number; tHigh: number}): Decision` — boundaries per Global Constraints; throws `RangeError` on invalid thresholds or score outside [0,1].
- `lib/scorer.ts`: `export type TopFactor = {feature: string; label: string; impact: number; direction: 'up'|'down'}; export type ScoreResult = {probability: number; modelVersion: string; topFactors: TopFactor[]}; export async function scoreTransaction(features: number[]): Promise<ScoreResult>` — POSTs `${base}/api/py/score` where base = `process.env.PY_SCORER_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://127.0.0.1:8000')`; 3s timeout via AbortSignal; non-200 → throw.
- `lib/ingest.ts`: `export type IngestInput = {id?: string; features: number[]; amountCents: number; cardLast4: string; merchant: string; city: string; isFraudTruth?: boolean | null; ts?: Date}; export async function ingestTransaction(input: IngestInput): Promise<{id: string; seq: number; score: number | null; decision: Decision; scoringError: boolean}>` — flow: if `input.id` exists in DB return existing row's result (idempotency); read settings; `try score = await scoreTransaction(...)` catch → score null; decision = score === null ? 'review' : decide(score, t); insert txn — plus a case row **only when decision === 'review'** (spec: one case per flagged transaction; auto-blocked rows get no case) — in ONE `db.transaction`; `scoringError = score === null`.

- [ ] **Step 1 (TDD decide):** write `tests/decision.test.ts` covering: below/between/above, exact boundaries (`decide(0.2,{tLow:0.2,tHigh:0.8})==='review'`, `decide(0.8,...)==='blocked'`), invalid thresholds throw, score 0 and 1 valid. Run `pnpm vitest run tests/decision.test.ts` → fail → implement `decision.ts` → pass.
- [ ] **Step 2 (TDD ingest):** `tests/ingest.test.ts` with `vi.mock('@/lib/scorer')`; env `PGLITE_DIR='memory://'`; `beforeAll`: run migrator + insert settings row (tLow .2 tHigh .8). Cases: (a) low score → approved, no case row; (b) mid → review + case open; (c) high → blocked, no case; (d) scorer throws → review + scoringError true; (e) same id twice → single row, same result returned. Implement `ingest.ts` (+ trivial `features.ts`, `scorer.ts`) to green. `vitest.config.ts`: node environment, alias `@` → root, `include: ['tests/**/*.test.ts']`.
- [ ] **Step 3:** `pnpm test` all green. Commit: `feat: decision engine and idempotent fail-safe ingest`

---

### Task 8: App API routes (tick, burst, feed, stats, transactions, cases, settings)

**Files:** Create `lib/replay.ts`, `lib/stats.ts`, all `app/api/**/route.ts` except cron; `tests/api.test.ts`.

**Interfaces — Produces (all JSON, camelCase; TxnView = txn row minus features, plus `amount` dollars derived `amountCents/100`):**
- `lib/replay.ts`: `drawBatch(opts: {n: number; forceFrauds?: number}): Promise<IngestInput[]>` — random rows from replayPool (`sql\`ORDER BY random()\``), ensures `forceFrauds` fraud rows when asked (fetch frauds separately), increments usedCount, maps to IngestInput with fresh `crypto.randomUUID()` + `ts: new Date()` and `isFraudTruth` from pool.
- `POST /api/simulate/tick` → atomically claim: `UPDATE settings SET last_tick_at = now() WHERE id=1 AND (last_tick_at IS NULL OR last_tick_at < now() - make_interval(secs => sim_min_interval_seconds)) RETURNING *`; no row → `{skipped:true}`; else ingest batch of random(simBatchMin..Max) with fraud row at p=0.15 → `{skipped:false, ingested:n}`.
- `POST /api/simulate/burst` → 10 rows (3 forced frauds), size cap only per spec (no throttle) → `{ingested:10}`.
- `GET /api/feed?after=<seq>` → `{items: TxnView[] (seq > after, order seq asc, limit 50), cursor: maxSeq}`; `after` optional (default: latest 25, order seq desc then reversed).
- `GET /api/stats` → `{kpis: {txns24h, flagged24h, blocked24h, fraudPreventedCents (Σ amountCents where decision='blocked' and isFraudTruth), openCases}, traffic: [{hour: iso, count, frauds}] (24 buckets via date_trunc), histogram: [{bucket: 0.05*i, count}] (20 buckets over score, 24h)}` implemented in `lib/stats.ts` with raw `sql` aggregates.
- `GET /api/transactions?decision=&q=&cursor=&limit=` → `{items: TxnView[], nextCursor: number|null}` (seq desc pagination; `q` matches merchant ILIKE or cardLast4).
- `GET /api/cases?status=open|resolved` → `{items: [{...case, transaction: TxnView & {topFactors}}]}` ordered score desc.
- `POST /api/cases/[id]/resolve` body `{resolution: 'analyst_approved'|'analyst_blocked', note?}` → 200 updated case; 404 unknown; 409 already resolved.
- `GET/PUT /api/settings` — PUT validates with zod: `0 ≤ tLow < tHigh ≤ 1`, batch 1..20, interval 5..300 → 400 otherwise.

- [ ] Step 1: Failing integration tests in `tests/api.test.ts` (mock scorer as in Task 7; memory PGlite; seed settings + a few replayPool rows inline): tick ingests then immediate second tick skips; burst ingests 10 with ≥3 truth-frauds; feed cursor returns only newer; resolve happy + 409 on repeat; settings PUT rejects `tLow ≥ tHigh`. Call route handlers directly: `const res = await POST(new Request('http://x/api/simulate/tick', {method:'POST'}))`.
- [ ] Step 2: Implement lib + routes (each route: `export const dynamic='force-dynamic'`, try/catch → 500 json, zod-validate inputs). Run `pnpm test` → green.
- [ ] Step 3: Manual smoke: `pnpm dev` (both servers), `curl -X POST localhost:3000/api/simulate/burst`, then `curl localhost:3000/api/feed` shows 10 scored rows with real probabilities; `curl localhost:3000/api/stats` sane. Kill.
- [ ] Step 4: Commit: `feat: simulator, feed, stats, cases, settings API routes`

---

### Task 9: Cron cleanup + vercel.json + next.config rewrites

**Files:** Create `app/api/cron/cleanup/route.ts`, `vercel.json`; modify `next.config.ts`.

**Interfaces — Produces:** `GET /api/cron/cleanup` with header `authorization: Bearer ${CRON_SECRET}` → deletes transactions with `createdAt < now()-'7 days'` (cases cascade) → `{deleted:n}`; 401 without/with wrong secret (when `CRON_SECRET` env set; if unset — local dev — allow and note it). `vercel.json`: `{"crons":[{"path":"/api/cron/cleanup","schedule":"0 3 * * *"}]}`. `next.config.ts` rewrites:

```ts
async rewrites() {
  return [{ source: "/api/py/:path*",
    destination: process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:8000/api/py/:path*" : "/api/" }];
}
```

- [ ] Step 1: Test (append to api.test.ts): with `process.env.CRON_SECRET='x'`, request without header → 401; with header → 200 and old seeded txn gone, fresh txn retained.
- [ ] Step 2: Implement; `pnpm test` green; verify dev rewrite: with `pnpm dev` running, `curl localhost:3000/api/py/health` → `{"status":"ok"...}` (proves the rewrite chain the UI will use).
- [ ] Step 3: Commit: `feat: retention cron and python rewrite config`

---

### Task 10: UI shell + Overview page

**REQUIRED SUB-SKILLS before writing code:** `frontend-design:frontend-design` (shell aesthetic) and `dataviz` (all charts).

**Files:** Modify `app/layout.tsx`, `app/globals.css`, `app/page.tsx`; create `components/nav.tsx`, `components/kpi-tiles.tsx`, `components/live-feed.tsx`, `components/charts/traffic-chart.tsx`, `components/charts/score-histogram.tsx`, `components/use-poll.ts`, `lib/format.ts`.

**Interfaces — Consumes:** `/api/feed`, `/api/stats`, `/api/simulate/tick`, `/api/simulate/burst`. **Produces:** `usePoll<T>(url: string, ms: number): {data: T | undefined; error: boolean}` (SWR-style interval fetch with backoff ×2 up to 60s on failure, resets on success — powers the "reconnecting" chip); `lib/format.ts`: `fmtMoney(cents: number): string` (`$1,234.56`), `fmtScore(s: number | null): string` (`0.94`/`—`), `timeAgo(iso: string): string`.

Page behavior (complete contract):
- `layout.tsx`: dark theme root (`<html className="dark">`), left sidebar nav (Overview/Queue/Transactions/Model + Sentinel wordmark), header bar with simulator status dot (green pulse when last tick < 60s ago — derive from feed freshness) and **"Inject fraud burst"** button (POST burst, sonner toast "10 transactions injected"). Sidebar active-route highlight.
- **Presence-driven ticking lives here:** a client component in the layout runs `POST /api/simulate/tick` every 20s while any page is open (`setInterval` + on-mount call). So *every* page keeps the demo alive.
- `page.tsx` (Overview): 4 KPI tiles from `/api/stats` (poll 10s): 24h transactions, flagged (amber), blocked (red), fraud prevented (green, fmtMoney); live feed table (poll `/api/feed` 4s with cursor accumulation, cap 25 rows, newest first, row flash animation on entry via CSS `@keyframes` on mount, decision Badge colors: approved=muted-green outline, review=amber, blocked=red); traffic area chart (24h, count + fraud overlay) and score histogram (bar, 20 buckets) — Recharts, styled per dataviz skill.
- Empty states: skeletons while first load; "reconnecting…" chip on `error`.

- [ ] Step 1: Load both skills. Implement `use-poll.ts` + `format.ts` with unit tests (`tests/format.test.ts`: money/score/timeAgo cases; poll hook logic covered indirectly — keep hook minimal).
- [ ] Step 2: Build layout + components + page. Verify visually: `pnpm dev`, open http://localhost:3000, watch ticks populate the feed within ~20s, click burst → rows appear + toast. Take screenshot for later README use.
- [ ] Step 3: `pnpm verify` green (lint/type/test). Commit: `feat: ops console shell and live overview dashboard`

---

### Task 11: Queue page + case drawer

**Files:** Create `app/queue/page.tsx`, `components/queue/case-drawer.tsx`, `components/queue/factor-list.tsx`, `components/queue/score-gauge.tsx`.

**Interfaces — Consumes:** `GET /api/cases?status=open`, `POST /api/cases/[id]/resolve`, TopFactor type.

Behavior contract: table of open cases (poll 8s): time, card, merchant, amount, score (mono, colored by severity), "Review" button → shadcn Sheet drawer: full txn details grid; `score-gauge` (radial/arc SVG showing probability, red past current tHigh — fetch settings once); `factor-list`: top factors as rows — label, direction arrow (↑ pushed toward fraud / ↓ lowered), impact bar scaled to max |impact|; textarea note; two buttons **Approve** (analyst_approved) / **Block** (analyst_blocked) → optimistic removal from table, toast, rollback + error toast on failure; resolved 409 → refetch. Empty state: "Queue clear — no transactions awaiting review."

- [ ] Step 1: Build components/page per contract.
- [ ] Step 2: Manual verify: burst until a case appears (bursts force frauds → some route to review/blocked; if none open, temporarily raise tHigh via `curl -X PUT .../api/settings` to force review routing, then restore). Resolve one Approve and one Block; confirm rows disappear and `cases` table updated (query via tsx snippet).
- [ ] Step 3: `pnpm verify`; commit: `feat: analyst review queue with explanation drawer`

---

### Task 12: Transactions ledger page

**Files:** Create `app/transactions/page.tsx`, `components/transactions-table.tsx`.

**Interfaces — Consumes:** `GET /api/transactions?decision=&q=&cursor=`.

Contract: filter row (decision select: All/Approved/Review/Blocked; search input debounced 300ms on merchant/last4), table (time, card, merchant, city, amount, score, decision badge, scoring-error warning chip when `scoringError`), "Load more" cursor pagination appending pages; column header shows total loaded count. URL state via `useSearchParams` for decision filter (shareable).

- [ ] Step 1: Build. Step 2: Manual verify filters + pagination against seeded traffic. Step 3: `pnpm verify`; commit: `feat: filterable transaction ledger`

---

### Task 13: Model page (model card + threshold tuner)

**Files:** Create `app/model/page.tsx`, `components/model/threshold-tuner.tsx`, `components/model/pr-curve-chart.tsx`, `components/model/confusion-matrix.tsx`, `components/model/shap-chart.tsx`, `lib/threshold-preview.ts`, `tests/threshold-preview.test.ts`.

**Interfaces — Consumes:** static imports of `models/v1/{metrics,pr_curve,shap_summary}.json` (server component props), `GET/PUT /api/settings`, `GET /api/stats` (histogram). **Produces:** `previewThresholds(histogram: {bucket:number;count:number}[], curve: {threshold:number;precision:number;recall:number;flaggedRate:number}[], tLow: number, tHigh: number): {pctApproved:number; pctReview:number; pctBlocked:number; estPrecision:number; estRecall:number}` — pct* from live histogram mass below/between/above thresholds (guard: empty histogram → fall back to curve flaggedRate); est* = linear interpolation of curve at tHigh (precision) and tLow (recall).

Page contract: header card (version, trainedAt, PR-AUC + ROC-AUC stat tiles, dataset note verbatim from spec §4 honesty note); PR curve line chart with current-threshold markers; confusion matrix at current thresholds computed from `metrics.thresholdTable` nearest row (2×2 grid, TP/FP/FN/TN with labels); SHAP top-12 horizontal bar chart; **threshold tuner**: two sliders (tLow, tHigh, step 0.005, constrained tLow < tHigh), live preview line ("At these settings: 97.1% auto-approved · 2.6% review · 0.3% blocked — est. precision 0.86 / recall 0.74"), Save → PUT settings, toast, and the tuner becomes the live system config.

- [ ] Step 1 (TDD): `threshold-preview.test.ts` — interpolation correctness on a synthetic 3-point curve, histogram mass splits, empty-histogram fallback, tLow=tHigh-ish edge. Implement to green.
- [ ] Step 2: Build page + charts (dataviz skill rules). Manual verify: move sliders → preview updates; Save → subsequent bursts route per new thresholds (check feed).
- [ ] Step 3: `pnpm verify`; commit: `feat: model card page with live threshold tuning`

---

### Task 14: E2E smoke + full verification pass

**Files:** Create `playwright.config.ts`, `e2e/smoke.spec.ts`.

- [ ] Step 1: `pnpm exec playwright install chromium`. Config: `webServer: {command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120000}` (dev = next + uvicorn via concurrently), `use: {baseURL}`.
- [ ] Step 2: `e2e/smoke.spec.ts`: (1) Overview loads — KPI tiles visible; (2) click "Inject fraud burst" → within 10s the live feed has ≥1 new row and ≥1 `blocked`/`review` badge; (3) navigate Queue → if a case row exists, open drawer, click Block, expect toast and row removal; (4) Model page renders PR-AUC number. Run `pnpm test:e2e` → PASS.
- [ ] Step 3: Full gate: `pnpm verify && python -m pytest ml -v && pnpm test:e2e` all green. Fix anything honestly (systematic-debugging skill if needed).
- [ ] Step 4: Commit: `test: end-to-end smoke suite`

---

### Task 15: README + screenshots

**Files:** Create `README.md`, `docs/screenshots/*.png` (via Playwright `page.screenshot` on Overview, Queue drawer open, Model page).

Contract: README sections — hero one-liner + live URL placeholder (filled in Task 16); screenshots; architecture diagram (ASCII from spec §3); **real metrics table copied from `models/v1/metrics.json`** (PR-AUC, ROC-AUC, precision/recall at suggested thresholds); "Design decisions" (imbalance→PR-AUC, time split, two thresholds, fail-safe policy, ONNX, presence-driven simulator — one paragraph each, sourced from spec §14); local run instructions (`pnpm install`, `pip install -r ...`, `pnpm ml:all` optional since artifacts committed, `pnpm db:migrate && pnpm db:seed`, `pnpm dev`); testing (`pnpm verify`, `pytest ml`, `pnpm test:e2e`); dataset honesty note; suggested resume bullets (3, with the real numbers).

- [ ] Step 1: Screenshot script (small `e2e/screenshots.spec.ts` or tsx+playwright script) → PNGs. Step 2: Write README with REAL numbers. Step 3: Commit: `docs: README with architecture, metrics, screenshots`

---

### Task 16: Deploy (the one user-involved task)

**REQUIRED SUB-SKILLS:** `vercel:bootstrap` / `vercel:marketplace` / `vercel:deploy` / `vercel:env` as applicable.

- [ ] Step 1: `npm i -g vercel` if absent. **Ask the user to run `! vercel login`** (their one action).
- [ ] Step 2: `vercel link` (create project `sentinel`). Provision Neon: `vercel integration add neon` (marketplace skill flow), confirm `DATABASE_URL` in `vercel env ls`; `vercel env pull .env.local`.
- [ ] Step 3: Add `CRON_SECRET` (generate: `openssl rand -hex 16`) via `vercel env add CRON_SECRET production`.
- [ ] Step 4: Migrate + seed **production** Neon: run `DATABASE_URL=<from env pull> pnpm db:migrate && DATABASE_URL=<...> pnpm db:seed`.
- [ ] Step 5: `vercel deploy --prod` (vercel:deploy skill). If preview-protection interferes with `/api/py/*` self-calls, disable Deployment Protection for the project (Settings → Deployment Protection) — production URLs are public on Hobby by default.
- [ ] Step 6: Live verification (verification-before-completion): `curl https://<prod-url>/api/py/health` → ok; open site, confirm ticking feed, run a burst, resolve a case on prod, check `/api/stats`. Confirm cron registered (`vercel crons ls` or dashboard).
- [ ] Step 7: Fill live URL into README, commit `docs: add live URL`, `vercel deploy --prod` once more (or rely on git integration if set up).

---

## Self-Review Notes (performed at write time)

- **Spec coverage check:** §3 architecture→Tasks 0,5,9,16; §4 schema→6; §5 pipeline→1–4; §6 APIs→8,9 (ingest-as-lib →7); §7 pages→10–13; §8 error policies→7 (fail-safe, idempotency, atomicity), 8 (throttle/validation), 9 (cron auth), 10 (backoff chip); §9 testing→each task + 14; §10 deploy→16; §11 README→15. No gaps found.
- **Type consistency:** `TopFactor`, `ScoreResult`, `IngestInput`, `decide`, TxnView, preview function signatures are each defined once (Tasks 5/7/8/13) and referenced verbatim elsewhere.
- **Known judgment points for the executor:** ONNX output indexing (Task 3 `get_prob` helper), create-next-app interactive drift (Task 0), Playwright webServer with concurrently on Windows (Task 14) — each has an explicit fallback written into its task.
