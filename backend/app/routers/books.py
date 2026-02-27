import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.book import Book
from app.schemas.book import BookDetail, BookListItem, PaginatedBooks
from app.services.book_service import search_books
from app.services.openlibrary import get_book_overview

router = APIRouter()


@router.get("", response_model=PaginatedBooks)
def list_books(
    q: str | None = None,
    author: str | None = None,
    tags: str | None = Query(None, description="Comma-separated tag names"),
    year_from: int | None = None,
    year_to: int | None = None,
    rating_min: int | None = None,
    has_epub: bool | None = None,
    read: bool | None = None,
    sort: str = "title_sort",
    order: str = "asc",
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    books, total = search_books(
        db, q=q, author=author, tags=tag_list, year_from=year_from, year_to=year_to,
        rating_min=rating_min, has_epub=has_epub, read=read,
        sort=sort, order=order, page=page, per_page=per_page,
    )
    return PaginatedBooks(
        items=books,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if per_page else 0,
    )


@router.get("/{book_id}", response_model=BookDetail)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).options(joinedload(Book.tags)).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.get("/{book_id}/overview")
async def get_book_overview_endpoint(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book.isbn:
        return {"detail": "No ISBN available for OpenLibrary lookup"}
    overview = await get_book_overview(book.isbn)
    if not overview:
        return {"detail": "Not found on OpenLibrary"}
    return overview
