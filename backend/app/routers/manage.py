"""System management endpoints: status checks and user CRUD."""
from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserChangePassword, UserCreate, UserOut

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.get("/status")
def get_system_status(
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Check database and B2 storage connectivity."""
    # Database check
    db_status = {"connected": False, "name": ""}
    try:
        db.execute(text("SELECT 1"))
        # Extract database name from URL
        db_name = settings.database_url.rsplit("/", 1)[-1]
        db_status = {"connected": True, "name": db_name}
    except Exception as e:
        db_status = {"connected": False, "error": str(e)}

    # B2 check
    b2_status = {"connected": False, "bucket_name": "", "endpoint": ""}
    if settings.b2_key_id and settings.b2_app_key:
        try:
            from app.services.b2_service import _get_bucket

            bucket = _get_bucket()
            b2_status = {
                "connected": True,
                "bucket_name": settings.b2_bucket_name,
                "endpoint": settings.b2_endpoint,
            }
        except Exception as e:
            b2_status = {
                "connected": False,
                "bucket_name": settings.b2_bucket_name,
                "endpoint": settings.b2_endpoint,
                "error": str(e),
            }
    else:
        b2_status["error"] = "B2 credentials not configured"

    return {"database": db_status, "b2": b2_status}


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return db.query(User).order_by(User.username).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )
    user = User(
        username=body.username,
        password_hash=pwd_context.hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/password")
def change_password(
    user_id: int,
    body: UserChangePassword,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = pwd_context.hash(body.password)
    db.commit()
    return {"detail": "Password updated"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == current_user.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}
