from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.book import Book
from app.schemas.book import BookCreate, BookDetail, BookUpdate
from app.services.book_service import set_book_tags
from app.services import b2_service, epub_service

router = APIRouter()


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

    # Clean up B2 files
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

    # Upload to B2
    b2_key = f"epubs/{book.id}.epub"
    b2_service.upload_bytes(file_bytes, b2_key, content_type="application/epub+zip")

    book.epub_key = b2_key
    book.has_epub = True
    db.commit()

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

    result = {**metadata, "has_cover": cover_bytes is not None}
    return result


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
