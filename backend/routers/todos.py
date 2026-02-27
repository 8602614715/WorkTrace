"""Tasks router - REST API for tasks per BACKEND_API spec."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from typing import Annotated, Optional

from database import get_db
from models import Task, User, SubTask
from schemas import (
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskResponse,
    SubTaskCreate,
    SubTaskUpdate,
    SubTaskResponse,
)
from dependencies import get_current_user, DbSession, CurrentUser

router = APIRouter(prefix="/tasks", tags=["tasks"])

VALID_STATUS = {"todo", "inProgress", "completed"}
VALID_PRIORITY = {"low", "medium", "high"}
VALID_ICONS = {"cpu", "grid", "file", "settings", "clock", "cart", "monitor", "users", "box"}


def _subtask_to_response(subtask: SubTask) -> SubTaskResponse:
    return SubTaskResponse(
        id=subtask.id,
        title=subtask.title,
        completed=bool(subtask.completed),
        sortOrder=subtask.sort_order or 0,
        createdAt=subtask.created_at.isoformat() if subtask.created_at else "",
        updatedAt=subtask.updated_at.isoformat() if subtask.updated_at else "",
    )


def _task_to_response(task: Task) -> TaskResponse:
    subtasks = sorted((task.subtasks or []), key=lambda s: (s.sort_order or 0, s.created_at))
    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        dueDate=task.due_date,
        assignedTo=task.assigned_to,
        progress=task.progress,
        icon=task.icon or "file",
        projectId=task.project_id,
        sprintId=task.sprint_id,
        subtasks=[_subtask_to_response(s) for s in subtasks],
        createdAt=task.created_at.isoformat() if task.created_at else "",
        updatedAt=task.updated_at.isoformat() if task.updated_at else "",
    )


def _can_access_task(user: User, task: Task) -> bool:
    """User can access own tasks; manager/admin can access all."""
    if user.id == task.user_id:
        return True
    if user.role in ("manager", "admin"):
        return True
    return False


@router.get("", response_model=list[TaskResponse])
async def get_tasks(
    current_user: CurrentUser,
    db: DbSession,
    q: Optional[str] = Query(None, alias="q"),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    project_id: Optional[str] = Query(None, alias="projectId"),
    due_from: Optional[str] = Query(None, alias="dueFrom"),
    due_to: Optional[str] = Query(None, alias="dueTo"),
    overdue_only: bool = Query(False, alias="overdueOnly"),
):
    query = db.query(Task)
    if current_user.role in ("manager", "admin"):
        pass
    else:
        query = query.filter(Task.user_id == current_user.id)
    if status_filter and status_filter in VALID_STATUS:
        query = query.filter(Task.status == status_filter)
    if priority_filter and priority_filter in VALID_PRIORITY:
        query = query.filter(Task.priority == priority_filter)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if due_from:
        query = query.filter(Task.due_date.isnot(None), Task.due_date >= due_from)
    if due_to:
        query = query.filter(Task.due_date.isnot(None), Task.due_date <= due_to)
    if overdue_only:
        today = datetime.utcnow().date().isoformat()
        query = query.filter(
            Task.due_date.isnot(None),
            Task.due_date < today,
            func.lower(Task.status) != "completed",
        )
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Task.title.ilike(pattern),
                Task.description.ilike(pattern),
                Task.assigned_to.ilike(pattern),
            )
        )
    tasks = query.order_by(Task.created_at.desc()).all()
    return [_task_to_response(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")
    return _task_to_response(task)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    status_val = payload.status if payload.status in VALID_STATUS else "todo"
    priority_val = payload.priority if payload.priority in VALID_PRIORITY else "medium"
    icon_val = payload.icon if payload.icon in VALID_ICONS else "file"

    task = Task(
        title=payload.title,
        description=payload.description,
        status=status_val,
        priority=priority_val,
        due_date=payload.dueDate,
        assigned_to=payload.assignedTo,
        progress=payload.progress,
        icon=icon_val,
        user_id=current_user.id,
        project_id=payload.projectId,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_to_response(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "dueDate":
            setattr(task, "due_date", value)
        elif key == "assignedTo":
            setattr(task, "assigned_to", value)
        else:
            setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return _task_to_response(task)


@router.patch("/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    task_id: str,
    payload: TaskStatusUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")
    if payload.status not in VALID_STATUS:
        raise HTTPException(status_code=400, detail="Invalid status")

    task.status = payload.status
    db.commit()
    db.refresh(task)
    return _task_to_response(task)


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}


@router.get("/{task_id}/subtasks", response_model=list[SubTaskResponse])
async def get_subtasks(
    task_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")
    subtasks = (
        db.query(SubTask)
        .filter(SubTask.task_id == task_id)
        .order_by(SubTask.sort_order.asc(), SubTask.created_at.asc())
        .all()
    )
    return [_subtask_to_response(s) for s in subtasks]


@router.post("/{task_id}/subtasks", response_model=SubTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_subtask(
    task_id: str,
    payload: SubTaskCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")

    max_order = db.query(func.max(SubTask.sort_order)).filter(SubTask.task_id == task_id).scalar()
    subtask = SubTask(
        title=payload.title.strip(),
        task_id=task_id,
        completed=0,
        sort_order=(max_order or 0) + 1,
    )
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    return _subtask_to_response(subtask)


@router.put("/{task_id}/subtasks/{subtask_id}", response_model=SubTaskResponse)
async def update_subtask(
    task_id: str,
    subtask_id: str,
    payload: SubTaskUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")

    subtask = db.query(SubTask).filter(SubTask.id == subtask_id, SubTask.task_id == task_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Sub-task not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "sortOrder":
            setattr(subtask, "sort_order", value)
        elif key == "completed":
            setattr(subtask, "completed", 1 if value else 0)
        elif key == "title":
            setattr(subtask, key, value.strip())
        else:
            setattr(subtask, key, value)
    db.commit()
    db.refresh(subtask)
    return _subtask_to_response(subtask)


@router.delete("/{task_id}/subtasks/{subtask_id}")
async def delete_subtask(
    task_id: str,
    subtask_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")

    subtask = db.query(SubTask).filter(SubTask.id == subtask_id, SubTask.task_id == task_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Sub-task not found")
    db.delete(subtask)
    db.commit()
    return {"message": "Sub-task deleted successfully"}
