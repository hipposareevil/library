from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.book import Book
from app.services.openlibrary import get_cover_url

router = APIRouter()


@router.get("/{book_id}")
def get_cover(book_id: int, thumb: bool = False, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    data = book.cover_thumb if (thumb and book.cover_thumb) else book.cover_data
    if data:
        return Response(
            content=bytes(data),
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    # Fallback: redirect to OpenLibrary cover (public CDN)
    if book.isbn:
        return RedirectResponse(url=get_cover_url(book.isbn, "L"), status_code=302)

    raise HTTPException(status_code=404, detail="No cover available")
