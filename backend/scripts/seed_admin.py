"""Create the admin user from environment variables if not exists."""
import sys

from passlib.context import CryptContext

from app.config import settings
from app.database import SessionLocal
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == settings.admin_username).first()
        if existing:
            print(f"Admin user '{settings.admin_username}' already exists, skipping.")
            return

        user = User(
            username=settings.admin_username,
            password_hash=pwd_context.hash(settings.admin_password),
        )
        db.add(user)
        db.commit()
        print(f"Admin user '{settings.admin_username}' created.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
