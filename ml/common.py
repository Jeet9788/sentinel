"""Shared constants and helpers for the Sentinel training pipeline.

FEATURE_NAMES is the single source of truth for feature ordering. The same order
is baked into the ONNX input tensor, the `features` column in Postgres, and the
TypeScript client. Reordering it anywhere without reordering it everywhere would
silently feed the model garbage, so it is asserted in the tests.
"""

from __future__ import annotations

import pathlib

import pandas as pd

FEATURE_NAMES: list[str] = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "ml" / "data"
RAW_CSV = DATA_DIR / "creditcard.csv"
NATIVE_MODEL = DATA_DIR / "model.json"
MODELS_DIR = ROOT / "models" / "v1"
API_MODEL_DIR = ROOT / "api" / "_model"
REPLAY_POOL = ROOT / "db" / "replay_pool.jsonl.gz"

MODEL_VERSION = "v1"
TRAIN_FRACTION = 0.8


def load_raw() -> pd.DataFrame:
    """Load the validated raw dataset with columns FEATURE_NAMES + ['Class']."""
    if not RAW_CSV.exists():
        raise FileNotFoundError(f"{RAW_CSV} missing — run `python ml/download.py` first")
    df = pd.read_csv(RAW_CSV)
    missing = [c for c in FEATURE_NAMES + ["Class"] if c not in df.columns]
    if missing:
        raise ValueError(f"dataset is missing expected columns: {missing}")
    df = df[FEATURE_NAMES + ["Class"]]
    df[FEATURE_NAMES] = df[FEATURE_NAMES].astype("float64")
    df["Class"] = df["Class"].astype("int64")
    return df


def time_split(df: pd.DataFrame, train_frac: float = TRAIN_FRACTION) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split chronologically on `Time`: train on the past, evaluate on the future.

    A random split would let the model learn from transactions that happen after
    the ones it is tested on — a leak that inflates every metric. Fraud detection
    is deployed against the future, so it must be measured against the future.
    """
    df = df.sort_values("Time", kind="mergesort").reset_index(drop=True)
    cut = df["Time"].quantile(train_frac)
    train = df[df["Time"] <= cut].reset_index(drop=True)
    test = df[df["Time"] > cut].reset_index(drop=True)
    return train, test
