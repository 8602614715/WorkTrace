"""Users router - profile and password update."""
from fastapi import APIRouter, Depends, HTTPException

from models import User
from schemas import UserResponse, UserVerification
from dependencies import get_current_user, hash_password, verify_password, DbSession, CurrentUser

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: CurrentUser):
    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role or "user",
        avatar=current_user.avatar,
    )


@router.put("/password", status_code=204)
async def update_password(
    payload: UserVerification,
    current_user: CurrentUser,
    db: DbSession,
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect current password")

    user.password = hash_password(payload.new_password)
    db.add(user)
    db.commit()
