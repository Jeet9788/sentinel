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
from fastapi import APIRouter, FastAPI, HTTPException
from pydantic import BaseModel

# Works both as a package (pytest: `from api.index import app`, uvicorn:
# `api.index:app`) and as a bare module (Vercel runs api/index.py with api/ on
# the path). The two import roots are the only difference between the environments.
try:
    from api.explain import MODEL_VERSION, N_FEATURES, top_factors
    from api.onnx_io import probability_of_fraud
except ImportError:  # pragma: no cover - exercised only in the Vercel runtime
    from explain import MODEL_VERSION, N_FEATURES, top_factors
    from onnx_io import probability_of_fraud

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


router = APIRouter()


@router.get("/health")
def health() -> dict:
    if session is None:
        raise HTTPException(status_code=503, detail=f"model unavailable: {load_error}")
    return {"status": "ok", "modelVersion": MODEL_VERSION, "features": N_FEATURES}


@router.post("/score")
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


# The routes are mounted under /api/py (how the app calls them) and also at the
# root, so the function answers whether Vercel delivers the request with the
# original /api/py/* path or strips the prefix when routing to the function.
app.include_router(router, prefix="/api/py")
app.include_router(router)
