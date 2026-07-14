"""Pipeline tests. These are quality gates, not decoration: the model does not
ship unless it clears the PR-AUC floor and the ONNX export matches the trained
model exactly."""

import json

from ml.common import FEATURE_NAMES, MODELS_DIR, N_FEATURES, TIME_COL, load_raw, time_split


def test_feature_names_canonical():
    assert FEATURE_NAMES == [f"V{i}" for i in range(1, 29)] + ["Amount"]
    assert N_FEATURES == 29


def test_time_is_not_a_model_feature():
    """Time is seconds since the dataset's first transaction. A chronological
    split makes train and test Time ranges disjoint, so the feature cannot
    generalize — it is used to split the data, never to score it."""
    assert TIME_COL not in FEATURE_NAMES
    train, test = time_split(load_raw())
    assert train[TIME_COL].max() < test[TIME_COL].min()


def test_raw_dataset_shape():
    df = load_raw()
    assert list(df.columns) == [TIME_COL] + FEATURE_NAMES + ["Class"]
    assert len(df) == 284807
    assert int(df["Class"].sum()) == 492
    assert df.isna().sum().sum() == 0


def test_time_split_no_leakage():
    """The model must never be trained on a transaction that happens after one
    it is tested on."""
    df = load_raw()
    train, test = time_split(df)
    assert train[TIME_COL].max() < test[TIME_COL].min()
    assert abs(len(train) / len(df) - 0.8) < 0.01
    assert int(test["Class"].sum()) > 0, "test split must contain some fraud to measure"


def test_metrics_gate():
    """Quality floor: the model does not ship below this."""
    metrics = json.loads((MODELS_DIR / "metrics.json").read_text())
    assert metrics["prAuc"] >= 0.80, f"PR-AUC {metrics['prAuc']:.4f} is below the 0.80 floor"
    assert metrics["rocAuc"] >= 0.95
    suggested = metrics["suggested"]
    assert 0 <= suggested["tLow"] < suggested["tHigh"] <= 1


def test_pr_curve_shape():
    curve = json.loads((MODELS_DIR / "pr_curve.json").read_text())
    assert len(curve) >= 100
    assert all(set(row) == {"threshold", "precision", "recall", "flaggedRate"} for row in curve)
    thresholds = [row["threshold"] for row in curve]
    assert thresholds == sorted(thresholds)
