"""Notifications router - in-app notification center."""
from fastapi import APIRouter, Query, HTTPException

from models import Notification
from schemas import NotificationResponse
from dependencies import DbSession, CurrentUser

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _to_response(n: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=n.id,
        title=n.title,
        message=n.message,
        entityType=n.entity_type,
        entityId=n.entity_id,
        isRead=bool(n.is_read),
        createdAt=n.created_at.isoformat() if n.created_at else "",
    )


@router.get("", response_model=list[NotificationResponse])
async def get_notifications(
    current_user: CurrentUser,
    db: DbSession,
    unreadOnly: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unreadOnly:
        query = query.filter(Notification.is_read == 0)
    items = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return [_to_response(item) for item in items]


@router.get("/unread-count")
async def get_unread_count(
    current_user: CurrentUser,
    db: DbSession,
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == 0)
        .count()
    )
    return {"unreadCount": count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = 1
    db.commit()
    db.refresh(notification)
    return _to_response(notification)


@router.patch("/read-all")
async def mark_all_notifications_read(
    current_user: CurrentUser,
    db: DbSession,
):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == 0)
        .update({"is_read": 1}, synchronize_session=False)
    )
    db.commit()
    return {"updated": updated}
