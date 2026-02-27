"""Deadlines router - REST API for deadlines."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import Deadline, Project, Task, User
from schemas import DeadlineCreate, DeadlineUpdate, DeadlineResponse
from dependencies import get_current_user, DbSession, CurrentUser

router = APIRouter(prefix="/deadlines", tags=["deadlines"])


def _deadline_to_response(d: Deadline) -> DeadlineResponse:
    return DeadlineResponse(
        id=d.id,
        title=d.title,
        name=d.title,
        date=d.date,
        description=d.description,
        projectId=d.project_id,
    )


def _can_access_deadline(current_user: User, deadline: Deadline, db: Session) -> bool:
    if not deadline.project_id:
        return True
    project = db.query(Project).filter(Project.id == deadline.project_id).first()
    if not project:
        return True
    return project.owner_id == current_user.id


@router.get("", response_model=list[DeadlineResponse])
async def get_deadlines(current_user: CurrentUser, db: DbSession):
    active_project_ids = [
        p.id
        for p in db.query(Project).filter(
            Project.owner_id == current_user.id,
            or_(Project.status.is_(None), func.lower(Project.status) != "completed"),
        ).all()
    ]
    deadlines_data = db.query(Deadline).filter(
        (Deadline.project_id == None) | (Deadline.project_id.in_(active_project_ids))
    ).order_by(Deadline.date).all()

    response_items = [_deadline_to_response(d) for d in deadlines_data]

    project_deadlines = db.query(Project).filter(
        Project.owner_id == current_user.id,
        Project.deadline.isnot(None),
        or_(Project.status.is_(None), func.lower(Project.status) != "completed"),
    ).all()
    for project in project_deadlines:
        response_items.append(
            DeadlineResponse(
                id=f"project:{project.id}",
                title=f"{project.name} deadline",
                name=f"{project.name} deadline",
                date=project.deadline,
                description=project.description,
                projectId=project.id,
            )
        )

    task_due_dates = db.query(Task).filter(
        Task.user_id == current_user.id,
        Task.due_date.isnot(None),
        or_(Task.status.is_(None), func.lower(Task.status) != "completed"),
    ).all()
    for task in task_due_dates:
        response_items.append(
            DeadlineResponse(
                id=f"task:{task.id}",
                title=f"{task.title} due",
                name=f"{task.title} due",
                date=task.due_date,
                description=task.description,
                projectId=task.project_id,
            )
        )

    unique: dict[tuple[str, str, str | None], DeadlineResponse] = {}
    for item in response_items:
        unique[(item.title, item.date, item.projectId)] = item

    def _sort_key(item: DeadlineResponse):
        try:
            return datetime.strptime(item.date, "%Y-%m-%d")
        except ValueError:
            return datetime.max

    return sorted(unique.values(), key=_sort_key)


@router.get("/{deadline_id}", response_model=DeadlineResponse)
async def get_deadline(
    deadline_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")
    if not _can_access_deadline(current_user, deadline, db):
        raise HTTPException(status_code=403, detail="Access denied")
    return _deadline_to_response(deadline)


@router.post("", response_model=DeadlineResponse, status_code=201)
async def create_deadline(
    payload: DeadlineCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    if payload.projectId:
        project = db.query(Project).filter(Project.id == payload.projectId).first()
        if not project or project.owner_id != current_user.id:
            raise HTTPException(status_code=404, detail="Project not found")
    deadline = Deadline(
        title=payload.title,
        date=payload.date,
        description=payload.description,
        project_id=payload.projectId,
    )
    db.add(deadline)
    db.commit()
    db.refresh(deadline)
    return _deadline_to_response(deadline)


@router.put("/{deadline_id}", response_model=DeadlineResponse)
async def update_deadline(
    deadline_id: str,
    payload: DeadlineUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")
    if not _can_access_deadline(current_user, deadline, db):
        raise HTTPException(status_code=403, detail="Access denied")

    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "projectId":
            setattr(deadline, "project_id", value)
        else:
            setattr(deadline, key, value)
    db.commit()
    db.refresh(deadline)
    return _deadline_to_response(deadline)


@router.delete("/{deadline_id}")
async def delete_deadline(
    deadline_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")
    if not _can_access_deadline(current_user, deadline, db):
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(deadline)
    db.commit()
    return {"message": "Deadline deleted successfully"}
