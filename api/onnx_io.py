"""Shared ONNX plumbing for the scoring function and the export-parity test.

Kept tiny and dependency-light on purpose: this module ships to Vercel inside the
Python function, whose only dependencies are fastapi, onnxruntime and numpy.
"""

from __future__ import annotations

import numpy as np

# Converters emit [label, probabilities]. With ZipMap disabled the second output
# is a plain [N, 2] float tensor; with it enabled it is a list of {class: prob}
# dicts. We accept either so the serving path cannot silently mis-read a model
# that was converted with different options.
PROB_OUTPUT_INDEX = 1
FRAUD_CLASS = 1


def probability_of_fraud(outputs: list) -> np.ndarray:
    """Extract P(fraud) as a 1-D float array from raw InferenceSession outputs."""
    probs = outputs[PROB_OUTPUT_INDEX]

    if isinstance(probs, list) and probs and isinstance(probs[0], dict):
        return np.array([float(row[FRAUD_CLASS]) for row in probs], dtype=np.float64)

    array = np.asarray(probs, dtype=np.float64)
    if array.ndim == 2:
        return array[:, FRAUD_CLASS]
    return array
