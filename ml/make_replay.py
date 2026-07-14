"""Build the replay pool the live simulator draws from.

Every row comes from the held-out test split — data the model has never seen — so
the scores on the dashboard are honest out-of-sample predictions rather than
memorized training rows. The dataset's real fields are PCA components with no
human meaning, so we attach synthetic merchant/card/city metadata purely so the
console reads like a payments console. The scores are real; the storefront names
are set dressing, and the UI says so.

Output: db/replay_pool.jsonl.gz (committed — seeding must not require the 150 MB
raw dataset).
"""

from __future__ import annotations

import gzip
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import pandas as pd

from ml.common import FEATURE_NAMES, REPLAY_POOL, load_raw, time_split

LEGIT_SAMPLE = 15000
SEED = 42

MERCHANTS = [
    "Prime Mart", "Northwind Coffee", "Blue Ridge Fuel", "Lumen Electronics",
    "Sonora Grocers", "Atlas Hardware", "Corner Pharmacy", "Vega Airlines",
    "Harbor Books", "Silverline Transit", "Copper Kettle Diner", "Nimbus Cloud Co",
    "Redwood Outfitters", "Bayside Pizza", "Quartz Jewelers", "Ironwood Gym",
    "Lantern Hotels", "Pixel Games", "Verdant Garden Co", "Cobalt Rideshare",
    "Meridian Pet Supply", "Fable Toys", "Tidewater Seafood", "Summit Sportswear",
    "Ember Home Goods", "Willow Bakery", "Onyx Barbers", "Cascade Streaming",
    "Halcyon Spa", "Granite Auto Parts", "Juniper Florist", "Kestrel Bikes",
    "Solstice Cinema", "Amberline Rail", "Driftwood Surf Co", "Marble Arch Deli",
    "Nova Pharmacy", "Beacon Insurance", "Thistle Wine Shop", "Zenith Mobile",
    "Peregrine Luggage", "Crimson Tea House",
]

CITIES = [
    "Austin", "Portland", "Denver", "Chicago", "Seattle", "Boston", "Atlanta",
    "Phoenix", "Miami", "Detroit", "Nashville", "Minneapolis", "San Diego",
    "Charlotte", "Pittsburgh", "Sacramento", "Columbus", "Raleigh", "Tampa",
    "Kansas City", "Salt Lake City", "Milwaukee", "Louisville", "Omaha", "Boise",
]

KNUTH = 2654435761  # deterministic display metadata: same row -> same merchant, always


def _display(index: int) -> dict:
    h = (index * KNUTH) % (2**32)
    return {
        "cardLast4": f"{h % 10000:04d}",
        "merchant": MERCHANTS[(h // 10000) % len(MERCHANTS)],
        "city": CITIES[(h // 1000) % len(CITIES)],
    }


def main() -> None:
    _, test = time_split(load_raw())

    frauds = test[test["Class"] == 1]
    legit = test[test["Class"] == 0].sample(
        min(LEGIT_SAMPLE, int((test["Class"] == 0).sum())), random_state=SEED
    )
    pool = (
        pd.concat([frauds, legit], ignore_index=True)
        .sample(frac=1.0, random_state=SEED)  # shuffle so fraud is not clustered
        .reset_index(drop=True)
    )

    REPLAY_POOL.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(REPLAY_POOL, "wt", encoding="utf-8") as out:
        for i, row in enumerate(pool.itertuples(index=False)):
            record = dict(zip(pool.columns, row))
            out.write(
                json.dumps(
                    {
                        "features": [float(record[name]) for name in FEATURE_NAMES],
                        "amountCents": int(round(float(record["Amount"]) * 100)),
                        "isFraud": bool(record["Class"]),
                        **_display(i),
                    }
                )
                + "\n"
            )

    size_kb = REPLAY_POOL.stat().st_size / 1024
    print(
        f"wrote {REPLAY_POOL}  rows={len(pool):,}  frauds={int(pool['Class'].sum())}  "
        f"({size_kb:.0f} KB gzipped)"
    )


if __name__ == "__main__":
    main()
