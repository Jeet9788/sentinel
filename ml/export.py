"""Convert the trained model to ONNX and emit the artifacts the API serves.

Why ONNX rather than shipping XGBoost itself: the serving function only needs to
run a fixed tree ensemble, and onnxruntime does that in a fraction of the bundle
size and cold-start time of the full training stack. It also forces a clean split
between "the thing we trained" and "the thing we serve" — which is only safe if
the two provably agree, so this script refuses to write an artifact whose
predictions drift from the native model's.

Outputs (models/v1/, mirrored into api/_model/ for deployment):
  model.onnx          the served model
  feature_stats.json  per-feature training medians (the online explainer's baseline)
  shap_summary.json   exact global feature importance, computed offline
"""

from __future__ import annotations

import json
import pathlib
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import numpy as np
import onnxruntime as ort
import xgboost as xgb
from onnxmltools.convert import convert_xgboost
from onnxmltools.convert.common.data_types import FloatTensorType
from xgboost import XGBClassifier

from api.onnx_io import probability_of_fraud
from ml.common import (
    API_MODEL_DIR,
    FEATURE_NAMES,
    MODELS_DIR,
    N_FEATURES,
    NATIVE_MODEL,
    load_raw,
    time_split,
)

PARITY_TOLERANCE = 1e-5
SHAP_SAMPLE = 5000


def main() -> None:
    if not NATIVE_MODEL.exists():
        raise SystemExit(f"{NATIVE_MODEL} missing — run `python ml/train.py` first")

    model = XGBClassifier()
    model.load_model(NATIVE_MODEL)

    train, test = time_split(load_raw())

    onnx_model = convert_xgboost(
        model,
        initial_types=[("input", FloatTensorType([None, N_FEATURES]))],
        target_opset=15,
    )
    onnx_path = MODELS_DIR / "model.onnx"
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    onnx_path.write_bytes(onnx_model.SerializeToString())
    print(f"wrote {onnx_path} ({onnx_path.stat().st_size / 1e6:.1f} MB)")

    # Parity gate: the exported artifact must reproduce the evaluated model.
    sample = test.sample(1000, random_state=0)[FEATURE_NAMES].to_numpy(np.float32)
    native = model.predict_proba(sample)[:, 1]
    session = ort.InferenceSession(str(onnx_path))
    onnx_scores = probability_of_fraud(session.run(None, {"input": sample}))
    drift = float(np.max(np.abs(native - onnx_scores)))
    if drift > PARITY_TOLERANCE:
        raise SystemExit(f"ONNX drifted from native model by {drift:.2e} (limit {PARITY_TOLERANCE})")
    print(f"parity ok: max |native - onnx| = {drift:.2e}")

    # Baselines for the online explainer: neutralizing a feature means setting it
    # to its training median, i.e. "what if this had been unremarkable?"
    medians = train[FEATURE_NAMES].median()
    stats = {
        "order": FEATURE_NAMES,
        "medians": {name: float(medians[name]) for name in FEATURE_NAMES},
        "amountMedian": float(medians["Amount"]),
    }
    (MODELS_DIR / "feature_stats.json").write_text(json.dumps(stats, indent=2))

    # Exact global importance via SHAP tree contributions (last column is the bias).
    shap_sample = test.sample(min(SHAP_SAMPLE, len(test)), random_state=1)[FEATURE_NAMES]
    contribs = model.get_booster().predict(xgb.DMatrix(shap_sample), pred_contribs=True)
    mean_abs = np.abs(contribs[:, :-1]).mean(axis=0)
    summary = sorted(
        (
            {"feature": name, "meanAbsContrib": round(float(value), 6)}
            for name, value in zip(FEATURE_NAMES, mean_abs)
        ),
        key=lambda row: row["meanAbsContrib"],
        reverse=True,
    )
    (MODELS_DIR / "shap_summary.json").write_text(json.dumps(summary, indent=2))
    top = ", ".join(f"{row['feature']}" for row in summary[:5])
    print(f"shap summary written — top features: {top}")

    API_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy(onnx_path, API_MODEL_DIR / "model.onnx")
    shutil.copy(MODELS_DIR / "feature_stats.json", API_MODEL_DIR / "feature_stats.json")
    print(f"mirrored serving artifacts into {API_MODEL_DIR}")


if __name__ == "__main__":
    main()
