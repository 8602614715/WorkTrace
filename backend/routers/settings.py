"""Settings router - user profile and preferences for settings page."""
from fastapi import APIRouter, File, HTTPException, UploadFile

from models import User
from schemas import (
    AvatarUploadResponse,
    UserSettingsResponse,
    UserProfileUpdate,
    UserVerification,
    UserPreferencesUpdate,
    WorkspaceUpdate,
)
from dependencies import hash_password, verify_password, DbSession, CurrentUser
from services.supabase_storage import upload_avatar_to_supabase

router = APIRouter(prefix="/settings", tags=["settings"])

INTEGRATIONS_PLACEHOLDER = [
    {"id": "email", "name": "Email", "status": "coming_soon"},
    {"id": "calendar", "name": "Calendar", "status": "coming_soon"},
]


def _settings_response(user: User) -> UserSettingsResponse:
    return UserSettingsResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role or "user",
        avatar=user.avatar,
        themePreference=user.theme_pref,
        notifyEmail=bool(user.notify_email),
        notifyInApp=bool(user.notify_inapp),
        reminderHours=user.reminder_hours or 24,
        workspaceName=user.workspace_name,
        workspaceTimezone=user.workspace_timezone,
        integrations=INTEGRATIONS_PLACEHOLDER,
        createdAt=user.created_at.isoformat() if user.created_at else None,
    )


@router.get("/user", response_model=UserSettingsResponse)
async def get_user_settings(current_user: CurrentUser):
    """Get current user information for settings page."""
    return _settings_response(current_user)


@router.put("/user", response_model=UserSettingsResponse)
async def update_user_profile(
    payload: UserProfileUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update user profile (name, avatar). Partial update."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.name is not None:
        user.name = payload.name
    if payload.avatar is not None:
        user.avatar = payload.avatar
    db.commit()
    db.refresh(user)
    return _settings_response(user)


@router.put("/preferences", response_model=UserSettingsResponse)
async def update_preferences(
    payload: UserPreferencesUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.themePreference is not None:
        user.theme_pref = payload.themePreference
    if payload.notifyEmail is not None:
        user.notify_email = 1 if payload.notifyEmail else 0
    if payload.notifyInApp is not None:
        user.notify_inapp = 1 if payload.notifyInApp else 0
    if payload.reminderHours is not None:
        user.reminder_hours = payload.reminderHours
    db.commit()
    db.refresh(user)
    return _settings_response(user)


@router.put("/workspace", response_model=UserSettingsResponse)
async def update_workspace(
    payload: WorkspaceUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.workspaceName is not None:
        user.workspace_name = payload.workspaceName
    if payload.workspaceTimezone is not None:
        user.workspace_timezone = payload.workspaceTimezone
    db.commit()
    db.refresh(user)
    return _settings_response(user)


@router.get("/integrations")
async def get_integrations(current_user: CurrentUser):
    return {"integrations": INTEGRATIONS_PLACEHOLDER}


@router.put("/password", status_code=204)
async def change_password(
    payload: UserVerification,
    current_user: CurrentUser,
    db: DbSession,
):
    """Change password (settings context)."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect current password")
    user.password = hash_password(payload.new_password)
    db.add(user)
    db.commit()


@router.post("/avatar/upload", response_model=AvatarUploadResponse)
async def upload_avatar(
    current_user: CurrentUser,
    file: UploadFile = File(...),
):
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid image type")

    content = await file.read()
    max_size = 2 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="Image too large. Max size is 2MB")

    uploaded = upload_avatar_to_supabase(
        user_id=current_user.id,
        filename=file.filename or "avatar.jpg",
        content_type=file.content_type or "image/jpeg",
        data=content,
    )
    return AvatarUploadResponse(**uploaded)

