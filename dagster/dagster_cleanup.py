#!/usr/bin/env python3
"""
Delete Dagster runs (and their associated event logs) older than a retention window.

WARNING:
- This is destructive: it removes Dagster's record that the run ever occurred.
- This can impact partitioned jobs/assets history.
Ref: Dagster maintainers' guidance: instance.get_run_records(...), then instance.delete_run(run_id).
"""

from __future__ import annotations

import argparse
import datetime as dt
import shutil
import os
import sys
from typing import Iterable, Optional

from dagster import DagsterInstance, DagsterRunStatus, RunsFilter


TERMINAL_STATUSES = [
    DagsterRunStatus.SUCCESS,
    DagsterRunStatus.FAILURE,
    DagsterRunStatus.CANCELED,
]


def iter_old_run_ids(
    instance: DagsterInstance,
    created_before: dt.datetime,
    batch_size: int,
    statuses: Optional[list[DagsterRunStatus]] = None,
) -> Iterable[str]:
    """
    Yield run_ids in ascending (oldest-first) order, in batches.
    """
    while True:
        records = instance.get_run_records(
            filters=RunsFilter(created_before=created_before, statuses=statuses),
            limit=batch_size,
            ascending=True,
        )
        if not records:
            return
        for r in records:
            yield r.dagster_run.run_id


def main() -> int:
    p = argparse.ArgumentParser(description="Prune Dagster runs older than a retention window.")
    p.add_argument("--weeks", type=int, default=8, help="Retention window in weeks (default: 8)")
    p.add_argument("--batch-size", type=int, default=500, help="Runs fetched per batch (default: 500)")
    p.add_argument(
        "--include-nonterminal",
        action="store_true",
        help="Also delete runs that are not in terminal states (NOT recommended).",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be deleted, but do not delete anything.",
    )
    p.add_argument(
        "--yes",
        action="store_true",
        help="Skip the interactive confirmation prompt.",
    )
    args = p.parse_args()

    # Use naive UTC to avoid tz-mismatch surprises; Dagster stores timestamps in DB and comparisons
    # are typically fine with naive UTC.
    now_utc = dt.datetime.utcnow()
    cutoff = now_utc - dt.timedelta(weeks=args.weeks)

    instance = DagsterInstance.get()

    statuses = None if args.include_nonterminal else TERMINAL_STATUSES

    if not args.yes:
        print(f"This will DELETE Dagster runs (and associated event logs) created before: {cutoff} UTC")
        print(f"Statuses: {'ALL' if statuses is None else [s.value for s in statuses]}")
        print("Type DELETE to continue:")
        if sys.stdin.readline().strip() != "DELETE":
            print("Aborted.")
            return 1

    deleted = 0
    for run_id in iter_old_run_ids(instance, cutoff, args.batch_size, statuses=statuses):
        if args.dry_run:
            print(f"[DRY RUN] Would delete run_id={run_id}")
            continue

        # Removes the run record and event logs from Postgres storage.
        instance.delete_run(run_id)

        # delete_run() does not clean up the local compute log directory; remove it explicitly.
        compute_log_dir = os.path.join(instance.dagster_home, "storage", run_id)
        if os.path.isdir(compute_log_dir):
            shutil.rmtree(compute_log_dir)

        deleted += 1

        if deleted % 100 == 0:
            print(f"Deleted {deleted} runs so far...")

    print(f"Done. Deleted {deleted} runs older than {args.weeks} weeks (cutoff={cutoff} UTC).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())