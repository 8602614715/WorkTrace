"""Tasks router - REST API for tasks per BACKEND_API spec."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from typing import Annotated, Optional

from database import get_db
from models import Task, User, SubTask, TaskComment, ActivityEvent, Notification
from schemas import (
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskResponse,
    SubTaskCreate,
    SubTaskUpdate,
    SubTaskResponse,
    TaskCommentCreate,
    TaskCommentResponse,
    ActivityEventResponse,
    TaskBulkUpdateRequest,
)
from dependencies import get_current_user, DbSession, CurrentUser

router = APIRouter(prefix="/tasks", tags=["tasks"])

VALID_STATUS = {"todo", "inProgress", "completed"}
VALID_PRIORITY = {"low", "medium", "high"}
VALID_ICONS = {"cpu", "grid", "file", "settings", "clock", "cart", "monitor", "users", "box"}
VALID_RECURRENCE = {"none", "daily", "weekly", "monthly"}
RECURRENCE_MARKER_PREFIX = "[WT_RECURRENCE="
RECURRENCE_MARKER_SUFFIX = "]"


def _extract_recurrence(description: str | None) -> tuple[str | None, str | None]:
    """Extract recurrence marker from description and return (recurrence, clean_description)."""
    if not description:
        return None, description
    marker_start = description.rfind(RECURRENCE_MARKER_PREFIX)
    if marker_start == -1:
        return None, description
    marker_end = description.find(RECURRENCE_MARKER_SUFFIX, marker_start)
    if marker_end == -1:
        return None, description
    marker_value = description[marker_start + len(RECURRENCE_MARKER_PREFIX):marker_end].strip().lower()
    recurrence = marker_value if marker_value in VALID_RECURRENCE and marker_value != "none" else None
    clean_description = description[:marker_start].rstrip() or None
    return recurrence, clean_description


def _attach_recurrence(description: str | None, recurrence: str | None) -> str | None:
    clean_recurrence, clean_description = _extract_recurrence(description)
    _ = clean_recurrence
    normalized = (recurrence or "").strip().lower()
    if normalized not in VALID_RECURRENCE:
        normalized = "none"
    if normalized == "none":
        return clean_description
    base = (clean_description or "").strip()
    marker = f"{RECURRENCE_MARKER_PREFIX}{normalized}{RECURRENCE_MARKER_SUFFIX}"
    if not base:
        return marker
    return f"{base}\n\n{marker}"


def _next_due_date(current_due_date: str | None, recurrence: str | None) -> str | None:
    recurrence = (recurrence or "").strip().lower()
    if recurrence not in VALID_RECURRENCE or recurrence == "none":
        return None
    try:
        base_date = datetime.strptime(current_due_date, "%Y-%m-%d").date() if current_due_date else datetime.utcnow().date()
    except ValueError:
        base_date = datetime.utcnow().date()
    if recurrence == "daily":
        next_date = base_date + timedelta(days=1)
    elif recurrence == "weekly":
        next_date = base_date + timedelta(days=7)
    else:
        # Month-safe increment without external dependency.
        year = base_date.year + (1 if base_date.month == 12 else 0)
        month = 1 if base_date.month == 12 else base_date.month + 1
        day = min(base_date.day, 28)
        next_date = base_date.replace(year=year, month=month, day=day)
    return next_date.isoformat()


def _spawn_next_recurring_task(
    db: DbSession,
    task: Task,
    recurrence: str | None,
    actor: CurrentUser,
) -> Task | None:
    recurrence = (recurrence or "").strip().lower()
    if recurrence not in VALID_RECURRENCE or recurrence == "none":
        return None
    next_due = _next_due_date(task.due_date, recurrence)
    next_task = Task(
        title=task.title,
        description=_attach_recurrence(task.description, recurrence),
        status="todo",
        priority=task.priority,
        due_date=next_due,
        assigned_to=task.assigned_to,
        progress=0,
        icon=task.icon or "file",
        user_id=task.user_id,
        project_id=task.project_id,
        sprint_id=task.sprint_id,
    )
    db.add(next_task)
    db.flush()
    _log_activity(
        db,
        task_id=next_task.id,
        actor_user_id=actor.id,
        event_type="task_created_recurring",
        detail=f"Recurring task generated from '{task.title}' ({recurrence}).",
    )
    return next_task


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
    recurrence, clean_description = _extract_recurrence(task.description)
    return TaskResponse(
        id=task.id,
        title=task.title,
        description=clean_description,
        status=task.status,
        priority=task.priority,
        dueDate=task.due_date,
        assignedTo=task.assigned_to,
        assignedToName=None,
        progress=task.progress,
        icon=task.icon or "file",
        projectId=task.project_id,
        sprintId=task.sprint_id,
        recurrence=recurrence,
        subtasks=[_subtask_to_response(s) for s in subtasks],
        createdAt=task.created_at.isoformat() if task.created_at else "",
        updatedAt=task.updated_at.isoformat() if task.updated_at else "",
    )


def _comment_to_response(comment: TaskComment, db: DbSession) -> TaskCommentResponse:
    author = db.query(User).filter(User.id == comment.user_id).first()
    return TaskCommentResponse(
        id=comment.id,
        taskId=comment.task_id,
        userId=comment.user_id,
        userName=author.name if author else "Unknown user",
        content=comment.content,
        createdAt=comment.created_at.isoformat() if comment.created_at else "",
        updatedAt=comment.updated_at.isoformat() if comment.updated_at else "",
    )


def _event_to_response(event: ActivityEvent, db: DbSession) -> ActivityEventResponse:
    actor = db.query(User).filter(User.id == event.actor_user_id).first() if event.actor_user_id else None
    return ActivityEventResponse(
        id=event.id,
        taskId=event.task_id,
        actorUserId=event.actor_user_id,
        actorName=actor.name if actor else None,
        eventType=event.event_type,
        detail=event.detail,
        createdAt=event.created_at.isoformat() if event.created_at else "",
    )


def _log_activity(
    db: DbSession,
    task_id: str,
    actor_user_id: str | None,
    event_type: str,
    detail: str,
) -> None:
    db.add(
        ActivityEvent(
            task_id=task_id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            detail=detail,
        )
    )


def _notify_user(
    db: DbSession,
    user_id: str | None,
    title: str,
    message: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> None:
    if not user_id:
        return
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        return
    db.add(
        Notification(
            user_id=target.id,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            is_read=0,
        )
    )


def _normalize_assignee_id(db: DbSession, assigned_to: str | None) -> str | None:
    if not assigned_to:
        return None
    user = db.query(User).filter(User.id == assigned_to).first()
    return user.id if user else assigned_to


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


@router.patch("/bulk", response_model=list[TaskResponse])
async def bulk_update_tasks(
    payload: TaskBulkUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    task_ids = list(dict.fromkeys(payload.taskIds))
    tasks = db.query(Task).filter(Task.id.in_(task_ids)).all()
    if len(tasks) != len(task_ids):
        raise HTTPException(status_code=400, detail="One or more taskIds are invalid")

    updated_tasks: list[Task] = []
    for task in tasks:
        if not _can_access_task(current_user, task):
            raise HTTPException(status_code=403, detail="Access denied to one or more tasks")
        if payload.delete:
            _log_activity(
                db,
                task_id=task.id,
                actor_user_id=current_user.id,
                event_type="task_deleted",
                detail=f"Task deleted in bulk: {task.title}",
            )
            db.delete(task)
            continue

        old_status = task.status
        if payload.status is not None:
            if payload.status not in VALID_STATUS:
                raise HTTPException(status_code=400, detail="Invalid status in bulk request")
            task.status = payload.status
        if payload.priority is not None:
            if payload.priority not in VALID_PRIORITY:
                raise HTTPException(status_code=400, detail="Invalid priority in bulk request")
            task.priority = payload.priority
        if payload.assignedTo is not None:
            task.assigned_to = _normalize_assignee_id(db, payload.assignedTo)
        if payload.sprintId is not None:
            task.sprint_id = payload.sprintId or None
        if payload.recurrence is not None:
            task.description = _attach_recurrence(task.description, payload.recurrence)

        if old_status != "completed" and task.status == "completed":
            recurrence, _ = _extract_recurrence(task.description)
            _spawn_next_recurring_task(
                db=db,
                task=task,
                recurrence=recurrence,
                actor=current_user,
            )
        _log_activity(
            db,
            task_id=task.id,
            actor_user_id=current_user.id,
            event_type="task_bulk_updated",
            detail="Task updated through bulk action.",
        )
        updated_tasks.append(task)

    db.commit()
    for task in updated_tasks:
        db.refresh(task)
    return [_task_to_response(task) for task in updated_tasks]


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

    recurrence_val = (payload.recurrence or "none").strip().lower()
    if recurrence_val not in VALID_RECURRENCE:
        recurrence_val = "none"
    assignee = _normalize_assignee_id(db, payload.assignedTo)
    task = Task(
        title=payload.title,
        description=_attach_recurrence(payload.description, recurrence_val),
        status=status_val,
        priority=priority_val,
        due_date=payload.dueDate,
        assigned_to=assignee,
        progress=payload.progress,
        icon=icon_val,
        user_id=current_user.id,
        project_id=payload.projectId,
    )
    db.add(task)
    db.flush()
    _log_activity(
        db,
        task_id=task.id,
        actor_user_id=current_user.id,
        event_type="task_created",
        detail=f"Task created: {task.title}",
    )
    if assignee and assignee != current_user.id:
        _notify_user(
            db,
            user_id=assignee,
            title="Task assigned to you",
            message=f"{current_user.name} assigned task '{task.title}' to you.",
            entity_type="task",
            entity_id=task.id,
        )
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

    old_status = task.status
    old_assignee = task.assigned_to
    old_title = task.title
    current_recurrence, _ = _extract_recurrence(task.description)
    update_data = payload.model_dump(exclude_unset=True)
    next_recurrence = update_data.pop("recurrence", None)
    for key, value in update_data.items():
        if key == "dueDate":
            setattr(task, "due_date", value)
        elif key == "assignedTo":
            setattr(task, "assigned_to", _normalize_assignee_id(db, value))
        elif key == "description":
            target_recurrence = next_recurrence if next_recurrence is not None else current_recurrence
            setattr(task, "description", _attach_recurrence(value, target_recurrence))
        else:
            setattr(task, key, value)
    if "description" not in update_data and next_recurrence is not None:
        setattr(task, "description", _attach_recurrence(task.description, next_recurrence))

    _log_activity(
        db,
        task_id=task.id,
        actor_user_id=current_user.id,
        event_type="task_updated",
        detail=f"Task updated: {old_title} (status {old_status} -> {task.status})",
    )
    if task.assigned_to and task.assigned_to != old_assignee and task.assigned_to != current_user.id:
        _notify_user(
            db,
            user_id=task.assigned_to,
            title="Task assignment updated",
            message=f"{current_user.name} assigned task '{task.title}' to you.",
            entity_type="task",
            entity_id=task.id,
        )
    if old_status != "completed" and task.status == "completed":
        recurrence, _ = _extract_recurrence(task.description)
        _spawn_next_recurring_task(
            db=db,
            task=task,
            recurrence=recurrence,
            actor=current_user,
        )

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

    old_status = task.status
    recurrence, _ = _extract_recurrence(task.description)
    task.status = payload.status
    _log_activity(
        db,
        task_id=task.id,
        actor_user_id=current_user.id,
        event_type="task_status_changed",
        detail=f"Status changed from {old_status} to {payload.status}",
    )
    notify_target = task.assigned_to if task.assigned_to and task.assigned_to != current_user.id else task.user_id
    if notify_target and notify_target != current_user.id:
        _notify_user(
            db,
            user_id=notify_target,
            title="Task status updated",
            message=f"{current_user.name} changed '{task.title}' to {payload.status}.",
            entity_type="task",
            entity_id=task.id,
        )
    if old_status != "completed" and payload.status == "completed":
        next_task = _spawn_next_recurring_task(
            db=db,
            task=task,
            recurrence=recurrence,
            actor=current_user,
        )
        if next_task and next_task.assigned_to and next_task.assigned_to != current_user.id:
            _notify_user(
                db,
                user_id=next_task.assigned_to,
                title="Recurring task generated",
                message=f"New recurring task '{next_task.title}' was generated.",
                entity_type="task",
                entity_id=next_task.id,
            )
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

    _log_activity(
        db,
        task_id=task.id,
        actor_user_id=current_user.id,
        event_type="task_deleted",
        detail=f"Task deleted: {task.title}",
    )
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
    _log_activity(
        db,
        task_id=task.id,
        actor_user_id=current_user.id,
        event_type="subtask_created",
        detail=f"Sub-task added: {subtask.title}",
    )
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

    previous_completed = bool(subtask.completed)
    previous_title = subtask.title
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
    if "completed" in update_data or "title" in update_data:
        state_msg = f"completed={previous_completed} -> {bool(subtask.completed)}"
        title_msg = f"title '{previous_title}' -> '{subtask.title}'"
        _log_activity(
            db,
            task_id=task.id,
            actor_user_id=current_user.id,
            event_type="subtask_updated",
            detail=f"Sub-task updated: {title_msg}, {state_msg}",
        )
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
    _log_activity(
        db,
        task_id=task.id,
        actor_user_id=current_user.id,
        event_type="subtask_deleted",
        detail=f"Sub-task deleted: {subtask.title}",
    )
    db.delete(subtask)
    db.commit()
    return {"message": "Sub-task deleted successfully"}


@router.get("/{task_id}/comments", response_model=list[TaskCommentResponse])
async def get_task_comments(
    task_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")
    comments = (
        db.query(TaskComment)
        .filter(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
        .all()
    )
    return [_comment_to_response(comment, db) for comment in comments]


@router.post("/{task_id}/comments", response_model=TaskCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_task_comment(
    task_id: str,
    payload: TaskCommentCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    comment = TaskComment(
        task_id=task.id,
        user_id=current_user.id,
        content=content,
    )
    db.add(comment)
    _log_activity(
        db,
        task_id=task.id,
        actor_user_id=current_user.id,
        event_type="comment_added",
        detail=f"Comment added by {current_user.name}",
    )

    recipients = {task.user_id, task.assigned_to}
    recipients.discard(current_user.id)
    for recipient_id in recipients:
        _notify_user(
            db,
            user_id=recipient_id,
            title="New task comment",
            message=f"{current_user.name} commented on '{task.title}'.",
            entity_type="task",
            entity_id=task.id,
        )

    db.commit()
    db.refresh(comment)
    return _comment_to_response(comment, db)


@router.get("/{task_id}/activity", response_model=list[ActivityEventResponse])
async def get_task_activity(
    task_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _can_access_task(current_user, task):
        raise HTTPException(status_code=403, detail="Access denied")
    events = (
        db.query(ActivityEvent)
        .filter(ActivityEvent.task_id == task_id)
        .order_by(ActivityEvent.created_at.desc())
        .all()
    )
    return [_event_to_response(event, db) for event in events]
