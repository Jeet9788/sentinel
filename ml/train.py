"""Train the fraud model and emit its evaluation artifacts.

Three decisions here are the ones worth defending:

1. The split is chronological, not random. Fraud models are deployed against the
   future, so they are measured against the future (see `time_split`).
2. The headline metric is PR-AUC, not accuracy or ROC-AUC. At 0.173% positives a
   model that never predicts fraud is 99.83% accurate and completely worthless;
   ROC-AUC is similarly flattered by the enormous true-negative mass. Precision
   and recall only care about the rare class, which is the only class we care about.
3. The class imbalance is handled with `scale_pos_weight` (cost reweighting)
   rather than resampling, so the model still sees the real data distribution.

Outputs: ml/data/model.json (native booster), models/v1/metrics.json,
models/v1/pr_curve.json.
"""

from __future__ import annotations

import itertools
import json
import pathlib
import sys
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    precision_recall_curve,
    roc_auc_score,
)
from xgboost import XGBClassifier

from ml.common import (
    FEATURE_NAMES,
    MODEL_VERSION,
    MODELS_DIR,
    NATIVE_MODEL,
    load_raw,
    time_split,
)

PARAM_GRID = {"max_depth": [4, 6, 8], "learning_rate": [0.03, 0.05, 0.1]}
FIXED_PARAMS = dict(
    n_estimators=1000,
    subsample=0.9,
    colsample_bytree=0.9,
    eval_metric="aucpr",
    tree_method="hist",
    random_state=42,
    n_jobs=-1,
)

# Two business constraints, not ML constants. They are what the analyst dials in
# the UI; training only proposes sensible defaults.
MAX_REVIEW_RATE = 0.005  # never send more than 0.5% of traffic to a human
MIN_BLOCK_PRECISION = 0.95  # never auto-block unless we are right >=95% of the time


def _pos_weight(y: np.ndarray) -> float:
    pos = float(y.sum())
    neg = float(len(y) - pos)
    return neg / max(pos, 1.0)


def _counts_at(y_true: np.ndarray, scores: np.ndarray, threshold: float) -> dict:
    flagged = scores >= threshold
    tp = int(((y_true == 1) & flagged).sum())
    fp = int(((y_true == 0) & flagged).sum())
    fn = int(((y_true == 1) & ~flagged).sum())
    tn = int(((y_true == 0) & ~flagged).sum())
    precision = tp / (tp + fp) if (tp + fp) else 1.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    return {
        "threshold": round(float(threshold), 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "flaggedRate": round(float(flagged.mean()), 6),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
    }


def _suggest_thresholds(table: list[dict]) -> tuple[float, float]:
    """Pick defaults from the two constraints a fraud team actually operates under.

    t_low (the auto-approve line) is set by analyst capacity: go as low as
    possible — catching as much fraud as possible — without sending more than
    MAX_REVIEW_RATE of all traffic to a human.

    t_high (the auto-block line) is set by the cost of being wrong: block only
    where the model is right at least MIN_BLOCK_PRECISION of the time, because a
    blocked transaction is a wrongly-declined customer.

    Everything in between is exactly what a human is for.
    """
    affordable = [r for r in table if r["flaggedRate"] <= MAX_REVIEW_RATE]
    t_low = min((r["threshold"] for r in affordable), default=0.05)

    blockable = [r for r in table if r["precision"] >= MIN_BLOCK_PRECISION and r["tp"] > 0]
    t_high = min((r["threshold"] for r in blockable), default=0.95)

    if not t_low < t_high:
        t_low = round(t_high / 2, 3)
    return round(float(t_low), 3), round(float(t_high), 3)


def main() -> None:
    df = load_raw()
    train, test = time_split(df)

    # Hold out the tail of train (again chronologically) to pick hyperparameters
    # without ever consulting the test set.
    val_cut = train["Time"].quantile(0.9)
    fit = train[train["Time"] <= val_cut]
    val = train[train["Time"] > val_cut]

    X_fit, y_fit = fit[FEATURE_NAMES].to_numpy(), fit["Class"].to_numpy()
    X_val, y_val = val[FEATURE_NAMES].to_numpy(), val["Class"].to_numpy()
    X_train, y_train = train[FEATURE_NAMES].to_numpy(), train["Class"].to_numpy()
    X_test, y_test = test[FEATURE_NAMES].to_numpy(), test["Class"].to_numpy()

    print(
        f"train={len(train):,} (fraud {int(y_train.sum())})  "
        f"test={len(test):,} (fraud {int(y_test.sum())})  "
        f"split at Time={train['Time'].max():.0f}s"
    )
    print(f"features: {len(FEATURE_NAMES)} (Time excluded — see ml/common.py)")

    best = {"score": -1.0}
    for max_depth, lr in itertools.product(PARAM_GRID["max_depth"], PARAM_GRID["learning_rate"]):
        model = XGBClassifier(
            **FIXED_PARAMS,
            max_depth=max_depth,
            learning_rate=lr,
            scale_pos_weight=_pos_weight(y_fit),
            early_stopping_rounds=60,
        )
        model.fit(X_fit, y_fit, eval_set=[(X_val, y_val)], verbose=False)
        val_ap = average_precision_score(y_val, model.predict_proba(X_val)[:, 1])
        rounds = int(model.best_iteration) + 1
        print(f"  depth={max_depth} lr={lr}  val PR-AUC={val_ap:.4f}  rounds={rounds}")
        if val_ap > best["score"]:
            best = {"score": val_ap, "max_depth": max_depth, "learning_rate": lr, "rounds": rounds}

    print(f"best: depth={best['max_depth']} lr={best['learning_rate']} rounds={best['rounds']}")

    # Refit on the full training window with the chosen settings. n_estimators is
    # fixed to the round count the validation split chose, so the final fit never
    # early-stops against data it also trains on.
    final_params = {**FIXED_PARAMS, "n_estimators": best["rounds"]}
    model = XGBClassifier(
        **final_params,
        max_depth=best["max_depth"],
        learning_rate=best["learning_rate"],
        scale_pos_weight=_pos_weight(y_train),
    )
    model.fit(X_train, y_train, verbose=False)

    scores = model.predict_proba(X_test)[:, 1]
    pr_auc = float(average_precision_score(y_test, scores))
    roc_auc = float(roc_auc_score(y_test, scores))
    print(f"\nHOLDOUT  PR-AUC={pr_auc:.4f}  ROC-AUC={roc_auc:.4f}")

    # PR curve for plotting: the true curve, downsampled to a plottable size.
    precision, recall, thresholds = precision_recall_curve(y_test, scores)
    idx = np.unique(np.linspace(0, len(thresholds) - 1, num=200).astype(int))
    curve = [
        {
            "threshold": round(float(thresholds[i]), 6),
            "precision": round(float(precision[i]), 4),
            "recall": round(float(recall[i]), 4),
            "flaggedRate": round(float((scores >= thresholds[i]).mean()), 6),
        }
        for i in idx
    ]
    curve.sort(key=lambda r: r["threshold"])

    # Uniform grid with raw counts, so the UI can render an honest confusion
    # matrix at whatever thresholds the analyst dials in.
    table = [_counts_at(y_test, scores, t) for t in np.round(np.arange(0.0, 1.001, 0.01), 2)]
    t_low, t_high = _suggest_thresholds(table)

    print("\n threshold  precision  recall  flagged%")
    for row in table:
        if round(row["threshold"] * 100) % 10 == 0:
            print(
                f"   {row['threshold']:.2f}      {row['precision']:.3f}    "
                f"{row['recall']:.3f}   {row['flaggedRate'] * 100:.3f}%"
            )
    print(f"\nsuggested thresholds: t_low={t_low}  t_high={t_high}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    NATIVE_MODEL.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(NATIVE_MODEL)

    metrics = {
        "version": MODEL_VERSION,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "algorithm": "XGBoost (gradient-boosted trees)",
        "dataset": {
            "name": "ULB credit-card fraud (OpenML 1597)",
            "rows": int(len(df)),
            "frauds": int(df["Class"].sum()),
            "fraudRate": round(float(df["Class"].mean()), 6),
            "trainRows": int(len(train)),
            "testRows": int(len(test)),
            "testFrauds": int(y_test.sum()),
            "splitTime": float(train["Time"].max()),
        },
        "features": FEATURE_NAMES,
        "featureNote": (
            "Time is excluded from the model: it counts seconds since the dataset's first "
            "transaction, so a chronological split makes the train and test ranges disjoint "
            "and the feature cannot generalize. It is used only to perform the split."
        ),
        "prAuc": round(pr_auc, 4),
        "rocAuc": round(roc_auc, 4),
        "params": {
            "max_depth": best["max_depth"],
            "learning_rate": best["learning_rate"],
            "n_estimators": best["rounds"],
            "scale_pos_weight": round(_pos_weight(y_train), 1),
            **{k: v for k, v in FIXED_PARAMS.items() if k not in ("n_estimators", "n_jobs")},
        },
        "suggested": {"tLow": t_low, "tHigh": t_high},
        "thresholdTable": table,
    }
    (MODELS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    (MODELS_DIR / "pr_curve.json").write_text(json.dumps(curve, indent=2))
    print(f"\nwrote {MODELS_DIR / 'metrics.json'} and pr_curve.json")


if __name__ == "__main__":
    main()
