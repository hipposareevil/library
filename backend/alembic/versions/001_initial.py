"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-02-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("calibre_id", sa.Integer(), nullable=True),
        sa.Column("uuid", sa.String(36), nullable=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("title_sort", sa.String(512), nullable=True),
        sa.Column("author", sa.String(512), nullable=True),
        sa.Column("author_sort", sa.String(512), nullable=True),
        sa.Column("publisher", sa.String(255), nullable=True),
        sa.Column("publish_date", sa.Date(), nullable=True),
        sa.Column("isbn", sa.String(20), nullable=True),
        sa.Column("google_id", sa.String(50), nullable=True),
        sa.Column("amazon_id", sa.String(50), nullable=True),
        sa.Column("language", sa.String(10), server_default="eng"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_key", sa.String(255), nullable=True),
        sa.Column("epub_key", sa.String(255), nullable=True),
        sa.Column("has_epub", sa.Boolean(), server_default=sa.text("0")),
        sa.Column("rating", sa.Integer(), server_default=sa.text("0")),
        sa.Column("series_name", sa.String(255), nullable=True),
        sa.Column("series_index", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("calibre_id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )

    # Regular indexes
    op.create_index("idx_isbn", "books", ["isbn"])
    op.create_index("idx_title_sort", "books", ["title_sort"])
    op.create_index("idx_author_sort", "books", ["author_sort"])
    op.create_index("idx_publish_date", "books", ["publish_date"])
    op.create_index("idx_rating", "books", ["rating"])
    op.create_index("idx_has_epub", "books", ["has_epub"])

    # Fulltext indexes (MariaDB specific)
    op.execute("ALTER TABLE books ADD FULLTEXT INDEX ft_title (title)")
    op.execute("ALTER TABLE books ADD FULLTEXT INDEX ft_author (author)")
    op.execute("ALTER TABLE books ADD FULLTEXT INDEX ft_description (description)")
    op.execute(
        "ALTER TABLE books ADD FULLTEXT INDEX ft_all (title, author, description)"
    )

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )
    op.create_index("idx_tag_name", "tags", ["name"])

    op.create_table(
        "book_tags",
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("book_id", "tag_id"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )


def downgrade() -> None:
    op.drop_table("book_tags")
    op.drop_table("tags")
    op.drop_table("books")
    op.drop_table("users")
