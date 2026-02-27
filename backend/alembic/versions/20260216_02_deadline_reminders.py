"""add reminder settings and reminder logs

Revision ID: 20260216_02
Revises: 20260216_01
Create Date: 2026-02-16 00:30:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260216_02"
down_revision = "20260216_01"
branch_labels = None
depends_on = None


def _has_table(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    cols = inspector.get_columns(table_name)
    return any(c["name"] == column_name for c in cols)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _has_table(inspector, "users") and not _has_column(inspector, "users", "reminder_hours"):
        op.add_column("users", sa.Column("reminder_hours", sa.Integer(), nullable=True))
        op.execute(sa.text("UPDATE users SET reminder_hours = 24 WHERE reminder_hours IS NULL"))

    inspector = inspect(bind)
    if not _has_table(inspector, "deadline_reminder_logs"):
        op.create_table(
            "deadline_reminder_logs",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("item_key", sa.String(), nullable=False),
            sa.Column("reminder_date", sa.String(), nullable=False),
            sa.Column("due_date", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id",
                "item_key",
                "reminder_date",
                name="uq_deadline_reminder_logs_user_item_date",
            ),
        )
        op.create_index(op.f("ix_deadline_reminder_logs_id"), "deadline_reminder_logs", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_deadline_reminder_logs_id"), table_name="deadline_reminder_logs")
    op.drop_table("deadline_reminder_logs")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("reminder_hours")

