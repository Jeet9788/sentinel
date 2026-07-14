"""Per-transaction explanations, computed at serving time.

An analyst cannot act on "score: 0.94". They need to know *why*, and they need it
in the same request. Exact SHAP values are too slow for that path, so we use
sensitivity analysis: neutralize one feature at a time to its training median —
"what would this score have been if this feature had been unremarkable?" — and
attribute the difference to that feature.

All 29 neutralizations go through the model as a single batched call, so the
whole explanation costs one extra inference, not 29.

Global feature importance on the Model page uses exact SHAP instead (computed
offline during export). The UI labels each for what it is; this one is a fast
approximation and is not presented as anything more.
"""

from __future__ import annotations

import json
import pathlib

import numpy as np

from api.onnx_io import probability_of_fraud

MODEL_DIR = pathlib.Path(__file__).parent / "_model"
TOP_N = 5

_stats = json.loads((MODEL_DIR / "feature_stats.json").read_text())
FEATURE_NAMES: list[str] = _stats["order"]
N_FEATURES: int = len(FEATURE_NAMES)
MODEL_VERSION: str = _stats["version"]

_MEDIANS = np.array([_stats["medians"][name] for name in FEATURE_NAMES], dtype=np.float32)
_AMOUNT_INDEX = FEATURE_NAMES.index("Amount")
_AMOUNT_MEDIAN = float(_stats["amountMedian"]) or 1.0


def _label(name: str, value: float) -> str:
    if name == "Amount":
        return f"{value / _AMOUNT_MEDIAN:.1f}x typical amount (${value:,.2f})"
    return f"pattern component {name}"


def top_factors(session, features: np.ndarray, baseline: float) -> list[dict]:
    """Rank features by how much each one moved this transaction's score."""
    # Row i is the transaction with feature i neutralized to its training median.
    probes = np.repeat(features.reshape(1, -1), N_FEATURES, axis=0)
    probes[np.arange(N_FEATURES), np.arange(N_FEATURES)] = _MEDIANS

    neutralized = probability_of_fraud(session.run(None, {"input": probes}))
    impacts = baseline - neutralized  # >0: the real value pushed the score up

    ranked = np.argsort(-np.abs(impacts))[:TOP_N]
    return [
        {
            "feature": FEATURE_NAMES[i],
            "label": _label(FEATURE_NAMES[i], float(features[i])),
            "impact": round(float(impacts[i]), 4),
            "direction": "up" if impacts[i] > 0 else "down",
        }
        for i in ranked
    ]
