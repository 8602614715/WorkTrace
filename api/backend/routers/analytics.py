"""Analytics router - task completion and productivity metrics."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Task
from dependencies import get_current_user, DbSession, CurrentUser

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/task-completion")
async def get_task_completion(
    current_user: CurrentUser,
    db: DbSession,
    weeks: int = Query(8, ge=1, le=52),
):
    tasks = db.query(Task).filter(Task.user_id == current_user.id).order_by(Task.created_at).all()
    labels = [f"Week {i+1}" for i in range(weeks)]
    if not tasks:
        return {"data": [0] * weeks, "labels": labels}
    total = len(tasks)
    step = max(1, total // weeks)
    data = []
    for i in range(weeks):
        idx = min((i + 1) * step - 1, total - 1) if (i + 1) * step <= total else total - 1
        if idx >= 0:
            completed = len([t for t in tasks[: idx + 1] if t.status == "completed"])
            pct = int((completed / (idx + 1)) * 100)
        else:
            pct = 0
        data.append(pct)
    return {"data": data[:weeks], "labels": labels[:weeks]}


@router.get("/productivity")
async def get_productivity(
    current_user: CurrentUser,
    db: DbSession,
    period: str = Query("month", pattern="^(week|month|year)$"),
):
    today = datetime.utcnow().date()
    if period == "week":
        days = 7
    elif period == "month":
        days = 30
    else:
        days = 365

    start_date = today - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)

    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.created_at != None,
        )
        .all()
    )
    tasks_in_period = [t for t in tasks if t.created_at and t.created_at.date() >= start_date]
    total = len(tasks_in_period)
    completed = len([t for t in tasks_in_period if t.status == "completed"])
    score = (completed / total * 10) if total > 0 else 0.0
    prev_tasks = [
        t
        for t in tasks
        if t.created_at and prev_start <= t.created_at.date() < start_date
    ]
    prev_total = len(prev_tasks)
    prev_completed = len([t for t in prev_tasks if t.status == "completed"])
    prev_score = (prev_completed / prev_total * 10) if prev_total > 0 else 0.0
    trend = int(((score - prev_score) / prev_score * 100)) if prev_score > 0 else 0
    return {
        "score": round(score, 1),
        "trend": trend,
        "previousScore": round(prev_score, 1),
        "period": period,
    }
