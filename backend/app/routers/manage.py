"""System management endpoints: status checks and user CRUD."""
import asyncio
import gzip
import io
import json
import os
import uuid
import zipfile
from datetime import date as date_type, datetime, timezone
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import extract, or_, text
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import SessionLocal, get_db
from app.models.book import Book
from app.models.user import User
from app.schemas.user import UserChangePassword, UserCreate, UserOut
from app.services import b2_service
from app.services.book_service import set_book_tags
from app.services.google_books import fetch_series_info
from app.services.openlibrary import fetch_metadata_for_book

router = APIRouter()

# ── In-memory job store for long-running background tasks ──────────────────
_jobs: dict[str, dict] = {}


def _new_job(kind: str) -> str:
    job_id = f"{kind}-{uuid.uuid4().hex[:8]}"
    _jobs[job_id] = {"status": "running", "checked": 0, "updated": 0, "skipped": 0, "errors": 0}
    return job_id
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


async def _bg_fix_dates(job_id: str) -> None:
    """Background task: fill missing/invalid publish dates from OpenLibrary."""
    job = _jobs[job_id]
    db = SessionLocal()
    try:
        bad_books = (
            db.query(Book)
            .filter(or_(Book.publish_date.is_(None), extract("year", Book.publish_date) < 1000))
            .all()
        )
        job["checked"] = len(bad_books)
        for book in bad_books:
            try:
                meta = await fetch_metadata_for_book(book.isbn, book.title, book.author)
                if meta and meta.get("publish_date"):
                    raw = meta["publish_date"]
                    parts = raw.split("-")
                    year = int(parts[0])
                    if 1000 <= year <= date_type.today().year + 1:
                        month = int(parts[1]) if len(parts) > 1 else 1
                        day = int(parts[2]) if len(parts) > 2 else 1
                        book.publish_date = date_type(year, max(1, min(12, month)), max(1, min(28, day)))
                        job["updated"] += 1
                    else:
                        job["skipped"] += 1
                else:
                    job["skipped"] += 1
            except Exception:
                job["errors"] += 1
            await asyncio.sleep(0.3)
        db.commit()
        job["status"] = "done"
    except Exception as e:
        db.rollback()
        job["status"] = "error"
        job["error_msg"] = str(e)
    finally:
        db.close()


async def _bg_fix_series(job_id: str) -> None:
    """Background task: fill missing series info from Google Books."""
    job = _jobs[job_id]
    db = SessionLocal()
    try:
        books = db.query(Book).filter(Book.series_name.is_(None)).all()
        job["checked"] = len(books)
        for book in books:
            try:
                info = await fetch_series_info(book.isbn, book.title, book.author)
                if info and (info.get("series_name") or info.get("series_index") is not None):
                    if info.get("series_name"):
                        book.series_name = info["series_name"]
                    if info.get("series_index") is not None and book.series_index is None:
                        book.series_index = info["series_index"]
                    job["updated"] += 1
                else:
                    job["skipped"] += 1
            except Exception:
                job["errors"] += 1
            await asyncio.sleep(0.3)
        db.commit()
        job["status"] = "done"
    except Exception as e:
        db.rollback()
        job["status"] = "error"
        job["error_msg"] = str(e)
    finally:
        db.close()


@router.post("/fix-publish-dates")
async def fix_publish_dates(
    background_tasks: BackgroundTasks,
    _user: dict = Depends(get_current_user),
):
    """Start a background job to fill missing/invalid publish dates from OpenLibrary."""
    job_id = _new_job("dates")
    background_tasks.add_task(_bg_fix_dates, job_id)
    return {"job_id": job_id}


@router.post("/fix-series")
async def fix_series(
    background_tasks: BackgroundTasks,
    _user: dict = Depends(get_current_user),
):
    """Start a background job to fill missing series info from Google Books."""
    job_id = _new_job("series")
    background_tasks.add_task(_bg_fix_series, job_id)
    return {"job_id": job_id}


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str, _user: dict = Depends(get_current_user)):
    """Poll the status of a background fix job."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


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


class RestoreRequest(BaseModel):
    b2_key: str


@router.post("/backup")
async def backup_to_b2(
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Dump the database (including cover BLOBs) and upload as a gzipped SQL to B2."""
    # Parse connection details from DATABASE_URL
    # Format: mysql+pymysql://user:pass@host:port/dbname
    raw = settings.database_url
    parsed = urlparse("mysql://" + raw.split("://", 1)[1])
    host = parsed.hostname or "localhost"
    port = str(parsed.port or 3306)
    user = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    db_name = parsed.path.lstrip("/")

    env = {**os.environ, "MYSQL_PWD": password}
    proc = await asyncio.create_subprocess_exec(
        "mysqldump",
        "-h", host,
        f"-P{port}",
        f"-u{user}",
        "--single-transaction",
        "--routines",
        "--triggers",
        db_name,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"mysqldump failed: {stderr.decode()[:500]}",
        )

    compressed = gzip.compress(stdout, compresslevel=6)

    book_count = db.query(Book).count()
    ts = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    b2_key = f"backups/books-{ts}.sql.gz"
    uploaded_at = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    b2_service.upload_bytes(
        compressed,
        b2_key,
        content_type="application/gzip",
        file_infos={"book_count": str(book_count)},
    )

    return {
        "b2_key": b2_key,
        "filename": f"books-{ts}.sql.gz",
        "size_bytes": len(compressed),
        "uploaded_at": uploaded_at,
        "book_count": book_count,
    }


@router.get("/backups")
def list_backups(
    _user: dict = Depends(get_current_user),
):
    """List database backups stored in B2 under the backups/ prefix."""
    try:
        return b2_service.list_files("backups/")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DeleteBackupRequest(BaseModel):
    b2_key: str


@router.delete("/backup")
def delete_backup(
    body: DeleteBackupRequest,
    _user: dict = Depends(get_current_user),
):
    """Delete a backup file from B2."""
    try:
        b2_service.delete_file(body.b2_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"detail": "Backup deleted"}


@router.post("/restore")
async def restore_from_b2(
    body: RestoreRequest,
    _user: dict = Depends(get_current_user),
):
    """Download a backup from B2 and restore it to the database."""
    # Parse DB connection details
    raw = settings.database_url
    parsed = urlparse("mysql://" + raw.split("://", 1)[1])
    host = parsed.hostname or "localhost"
    port = str(parsed.port or 3306)
    user = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    db_name = parsed.path.lstrip("/")

    # Download and decompress
    try:
        compressed = b2_service.download_bytes(body.b2_key)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Backup not found: {e}")

    sql = gzip.decompress(compressed)

    env = {**os.environ, "MYSQL_PWD": password}
    proc = await asyncio.create_subprocess_exec(
        "mysql",
        "-h", host,
        f"-P{port}",
        f"-u{user}",
        db_name,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    _, stderr = await proc.communicate(input=sql)

    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"mysql restore failed: {stderr.decode()[:500]}",
        )

    return {"detail": "Restore complete"}
