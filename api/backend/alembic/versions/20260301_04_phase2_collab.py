"""add task comments, activity events, and notifications

Revision ID: 20260301_04
Revises: 20260224_03
Create Date: 2026-03-01 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260301_04"
down_revision = "20260224_03"
branch_labels = None
depends_on = None


def _has_table(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _has_table(inspector, "task_comments"):
        op.create_table(
            "task_comments",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("task_id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_task_comments_id"), "task_comments", ["id"], unique=False)
        op.create_index(op.f("ix_task_comments_task_id"), "task_comments", ["task_id"], unique=False)
        op.create_index(op.f("ix_task_comments_user_id"), "task_comments", ["user_id"], unique=False)

    if not _has_table(inspector, "activity_events"):
        op.create_table(
            "activity_events",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("task_id", sa.String(), nullable=False),
            sa.Column("actor_user_id", sa.String(), nullable=True),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("detail", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_activity_events_id"), "activity_events", ["id"], unique=False)
        op.create_index(op.f("ix_activity_events_task_id"), "activity_events", ["task_id"], unique=False)
        op.create_index(op.f("ix_activity_events_actor_user_id"), "activity_events", ["actor_user_id"], unique=False)
        op.create_index(op.f("ix_activity_events_event_type"), "activity_events", ["event_type"], unique=False)
        op.create_index(op.f("ix_activity_events_created_at"), "activity_events", ["created_at"], unique=False)

    if not _has_table(inspector, "notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("entity_type", sa.String(), nullable=True),
            sa.Column("entity_id", sa.String(), nullable=True),
            sa.Column("is_read", sa.Integer(), nullable=True, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_notifications_id"), "notifications", ["id"], unique=False)
        op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
        op.create_index(op.f("ix_notifications_entity_type"), "notifications", ["entity_type"], unique=False)
        op.create_index(op.f("ix_notifications_entity_id"), "notifications", ["entity_id"], unique=False)
        op.create_index(op.f("ix_notifications_is_read"), "notifications", ["is_read"], unique=False)
        op.create_index(op.f("ix_notifications_created_at"), "notifications", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_created_at"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_is_read"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_entity_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_entity_type"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_id"), table_name="notifications")
    op.drop_table("notifications")

    op.drop_index(op.f("ix_activity_events_created_at"), table_name="activity_events")
    op.drop_index(op.f("ix_activity_events_event_type"), table_name="activity_events")
    op.drop_index(op.f("ix_activity_events_actor_user_id"), table_name="activity_events")
    op.drop_index(op.f("ix_activity_events_task_id"), table_name="activity_events")
    op.drop_index(op.f("ix_activity_events_id"), table_name="activity_events")
    op.drop_table("activity_events")

    op.drop_index(op.f("ix_task_comments_user_id"), table_name="task_comments")
    op.drop_index(op.f("ix_task_comments_task_id"), table_name="task_comments")
    op.drop_index(op.f("ix_task_comments_id"), table_name="task_comments")
    op.drop_table("task_comments")
