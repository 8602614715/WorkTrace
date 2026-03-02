"""Sprints router - REST API for sprints."""
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException

from models import Sprint, Project, Task
from schemas import SprintCreate, SprintUpdate, SprintResponse, SprintTaskAssign, TaskResponse
from dependencies import DbSession, CurrentUser

router = APIRouter(prefix="/sprints", tags=["sprints"])

VALID_STATUS = {"planned", "active", "completed"}


def _validate_sprint_date_range(start_date: str, end_date: str) -> None:
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if end < start:
        raise HTTPException(status_code=400, detail="end_date cannot be earlier than start_date")


def _validate_project_access(project_id: str, current_user: CurrentUser, db: DbSession) -> None:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    is_member = any(m.id == current_user.id for m in (project.members or []))
    if project.owner_id != current_user.id and not is_member and current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")


def _sprint_to_response(s: Sprint) -> SprintResponse:
    tasks = list(s.tasks or [])
    total = len(tasks)
    completed = len([t for t in tasks if t.status == "completed"])
    progress = int((completed / total) * 100) if total > 0 else 0
    duration_days = 1
    try:
        start = datetime.fromisoformat(s.start_date)
        end = datetime.fromisoformat(s.end_date)
        duration_days = max((end - start).days + 1, 1)
    except ValueError:
        duration_days = 1
    velocity = round(completed / duration_days, 2)
    return SprintResponse(
        id=s.id,
        name=s.name,
        goal=s.goal,
        start_date=s.start_date,
        end_date=s.end_date,
        status=s.status or "planned",
        project_id=s.project_id,
        totalTasks=total,
        completedTasks=completed,
        progress=progress,
        velocity=velocity,
        durationDays=duration_days,
        createdAt=s.created_at.isoformat() if s.created_at else None,
    )


def _can_access_sprint(user: CurrentUser, sprint: Sprint) -> bool:
    if sprint.owner_id == user.id:
        return True
    if user.role in ("manager", "admin"):
        return True
    return False


def _to_task_response(t: Task) -> TaskResponse:
    return TaskResponse(
        id=t.id,
        title=t.title,
        description=t.description,
        status=t.status,
        priority=t.priority,
        dueDate=t.due_date,
        assignedTo=t.assigned_to,
        assignedToName=None,
        progress=t.progress,
        icon=t.icon or "file",
        projectId=t.project_id,
        sprintId=t.sprint_id,
        createdAt=t.created_at.isoformat() if t.created_at else "",
        updatedAt=t.updated_at.isoformat() if t.updated_at else "",
    )


@router.get("", response_model=list[SprintResponse])
async def get_sprints(current_user: CurrentUser, db: DbSession):
    query = db.query(Sprint)
    if current_user.role in ("manager", "admin"):
        pass
    else:
        query = query.filter(Sprint.owner_id == current_user.id)
    sprints = query.order_by(Sprint.start_date.desc()).all()
    return [_sprint_to_response(s) for s in sprints]


@router.get("/{sprint_id}", response_model=SprintResponse)
async def get_sprint(
    sprint_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if not _can_access_sprint(current_user, sprint):
        raise HTTPException(status_code=403, detail="Access denied")
    return _sprint_to_response(sprint)


@router.post("", response_model=SprintResponse, status_code=201)
async def create_sprint(
    payload: SprintCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    if payload.project_id:
        _validate_project_access(payload.project_id, current_user, db)
    _validate_sprint_date_range(payload.start_date, payload.end_date)

    status_val = payload.status if payload.status in VALID_STATUS else "planned"
    sprint = Sprint(
        name=payload.name,
        goal=payload.goal,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=status_val,
        project_id=payload.project_id,
        owner_id=current_user.id,
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return _sprint_to_response(sprint)


@router.put("/{sprint_id}", response_model=SprintResponse)
async def update_sprint(
    sprint_id: str,
    payload: SprintUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if not _can_access_sprint(current_user, sprint):
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = payload.model_dump(exclude_unset=True)
    if "project_id" in update_data and update_data["project_id"]:
        _validate_project_access(update_data["project_id"], current_user, db)
    next_start_date = update_data.get("start_date", sprint.start_date)
    next_end_date = update_data.get("end_date", sprint.end_date)
    _validate_sprint_date_range(next_start_date, next_end_date)

    for key, value in update_data.items():
        if key == "status" and value not in VALID_STATUS:
            continue
        setattr(sprint, key, value)
    db.commit()
    db.refresh(sprint)
    return _sprint_to_response(sprint)


@router.delete("/{sprint_id}")
async def delete_sprint(
    sprint_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if not _can_access_sprint(current_user, sprint):
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(sprint)
    db.commit()
    return {"message": "Sprint deleted successfully"}


@router.get("/{sprint_id}/tasks")
async def get_sprint_tasks(
    sprint_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if not _can_access_sprint(current_user, sprint):
        raise HTTPException(status_code=403, detail="Access denied")
    tasks = db.query(Task).filter(Task.sprint_id == sprint_id).all()
    return [_to_task_response(t) for t in tasks]


@router.get("/{sprint_id}/analytics")
async def get_sprint_analytics(
    sprint_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if not _can_access_sprint(current_user, sprint):
        raise HTTPException(status_code=403, detail="Access denied")

    tasks = db.query(Task).filter(Task.sprint_id == sprint_id).all()
    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.status == "completed"])

    try:
        start_date = datetime.fromisoformat(sprint.start_date).date()
        end_date = datetime.fromisoformat(sprint.end_date).date()
    except ValueError:
        today = datetime.utcnow().date()
        start_date = today - timedelta(days=6)
        end_date = today

    if end_date < start_date:
        end_date = start_date

    duration_days = max((end_date - start_date).days + 1, 1)
    labels: list[str] = []
    ideal_remaining: list[float] = []
    actual_remaining: list[int] = []
    velocity_labels: list[str] = []
    velocity_data: list[int] = []

    prev_completed = 0
    for i in range(duration_days):
        day = start_date + timedelta(days=i)
        labels.append(day.strftime("%b %d"))
        velocity_labels.append(day.strftime("%b %d"))
        elapsed = i + 1
        ideal = max(total_tasks - ((total_tasks / duration_days) * elapsed), 0)
        ideal_remaining.append(round(ideal, 2))

        completed_by_day = len([
            t for t in tasks
            if t.status == "completed" and t.updated_at and t.updated_at.date() <= day
        ])
        actual_remaining.append(max(total_tasks - completed_by_day, 0))
        velocity_data.append(max(completed_by_day - prev_completed, 0))
        prev_completed = completed_by_day

    today = datetime.utcnow().date()
    elapsed_days = 0
    if today >= start_date:
        elapsed_days = min((today - start_date).days + 1, duration_days)
    avg_completion = round((completed_tasks / elapsed_days), 2) if elapsed_days > 0 else 0.0

    return {
        "sprintId": sprint.id,
        "burndown": {
            "labels": labels,
            "idealRemaining": ideal_remaining,
            "actualRemaining": actual_remaining,
        },
        "velocityTrend": {
            "labels": velocity_labels,
            "data": velocity_data,
        },
        "summary": {
            "totalTasks": total_tasks,
            "completedTasks": completed_tasks,
            "remainingTasks": max(total_tasks - completed_tasks, 0),
            "durationDays": duration_days,
            "elapsedDays": elapsed_days,
            "avgCompletionPerDay": avg_completion,
        },
    }


@router.post("/{sprint_id}/tasks", response_model=list[TaskResponse])
async def add_tasks_to_sprint(
    sprint_id: str,
    payload: SprintTaskAssign,
    current_user: CurrentUser,
    db: DbSession,
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if not _can_access_sprint(current_user, sprint):
        raise HTTPException(status_code=403, detail="Access denied")
    tasks = db.query(Task).filter(Task.id.in_(payload.taskIds)).all()
    if len(tasks) != len(set(payload.taskIds)):
        raise HTTPException(status_code=400, detail="One or more taskIds are invalid")
    for task in tasks:
        if current_user.role not in ("manager", "admin") and task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to one or more tasks")
        task.sprint_id = sprint_id
    db.commit()
    return [_to_task_response(t) for t in tasks]


@router.delete("/{sprint_id}/tasks/{task_id}")
async def remove_task_from_sprint(
    sprint_id: str,
    task_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if not _can_access_sprint(current_user, sprint):
        raise HTTPException(status_code=403, detail="Access denied")
    task = db.query(Task).filter(Task.id == task_id, Task.sprint_id == sprint_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found in sprint")
    if current_user.role not in ("manager", "admin") and task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    task.sprint_id = None
    db.commit()
    return {"message": "Task removed from sprint"}


@router.get("/tasks/backlog")
async def get_backlog_tasks(
    current_user: CurrentUser,
    db: DbSession,
    project_id: str | None = None,
):
    query = db.query(Task).filter(Task.sprint_id.is_(None))
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if current_user.role not in ("manager", "admin"):
        query = query.filter(Task.user_id == current_user.id)
    tasks = query.order_by(Task.created_at.desc()).all()
    return [_to_task_response(t) for t in tasks]
