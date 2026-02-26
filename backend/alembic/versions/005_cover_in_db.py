"""Store cover images in database instead of B2."""
from alembic import op

revision: str = "005"
down_revision: str | None = "004"


def upgrade() -> None:
    op.execute("ALTER TABLE books ADD COLUMN cover_data MEDIUMBLOB NULL AFTER cover_key")
    op.execute("ALTER TABLE books ADD COLUMN cover_thumb MEDIUMBLOB NULL AFTER cover_data")


def downgrade() -> None:
    op.execute("ALTER TABLE books DROP COLUMN cover_thumb")
    op.execute("ALTER TABLE books DROP COLUMN cover_data")
