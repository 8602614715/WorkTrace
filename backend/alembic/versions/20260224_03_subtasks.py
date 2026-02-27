"""add subtasks table

Revision ID: 20260224_03
Revises: 20260216_02
Create Date: 2026-02-24 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260224_03"
down_revision = "20260216_02"
branch_labels = None
depends_on = None


def _has_table(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _has_table(inspector, "subtasks"):
        op.create_table(
            "subtasks",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("completed", sa.Integer(), nullable=True, server_default="0"),
            sa.Column("sort_order", sa.Integer(), nullable=True, server_default="0"),
            sa.Column("task_id", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_subtasks_id"), "subtasks", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_subtasks_id"), table_name="subtasks")
    op.drop_table("subtasks")
