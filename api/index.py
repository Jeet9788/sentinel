"""Sentinel scoring function — the only place the model is ever executed.

Deployed as a Vercel Python function; runs locally under uvicorn on :8000 with
the Next.js dev server rewriting /api/py/* to it. Stateless: the ONNX session is
built once per warm instance and reused across requests.

If the model cannot be loaded, this service says so (503) rather than guessing.
The caller's contract is that a missing score routes the transaction to a human,
never to a silent approval.
"""

from __future__ import annotations

import pathlib
import time

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from api.explain import MODEL_VERSION, N_FEATURES, top_factors
from api.onnx_io import probability_of_fraud

MODEL_PATH = pathlib.Path(__file__).parent / "_model" / "model.onnx"

app = FastAPI(title="Sentinel scorer", docs_url=None, redoc_url=None)

try:
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    load_error: str | None = None
except Exception as exc:  # pragma: no cover - only fires on a broken deployment
    session = None
    load_error = str(exc)


class ScoreRequest(BaseModel):
    features: list[float]


@app.get("/api/py/health")
def health() -> dict:
    if session is None:
        raise HTTPException(status_code=503, detail=f"model unavailable: {load_error}")
    return {"status": "ok", "modelVersion": MODEL_VERSION, "features": N_FEATURES}


@app.post("/api/py/score")
def score(request: ScoreRequest) -> dict:
    if session is None:
        raise HTTPException(status_code=503, detail=f"model unavailable: {load_error}")

    if len(request.features) != N_FEATURES:
        raise HTTPException(
            status_code=400,
            detail=f"expected {N_FEATURES} features, got {len(request.features)}",
        )

    started = time.perf_counter()
    features = np.asarray(request.features, dtype=np.float32)
    probability = float(
        probability_of_fraud(session.run(None, {"input": features.reshape(1, -1)}))[0]
    )

    return {
        "probability": probability,
        "modelVersion": MODEL_VERSION,
        "topFactors": top_factors(session, features, probability),
        "latencyMs": round((time.perf_counter() - started) * 1000, 2),
    }
