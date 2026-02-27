"""Reports router - aggregated report data."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Query
from sqlalchemy import or_

from models import Task, Project, User
from dependencies import get_current_user, DbSession, CurrentUser

router = APIRouter(prefix="/reports", tags=["reports"])

DEFAULT_TREND_POINTS = 12


def _task_base_query(current_user: CurrentUser, db: DbSession):
    query = db.query(Task)
    if current_user.role in ("manager", "admin"):
        return query
    return query.filter(Task.user_id == current_user.id)


def _project_base_query(current_user: CurrentUser, db: DbSession):
    query = db.query(Project)
    if current_user.role in ("manager", "admin"):
        return query
    return query.filter(
        or_(
            Project.owner_id == current_user.id,
            Project.members.any(User.id == current_user.id),
        )
    )


@router.get("/summary")
async def get_report_summary(
    current_user: CurrentUser,
    db: DbSession,
):
    """Overall report summary: tasks, projects, completion rates."""
    tasks = _task_base_query(current_user, db).all()
    projects = _project_base_query(current_user, db).all()
    total = len(tasks)
    completed = len([t for t in tasks if t.status == "completed"])
    in_progress = len([t for t in tasks if t.status == "inProgress"])
    todo = len([t for t in tasks if t.status == "todo"])
    completion_rate = int((completed / total * 100)) if total > 0 else 0
    return {
        "totalTasks": total,
        "completedTasks": completed,
        "inProgressTasks": in_progress,
        "todoTasks": todo,
        "completionRate": completion_rate,
        "totalProjects": len(projects),
    }


@router.get("/task-completion")
async def get_task_completion_report(
    current_user: CurrentUser,
    db: DbSession,
    weeks: int = Query(8, ge=1, le=52),
):
    """Task completion trend over time."""
    tasks = _task_base_query(current_user, db).order_by(Task.created_at).all()
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
async def get_productivity_report(
    current_user: CurrentUser,
    db: DbSession,
    period: str = Query("month", pattern="^(week|month|year)$"),
):
    """Productivity metrics report."""
    today = datetime.utcnow().date()
    days = 7 if period == "week" else (30 if period == "month" else 365)
    start_date = today - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)
    tasks = _task_base_query(current_user, db).all()
    tasks_in_period = [t for t in tasks if t.created_at and t.created_at.date() >= start_date]
    total = len(tasks_in_period)
    completed = len([t for t in tasks_in_period if t.status == "completed"])
    score = (completed / total * 10) if total > 0 else 0.0
    prev_tasks = [t for t in tasks if t.created_at and prev_start <= t.created_at.date() < start_date]
    prev_total = len(prev_tasks)
    prev_completed = len([t for t in prev_tasks if t.status == "completed"])
    prev_score = (prev_completed / prev_total * 10) if prev_total > 0 else 0.0
    trend = int(((score - prev_score) / prev_score * 100)) if prev_score > 0 else 0
    return {
        "score": round(score, 1),
        "trend": trend,
        "previousScore": round(prev_score, 1),
        "period": period,
        "tasksCompleted": completed,
        "tasksTotal": total,
    }


@router.get("/by-priority")
async def get_tasks_by_priority_report(
    current_user: CurrentUser,
    db: DbSession,
):
    """Task breakdown by priority."""
    tasks = _task_base_query(current_user, db).all()
    high = len([t for t in tasks if t.priority == "high"])
    medium = len([t for t in tasks if t.priority == "medium"])
    low = len([t for t in tasks if t.priority == "low"])
    return {
        "high": high,
        "medium": medium,
        "low": low,
        "total": len(tasks),
    }


@router.get("/by-status")
async def get_tasks_by_status_report(
    current_user: CurrentUser,
    db: DbSession,
):
    """Task breakdown by status."""
    tasks = _task_base_query(current_user, db).all()
    return {
        "todo": len([t for t in tasks if t.status == "todo"]),
        "inProgress": len([t for t in tasks if t.status == "inProgress"]),
        "completed": len([t for t in tasks if t.status == "completed"]),
        "total": len(tasks),
    }


@router.get("/productivity-trends")
async def get_productivity_trends(
    current_user: CurrentUser,
    db: DbSession,
    period: str = Query("week", pattern="^(week|month)$"),
    points: int = Query(DEFAULT_TREND_POINTS, ge=4, le=24),
):
    """Productivity trends based on completed tasks over time."""
    tasks = _task_base_query(current_user, db).all()
    completed_tasks = [t for t in tasks if t.status == "completed" and t.updated_at]

    today = datetime.utcnow().date()
    labels = []
    data = []

    if period == "month":
        for i in range(points - 1, -1, -1):
            month_start = (today.replace(day=1) - timedelta(days=30 * i))
            label = month_start.strftime("%b %Y")
            labels.append(label)
            month_end = month_start + timedelta(days=31)
            count = len([
                t for t in completed_tasks
                if t.updated_at and month_start <= t.updated_at.date() < month_end
            ])
            data.append(count)
    else:
        for i in range(points - 1, -1, -1):
            start = today - timedelta(days=7 * i)
            end = start + timedelta(days=7)
            label = start.strftime("%b %d")
            labels.append(label)
            count = len([
                t for t in completed_tasks
                if t.updated_at and start <= t.updated_at.date() < end
            ])
            data.append(count)

    return {"labels": labels, "data": data, "period": period}


@router.get("/project-performance")
async def get_project_performance(
    current_user: CurrentUser,
    db: DbSession,
):
    """Project-wise performance based on task completion."""
    projects = _project_base_query(current_user, db).all()
    results = []
    for project in projects:
        tasks = list(project.tasks or [])
        total = len(tasks)
        completed = len([t for t in tasks if t.status == "completed"])
        completion_rate = int((completed / total) * 100) if total > 0 else 0
        results.append({
            "id": project.id,
            "name": project.name,
            "totalTasks": total,
            "completedTasks": completed,
            "completionRate": completion_rate,
        })
    return {"projects": results}
