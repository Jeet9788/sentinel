"""Fetch the ULB credit-card fraud dataset to ml/data/creditcard.csv.

284,807 real anonymized card transactions, 492 of them fraudulent (0.173%).
Features V1-V28 are PCA components published in place of the raw fields for
privacy; only Time and Amount are original. Idempotent: re-running is a no-op
once the CSV is cached.

We parse OpenML's raw ARFF rather than going through sklearn's `fetch_openml`,
because OpenML tags `Time` as a row-identifier attribute and sklearn dutifully
drops it. Time is exactly what we need for the chronological train/test split,
so we read the file ourselves.
"""

from __future__ import annotations

import os
import pathlib
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import pandas as pd

from ml.common import FEATURE_NAMES, RAW_CSV

ARFF_URL = "https://openml.org/data/v1/download/1673544/creditcard.arff"


def _download(url: str, dest: pathlib.Path) -> None:
    print(f"downloading {url} (~144 MB, one time)...")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as resp, open(dest, "wb") as out:
        while chunk := resp.read(1 << 20):
            out.write(chunk)
    print(f"  saved {dest.stat().st_size / 1e6:.0f} MB")


def _read_arff(path: pathlib.Path) -> pd.DataFrame:
    columns: list[str] = []
    data_start = 0
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            stripped = line.strip()
            lowered = stripped.lower()
            if lowered.startswith("@attribute"):
                columns.append(stripped.split()[1].strip("'\""))
            elif lowered.startswith("@data"):
                data_start = i + 1
                break
    if not columns or not data_start:
        raise SystemExit(f"{path} does not look like an ARFF file")
    return pd.read_csv(path, skiprows=data_start, header=None, names=columns)


def fetch() -> pd.DataFrame:
    override = os.environ.get("SENTINEL_DATA_URL")
    if override:
        print(f"fetching from SENTINEL_DATA_URL={override}")
        return pd.read_csv(override)

    arff = RAW_CSV.parent / "creditcard.arff"
    if not arff.exists():
        _download(ARFF_URL, arff)
    return _read_arff(arff)


def main() -> None:
    if RAW_CSV.exists():
        print(f"cached: {RAW_CSV}")
        return

    df = fetch()
    df.columns = [c.strip("'\"") for c in df.columns]
    if "Class" in df.columns:
        df["Class"] = df["Class"].astype(str).str.strip("'\"").astype(int)

    missing = [c for c in FEATURE_NAMES + ["Class"] if c not in df.columns]
    if missing:
        raise SystemExit(f"downloaded data is missing columns: {missing}")
    df = df[FEATURE_NAMES + ["Class"]]

    RAW_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(RAW_CSV, index=False)
    frauds = int(df["Class"].sum())
    print(f"wrote {RAW_CSV}  rows={len(df):,}  frauds={frauds}  ({frauds / len(df):.3%})")


if __name__ == "__main__":
    main()
