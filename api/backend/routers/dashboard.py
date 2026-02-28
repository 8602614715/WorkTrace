"""Dashboard router - summary and overview API endpoints."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Task
from dependencies import get_current_user, DbSession, CurrentUser

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(
    current_user: CurrentUser,
    db: DbSession,
):
    tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    today = datetime.utcnow().date()
    return {
        "total_project": len(tasks),
        "ongoing_project": len([t for t in tasks if t.status == "inProgress"]),
        "upcoming_projects": len(
            [
                t
                for t in tasks
                if t.status == "todo"
                and t.due_date
                and t.due_date >= today.isoformat()
            ]
        ),
        "complete_project": len([t for t in tasks if t.status == "completed"]),
    }


@router.get("/today-tasks")
async def get_today_tasks(current_user: CurrentUser, db: DbSession):
    today = datetime.utcnow().date()
    tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.created_at.desc())
        .limit(10)
        .all()
    )
    today_tasks = [
        t
        for t in tasks
        if t.created_at and t.created_at.date() == today
    ]
    return {
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "completed": t.status == "completed",
            }
            for t in today_tasks[:4]
        ]
    }


@router.get("/analytics")
async def get_analytics(
    current_user: CurrentUser,
    db: DbSession,
    period: str = Query("week", pattern="^(week|month|year)$"),
):
    today = datetime.utcnow().date()
    days = 7 if period == "week" else (30 if period == "month" else 365)
    tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    data = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        count = sum(
            1
            for t in tasks
            if t.created_at and t.created_at.date() == day
        )
        data.append({"date": day.isoformat(), "day": day.strftime("%a"), "count": count})
    return {"data": data}
