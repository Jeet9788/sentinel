"""Tests for the scoring function that Vercel deploys."""

from __future__ import annotations

import gzip
import json
import statistics

import pytest
from fastapi.testclient import TestClient

from api.index import app
from ml.common import N_FEATURES, REPLAY_POOL

client = TestClient(app)


@pytest.fixture(scope="module")
def pool() -> list[dict]:
    return [json.loads(line) for line in gzip.open(REPLAY_POOL, "rt")]


def score(features: list[float]) -> dict:
    response = client.post("/api/py/score", json={"features": features})
    assert response.status_code == 200, response.text
    return response.json()


def test_health():
    response = client.get("/api/py/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["modelVersion"] == "v1"
    assert body["features"] == N_FEATURES


def test_separates_fraud_from_legitimate(pool):
    """The endpoint is not just returning a number — it is returning the right
    number. Fraud should score high and legitimate traffic should score ~0."""
    frauds = [r for r in pool if r["isFraud"]][:25]
    legit = [r for r in pool if not r["isFraud"]][:25]

    fraud_scores = [score(r["features"])["probability"] for r in frauds]
    legit_scores = [score(r["features"])["probability"] for r in legit]

    assert all(0.0 <= p <= 1.0 for p in fraud_scores + legit_scores)
    assert statistics.median(fraud_scores) > 0.5
    assert statistics.median(legit_scores) < 0.05


def test_explanations_are_ranked(pool):
    fraud = next(r for r in pool if r["isFraud"])
    factors = score(fraud["features"])["topFactors"]

    assert len(factors) == 5
    assert set(factors[0]) == {"feature", "label", "impact", "direction"}
    assert all(f["direction"] in ("up", "down") for f in factors)

    impacts = [abs(f["impact"]) for f in factors]
    assert impacts == sorted(impacts, reverse=True)


def test_amount_factor_is_human_readable(pool):
    """A fraud analyst cannot act on 'V14 = -7.12'. Amount is the one feature
    with real-world meaning, so it gets phrased in terms a human can act on."""
    big = max(pool, key=lambda r: r["amountCents"])
    factors = score(big["features"])["topFactors"]
    amount = [f for f in factors if f["feature"] == "Amount"]
    if amount:
        assert "typical amount" in amount[0]["label"]


def test_rejects_wrong_feature_count():
    response = client.post("/api/py/score", json={"features": [1.0] * (N_FEATURES - 1)})
    assert response.status_code == 400
    assert str(N_FEATURES) in response.json()["detail"]
