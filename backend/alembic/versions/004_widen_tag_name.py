"""Widen tags.name column to 500 chars

Revision ID: 004
Revises: 003
Create Date: 2026-02-26

"""
from typing import Sequence, Union

from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE tags MODIFY COLUMN name VARCHAR(500) NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE tags MODIFY COLUMN name VARCHAR(100) NOT NULL")
