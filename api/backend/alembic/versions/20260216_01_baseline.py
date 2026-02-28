"""baseline schema with compatibility updates

Revision ID: 20260216_01
Revises:
Create Date: 2026-02-16 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "20260216_01"
down_revision = None
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

    if not _has_table(inspector, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("password", sa.String(), nullable=False),
            sa.Column("role", sa.String(), nullable=True),
            sa.Column("avatar", sa.String(), nullable=True),
            sa.Column("theme_pref", sa.String(), nullable=True, server_default="dark"),
            sa.Column("notify_email", sa.Integer(), nullable=True, server_default="1"),
            sa.Column("notify_inapp", sa.Integer(), nullable=True, server_default="1"),
            sa.Column("workspace_name", sa.String(), nullable=True),
            sa.Column("workspace_timezone", sa.String(), nullable=True),
            sa.Column("integrations", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email"),
        )
        op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
        op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    else:
        missing_user_cols = [
            ("theme_pref", sa.String(), "'dark'"),
            ("notify_email", sa.Integer(), "1"),
            ("notify_inapp", sa.Integer(), "1"),
            ("workspace_name", sa.String(), None),
            ("workspace_timezone", sa.String(), None),
            ("integrations", sa.Text(), None),
        ]
        for col_name, col_type, default_sql in missing_user_cols:
            if not _has_column(inspector, "users", col_name):
                col = sa.Column(col_name, col_type, nullable=True)
                op.add_column("users", col)
                if default_sql is not None:
                    op.execute(
                        sa.text(
                            f"UPDATE users SET {col_name} = {default_sql} WHERE {col_name} IS NULL"
                        )
                    )

    inspector = inspect(bind)
    if not _has_table(inspector, "projects"):
        op.create_table(
            "projects",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("deadline", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("owner_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_projects_id"), "projects", ["id"], unique=False)
    elif not _has_column(inspector, "projects", "deadline"):
        op.add_column("projects", sa.Column("deadline", sa.String(), nullable=True))

    inspector = inspect(bind)
    if not _has_table(inspector, "sprints"):
        op.create_table(
            "sprints",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("goal", sa.Text(), nullable=True),
            sa.Column("start_date", sa.String(), nullable=False),
            sa.Column("end_date", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("project_id", sa.String(), nullable=True),
            sa.Column("owner_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_sprints_id"), "sprints", ["id"], unique=False)

    inspector = inspect(bind)
    if not _has_table(inspector, "tasks"):
        op.create_table(
            "tasks",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("priority", sa.String(), nullable=True),
            sa.Column("due_date", sa.String(), nullable=True),
            sa.Column("assigned_to", sa.String(), nullable=True),
            sa.Column("progress", sa.Integer(), nullable=True),
            sa.Column("icon", sa.String(), nullable=True),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("project_id", sa.String(), nullable=True),
            sa.Column("sprint_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["sprint_id"], ["sprints.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_tasks_id"), "tasks", ["id"], unique=False)
    elif not _has_column(inspector, "tasks", "sprint_id"):
        op.add_column("tasks", sa.Column("sprint_id", sa.String(), nullable=True))

    inspector = inspect(bind)
    if not _has_table(inspector, "deadlines"):
        op.create_table(
            "deadlines",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("date", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("project_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_deadlines_id"), "deadlines", ["id"], unique=False)

    inspector = inspect(bind)
    if not _has_table(inspector, "project_members"):
        op.create_table(
            "project_members",
            sa.Column("project_id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("added_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("project_id", "user_id"),
        )


def downgrade() -> None:
    # Baseline migration should be considered irreversible in existing environments.
    pass
