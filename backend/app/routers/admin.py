import base64
import io

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from PIL import Image
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.book import Book
from app.schemas.book import BookCreate, BookDetail, BookUpdate
from app.services.book_service import set_book_tags
from app.services import b2_service, epub_service
from app.services.openlibrary import fetch_metadata_for_book

router = APIRouter()


def _resize_cover(image_bytes: bytes, max_w: int = 400, max_h: int = 600) -> bytes:
    """Resize cover image and return as JPEG bytes."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((max_w, max_h), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@router.post("/books", response_model=BookDetail)
async def create_book(
    data: BookCreate,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    book = Book(
        title=data.title,
        title_sort=data.title_sort or data.title,
        author=data.author,
        author_sort=data.author_sort,
        publisher=data.publisher,
        publish_date=data.publish_date,
        isbn=data.isbn,
        google_id=data.google_id,
        amazon_id=data.amazon_id,
        language=data.language,
        description=data.description,
        notes=data.notes,
        rating=data.rating,
        series_name=data.series_name,
        series_index=data.series_index,
    )
    db.add(book)
    db.flush()

    if data.tags:
        set_book_tags(db, book, data.tags)

    db.commit()
    db.refresh(book)
    return book


@router.put("/books/{book_id}", response_model=BookDetail)
async def update_book(
    book_id: int,
    data: BookUpdate,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    update_data = data.model_dump(exclude_unset=True)
    tags = update_data.pop("tags", None)

    for key, value in update_data.items():
        setattr(book, key, value)

    if tags is not None:
        set_book_tags(db, book, tags)

    db.commit()
    db.refresh(book)
    return book


@router.delete("/books/{book_id}")
async def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if book.cover_key:
        try:
            b2_service.delete_file(book.cover_key)
        except Exception:
            pass
    if book.epub_key:
        try:
            b2_service.delete_file(book.epub_key)
        except Exception:
            pass

    db.delete(book)
    db.commit()
    return {"detail": "Book deleted"}


@router.post("/books/{book_id}/upload-epub")
async def upload_epub(
    book_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    file_bytes = await file.read()

    b2_key = f"epubs/{book.id}.epub"
    b2_service.upload_bytes(file_bytes, b2_key, content_type="application/epub+zip")

    book.epub_key = b2_key
    book.has_epub = True

    # Auto-extract metadata from the EPUB and fill in empty fields
    try:
        metadata, cover_bytes = epub_service.extract_metadata(file_bytes)
        fill_fields = ["title", "author", "publisher", "description", "language", "isbn", "publish_date"]
        for field in fill_fields:
            if metadata.get(field) and not getattr(book, field, None):
                setattr(book, field, metadata[field])

        if cover_bytes and not book.cover_key:
            cover_key = f"covers/{book.id}.jpg"
            b2_service.upload_bytes(_resize_cover(cover_bytes), cover_key, content_type="image/jpeg")
            book.cover_key = cover_key
    except Exception:
        pass

    db.commit()
    db.refresh(book)
    return {"detail": "EPUB uploaded", "epub_key": b2_key}


@router.post("/books/extract-epub")
async def extract_epub_metadata(
    file: UploadFile = File(...),
    _user: dict = Depends(get_current_user),
):
    file_bytes = await file.read()
    try:
        metadata, cover_bytes = epub_service.extract_metadata(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse EPUB: {e}")

    cover_b64 = None
    if cover_bytes:
        try:
            cover_b64 = base64.b64encode(_resize_cover(cover_bytes, 300, 450)).decode()
        except Exception:
            cover_b64 = base64.b64encode(cover_bytes).decode()

    return {**metadata, "cover_b64": cover_b64}


@router.post("/books/{book_id}/cover")
async def upload_cover(
    book_id: int,
    file: UploadFile = File(None),
    cover_url: str = Form(None),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    cover_bytes = None
    if file and file.filename:
        cover_bytes = await file.read()
    elif cover_url:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(cover_url)
                resp.raise_for_status()
                cover_bytes = resp.content
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch cover URL: {e}")

    if not cover_bytes:
        raise HTTPException(status_code=400, detail="No cover provided")

    try:
        cover_bytes = _resize_cover(cover_bytes)
    except Exception:
        pass

    if book.cover_key:
        try:
            b2_service.delete_file(book.cover_key)
        except Exception:
            pass

    cover_key = f"covers/{book.id}.jpg"
    b2_service.upload_bytes(cover_bytes, cover_key, content_type="image/jpeg")
    book.cover_key = cover_key
    db.commit()
    return {"detail": "Cover uploaded"}


@router.get("/books/{book_id}/fetch-metadata")
async def fetch_book_openlibrary_metadata(
    book_id: int,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Fetch structured metadata from OpenLibrary to populate the edit form."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    metadata = await fetch_metadata_for_book(book.isbn, book.title, book.author)
    if not metadata:
        raise HTTPException(status_code=404, detail="No metadata found on OpenLibrary")

    return metadata


@router.get("/books/{book_id}/download")
def download_epub(
    book_id: int,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book.epub_key:
        raise HTTPException(status_code=404, detail="No EPUB file available")

    url = b2_service.get_download_url(book.epub_key)
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url, status_code=302)
