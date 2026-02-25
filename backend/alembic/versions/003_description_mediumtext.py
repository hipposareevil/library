"""Widen description column to MEDIUMTEXT

Revision ID: 003
Revises: 002
Create Date: 2026-02-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL — op.alter_column without existing_type generates incomplete
    # DDL for MySQL and FULLTEXT-indexed columns require explicit MODIFY COLUMN.
    op.execute("ALTER TABLE books MODIFY COLUMN description MEDIUMTEXT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE books MODIFY COLUMN description TEXT NULL")
