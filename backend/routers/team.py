"""Team router - REST API for team members."""
from datetime import datetime
import uuid
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_

from models import User, Task, Project
from schemas import (
    TeamMemberResponse,
    TeamInviteRequest,
    TeamInviteResponse,
    RoleUpdateRequest,
    TaskResponse,
    UserResponse,
)
from dependencies import hash_password, DbSession, CurrentUser
from routers.rbac import require_min_role

router = APIRouter(prefix="/team", tags=["team"])

ROLE_MAP = {
    "admin": "admin",
    "manager": "manager",
    "user": "user",
    "member": "user",
}


def _normalize_role(role: str) -> str:
    if not role:
        return "user"
    return ROLE_MAP.get(role.strip().lower(), "")


def _task_to_response(task: Task) -> TaskResponse:
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
        createdAt=task.created_at.isoformat() if task.created_at else "",
        updatedAt=task.updated_at.isoformat() if task.updated_at else "",
    )


@router.get("/members", response_model=list[TeamMemberResponse])
async def get_team_members(current_user: CurrentUser, db: DbSession):
    projects = (
        db.query(Project)
        .filter(
            or_(
                Project.owner_id == current_user.id,
                Project.members.any(User.id == current_user.id),
            )
        )
        .all()
    )
    member_ids = {current_user.id}
    for project in projects:
        if project.owner_id:
            member_ids.add(project.owner_id)
        for member in (project.members or []):
            member_ids.add(member.id)

    users = (
        db.query(User)
        .filter(User.id.in_(member_ids))
        .all()
        if member_ids
        else [current_user]
    )
    today = datetime.now().strftime("%b %d, %Y")
    members = []
    for u in users:
        tasks = db.query(Task).filter(Task.assigned_to == u.id).all()
        task_titles = [t.title for t in tasks]
        completed = [t for t in tasks if t.status == "completed"]
        in_progress = [t for t in tasks if t.status == "inProgress"]
        status = "working" if in_progress else "completed"
        current_task = in_progress[0].title if in_progress else None
        members.append(
            TeamMemberResponse(
                id=u.id,
                name=u.name,
                email=u.email,
                avatar=u.avatar,
                role=u.role or "user",
                status=status,
                tasks=task_titles[:5] or None,
                currentTask=current_task,
                date=today,
            )
        )
    return members


@router.get("/members/{member_id}", response_model=TeamMemberResponse)
async def get_team_member(
    member_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    user = db.query(User).filter(User.id == member_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    tasks = db.query(Task).filter(Task.assigned_to == user.id).all()
    task_titles = [t.title for t in tasks]
    in_progress = [t for t in tasks if t.status == "inProgress"]
    status = "working" if in_progress else "completed"
    current_task = in_progress[0].title if in_progress else None
    today = datetime.now().strftime("%b %d, %Y")
    return TeamMemberResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        avatar=user.avatar,
        role=user.role or "user",
        status=status,
        tasks=task_titles[:5] or None,
        currentTask=current_task,
        date=today,
    )


@router.get("/members/{member_id}/tasks", response_model=list[TaskResponse])
async def get_member_tasks(
    member_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    if current_user.id != member_id and current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    user = db.query(User).filter(User.id == member_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    tasks = db.query(Task).filter(Task.assigned_to == user.id).all()
    return [_task_to_response(t) for t in tasks]


@router.post("/invite", response_model=TeamInviteResponse, status_code=status.HTTP_201_CREATED)
@require_min_role("manager")
async def invite_member(
    payload: TeamInviteRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = _normalize_role(payload.role or "user")
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")
    if role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can assign admin role")

    temp_password = None
    password_value = payload.password
    if not password_value:
        temp_password = uuid.uuid4().hex[:10]
        password_value = temp_password

    user = User(
        name=payload.name,
        email=payload.email,
        password=hash_password(password_value),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TeamInviteResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role or "user",
        avatar=user.avatar,
        tempPassword=temp_password,
    )


@router.put("/members/{member_id}/role", response_model=UserResponse)
@require_min_role("manager")
async def update_member_role(
    member_id: str,
    payload: RoleUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    user = db.query(User).filter(User.id == member_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")

    role = _normalize_role(payload.role)
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")
    if role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can assign admin role")
    if user.role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update admins")

    user.role = role
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role or "user",
        avatar=user.avatar,
    )


@router.delete("/members/{member_id}")
@require_min_role("manager")
async def remove_member(
    member_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    if current_user.id == member_id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")
    user = db.query(User).filter(User.id == member_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    if user.role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can remove admins")
    db.delete(user)
    db.commit()
    return {"message": "Member removed successfully"}
