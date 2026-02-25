"""System management endpoints: status checks and user CRUD."""
import io
import json
import zipfile
from datetime import date as date_type

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.models.book import Book
from app.models.user import User
from app.schemas.user import UserChangePassword, UserCreate, UserOut
from app.services import b2_service
from app.services.book_service import set_book_tags

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _book_to_dict(book) -> dict:
    return {
        "id": book.id,
        "title": book.title,
        "title_sort": book.title_sort,
        "author": book.author,
        "author_sort": book.author_sort,
        "publisher": book.publisher,
        "publish_date": book.publish_date.isoformat() if book.publish_date else None,
        "isbn": book.isbn,
        "google_id": book.google_id,
        "amazon_id": book.amazon_id,
        "language": book.language,
        "description": book.description,
        "notes": book.notes,
        "rating": book.rating,
        "series_name": book.series_name,
        "series_index": book.series_index,
        "has_epub": book.has_epub,
        "cover_key": book.cover_key,
        "epub_key": book.epub_key,
        "tags": [tag.name for tag in book.tags],
    }


@router.get("/status")
def get_system_status(
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Check database and B2 storage connectivity."""
    book_count = 0
    epub_count = 0

    # Database check
    db_status: dict = {"connected": False, "name": "", "book_count": 0}
    try:
        db.execute(text("SELECT 1"))
        db_name = settings.database_url.rsplit("/", 1)[-1]
        book_count = db.query(Book).count()
        epub_count = db.query(Book).filter(Book.epub_key.isnot(None)).count()
        db_status = {"connected": True, "name": db_name, "book_count": book_count}
    except Exception as e:
        db_status = {"connected": False, "error": str(e), "book_count": 0}

    # B2 check
    b2_status: dict = {
        "connected": False,
        "bucket_name": "",
        "endpoint": "",
        "epub_count": epub_count,
    }
    if settings.b2_key_id and settings.b2_app_key:
        try:
            from app.services.b2_service import _get_bucket

            _get_bucket()
            b2_status = {
                "connected": True,
                "bucket_name": settings.b2_bucket_name,
                "endpoint": settings.b2_endpoint,
                "epub_count": epub_count,
            }
        except Exception as e:
            b2_status = {
                "connected": False,
                "bucket_name": settings.b2_bucket_name,
                "endpoint": settings.b2_endpoint,
                "error": str(e),
                "epub_count": epub_count,
            }
    else:
        b2_status["error"] = "B2 credentials not configured"

    return {"database": db_status, "b2": b2_status}


@router.get("/export")
def export_data(
    include_covers: bool = False,
    include_epubs: bool = False,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Export all books as a ZIP archive with optional covers and EPUBs."""
    books = db.query(Book).all()
    books_data = [_book_to_dict(b) for b in books]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("books.json", json.dumps(books_data, indent=2))

        if include_covers:
            for book in books:
                if book.cover_key:
                    try:
                        data = b2_service.download_bytes(book.cover_key)
                        zf.writestr(f"covers/{book.id}.jpg", data)
                    except Exception:
                        pass

        if include_epubs:
            for book in books:
                if book.epub_key:
                    try:
                        data = b2_service.download_bytes(book.epub_key)
                        zf.writestr(f"epubs/{book.id}.epub", data)
                    except Exception:
                        pass

    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=library-export.zip"},
    )


@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Import books from a ZIP archive produced by /export."""
    file_bytes = await file.read()
    raw = io.BytesIO(file_bytes)

    if not zipfile.is_zipfile(raw):
        raise HTTPException(status_code=400, detail="File must be a ZIP archive")

    covers: dict[int, bytes] = {}
    epubs: dict[int, bytes] = {}
    books_data: list[dict] = []

    raw.seek(0)
    with zipfile.ZipFile(raw) as zf:
        if "books.json" not in zf.namelist():
            raise HTTPException(status_code=400, detail="ZIP must contain books.json")
        books_data = json.loads(zf.read("books.json"))

        for name in zf.namelist():
            if name.startswith("covers/") and name.endswith(".jpg"):
                try:
                    oid = int(name[len("covers/") : -len(".jpg")])
                    covers[oid] = zf.read(name)
                except ValueError:
                    pass
            elif name.startswith("epubs/") and name.endswith(".epub"):
                try:
                    oid = int(name[len("epubs/") : -len(".epub")])
                    epubs[oid] = zf.read(name)
                except ValueError:
                    pass

    imported = 0
    for book_data in books_data:
        original_id = book_data.get("id")
        tags = book_data.get("tags", [])

        publish_date = None
        if book_data.get("publish_date"):
            try:
                publish_date = date_type.fromisoformat(book_data["publish_date"])
            except (ValueError, TypeError):
                pass

        book = Book(
            title=book_data.get("title", ""),
            title_sort=book_data.get("title_sort"),
            author=book_data.get("author"),
            author_sort=book_data.get("author_sort"),
            publisher=book_data.get("publisher"),
            publish_date=publish_date,
            isbn=book_data.get("isbn"),
            google_id=book_data.get("google_id"),
            amazon_id=book_data.get("amazon_id"),
            language=book_data.get("language", "eng"),
            description=book_data.get("description"),
            notes=book_data.get("notes"),
            rating=book_data.get("rating") or 0,
            series_name=book_data.get("series_name"),
            series_index=book_data.get("series_index"),
            has_epub=False,
        )
        db.add(book)
        db.flush()

        if tags:
            set_book_tags(db, book, tags)

        if original_id in covers:
            cover_key = f"covers/{book.id}.jpg"
            try:
                b2_service.upload_bytes(
                    covers[original_id], cover_key, content_type="image/jpeg"
                )
                book.cover_key = cover_key
            except Exception:
                pass

        if original_id in epubs:
            epub_key = f"epubs/{book.id}.epub"
            try:
                b2_service.upload_bytes(
                    epubs[original_id],
                    epub_key,
                    content_type="application/epub+zip",
                )
                book.epub_key = epub_key
                book.has_epub = True
            except Exception:
                pass

        imported += 1

    db.commit()
    return {"imported": imported, "total": len(books_data)}


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
