#!/usr/bin/env python3
"""PointVet R2 backup freshness check — metadata only, independent of PostgreSQL."""
import datetime as dt
import json
import os
import subprocess
import sys

BUCKET = os.environ["R2_BUCKET"]
ENDPOINT = os.environ["R2_ENDPOINT"]
MAX_AGE_HOURS = float(os.environ.get("MAX_BACKUP_AGE_HOURS", "26"))
PREFIX = "postgres/daily/"
NOW = dt.datetime.now(dt.timezone.utc)
if MAX_AGE_HOURS <= 0:
    raise ValueError("MAX_BACKUP_AGE_HOURS must be positive")

def main():
    args = [
        "aws", "--endpoint-url", ENDPOINT,
        "s3api", "list-objects-v2", "--bucket", BUCKET,
        "--prefix", PREFIX, "--output", "json",
    ]
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    objs = json.loads(result.stdout).get("Contents", [])
    candidates = []
    for obj in objs:
        key = obj.get("Key", "")
        if not key.endswith(".dump.age") or not obj.get("Size", 0):
            continue
        stamp = obj.get("LastModified")
        if not stamp:
            continue
        try:
            parsed = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            candidates.append((parsed, key))
        except ValueError:
            continue
    if not candidates:
        print("CRITICAL: no encrypted database backup in R2")
        return 1
    latest, key = max(candidates)
    age = (NOW - latest).total_seconds() / 3600
    print(f"Last encrypted backup: {key}; age_hours={age:.2f}")
    if age < -1 or age > MAX_AGE_HOURS:
        print(f"CRITICAL: encrypted backup age outside permitted window ({MAX_AGE_HOURS:.0f}h)")
        return 1
    print("R2 backup freshness OK")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as err:
        print(f"CRITICAL: R2 backup freshness check failed: {type(err).__name__}", file=sys.stderr)
        sys.exit(2)
