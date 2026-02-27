"""Add read status to books

Revision ID: 006
Revises: 005
Create Date: 2026-02-27
"""
from alembic import op
import sqlalchemy as sa

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'books',
        sa.Column('read', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index('idx_read', 'books', ['read'])


def downgrade():
    op.drop_index('idx_read', table_name='books')
    op.drop_column('books', 'read')
