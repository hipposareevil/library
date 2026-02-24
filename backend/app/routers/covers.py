from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.book import Book
from app.services.b2_service import get_download_url
from app.services.openlibrary import get_cover_url

router = APIRouter()


@router.get("/{book_id}")
def get_cover(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Try B2 cover first
    if book.cover_key:
        try:
            url = get_download_url(book.cover_key)
            return RedirectResponse(url=url, status_code=302)
        except Exception:
            pass

    # Fallback to OpenLibrary cover
    if book.isbn:
        return RedirectResponse(url=get_cover_url(book.isbn, "L"), status_code=302)

    raise HTTPException(status_code=404, detail="No cover available")
