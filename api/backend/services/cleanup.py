"""Periodic cleanup jobs."""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.exc import ProgrammingError

from database import SessionLocal
from models import Task


def _is_undefined_table_error(exc: Exception) -> bool:
    """True when DB reports relation/table does not exist."""
    # PostgreSQL undefined_table SQLSTATE
    pgcode = getattr(getattr(exc, "orig", None), "pgcode", None)
    if pgcode == "42P01":
        return True
    msg = str(exc).lower()
    return "undefinedtable" in msg or "relation \"tasks\" does not exist" in msg


def cleanup_completed_tasks_once() -> int:
    """
    Delete completed tasks that have stayed completed for at least 1 day.
    Returns number of deleted rows.
    """
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=1)
        deleted = db.query(Task).filter(
            func.lower(Task.status) == "completed",
            Task.updated_at.isnot(None),
            Task.updated_at <= cutoff,
        ).delete(synchronize_session=False)
        db.commit()
        return deleted or 0
    except ProgrammingError as exc:
        db.rollback()
        if _is_undefined_table_error(exc):
            # Migrations may not have been applied yet in a fresh DB.
            return 0
        raise
    finally:
        db.close()


async def completed_task_cleanup_scheduler(stop_event: asyncio.Event) -> None:
    """Run completed-task cleanup every N seconds (default: 1 day)."""
    interval = int(os.getenv("TASK_CLEANUP_INTERVAL_SECONDS", "86400"))
    while not stop_event.is_set():
        try:
            cleanup_completed_tasks_once()
        except Exception as exc:  # pragma: no cover
            print(f"[task_cleanup] Cycle failed: {exc}")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue
