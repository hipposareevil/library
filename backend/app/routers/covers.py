from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.book import Book
from app.services.b2_service import download_bytes
from app.services.openlibrary import get_cover_url

router = APIRouter()


@router.get("/{book_id}")
def get_cover(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Proxy B2 cover bytes directly (bucket is private, redirect won't work)
    if book.cover_key:
        try:
            data = download_bytes(book.cover_key)
            return Response(content=data, media_type="image/jpeg")
        except Exception:
            pass

    # Fallback to OpenLibrary cover (public URL, redirect is fine)
    if book.isbn:
        return RedirectResponse(url=get_cover_url(book.isbn, "L"), status_code=302)

    raise HTTPException(status_code=404, detail="No cover available")
