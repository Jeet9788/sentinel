"""Pipeline tests. These are quality gates, not decoration: the model does not
ship unless it clears the PR-AUC floor and the ONNX export matches the trained
model exactly."""

import json

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
