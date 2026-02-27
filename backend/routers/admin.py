"""Admin router - admin-only endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from models import User, Task
from schemas import UserResponse
from dependencies import get_current_user, DbSession, CurrentUser
from routers.rbac import require_role

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
@require_role(["admin"])
async def list_all_users(current_user: CurrentUser, db: DbSession):
    users = db.query(User).all()
    return [
        UserResponse(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role or "user",
            avatar=u.avatar,
        )
        for u in users
    ]


@router.get("/tasks")
@require_role(["admin"])
async def list_all_tasks(current_user: CurrentUser, db: DbSession):
    tasks = db.query(Task).all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "user_id": t.user_id,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tasks
    ]
