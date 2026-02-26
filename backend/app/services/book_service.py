from datetime import date

from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from app.models.book import Book, BookTag, Tag


def get_or_create_tag(db: Session, name: str) -> Tag:
    tag = db.query(Tag).filter(Tag.name == name).first()
    if not tag:
        tag = Tag(name=name)
        db.add(tag)
        db.flush()
    return tag


def set_book_tags(db: Session, book: Book, tag_names: list[str]) -> None:
    # Clear existing tags
    db.query(BookTag).filter(BookTag.book_id == book.id).delete()
    for name in tag_names:
        name = name.strip()
        if not name:
            continue
        tag = get_or_create_tag(db, name)
        db.add(BookTag(book_id=book.id, tag_id=tag.id))
    db.flush()


def search_books(
    db: Session,
    q: str | None = None,
    author: str | None = None,
    tags: list[str] | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    rating_min: int | None = None,
    has_epub: bool | None = None,
    sort: str = "title_sort",
    order: str = "asc",
    page: int = 1,
    per_page: int = 24,
) -> tuple[list[Book], int]:
    query = db.query(Book).options(joinedload(Book.tags))

    if q:
        query = query.filter(
            text("MATCH(title, author, description) AGAINST(:q IN BOOLEAN MODE)")
        ).params(q=q)

    if author:
        query = query.filter(Book.author == author)

    if tags:
        for tag_name in tags:
            query = query.filter(
                Book.tags.any(Tag.name == tag_name)
            )

    if year_from:
        query = query.filter(Book.publish_date >= date(year_from, 1, 1))
    if year_to:
        query = query.filter(Book.publish_date <= date(year_to, 12, 31))
    if rating_min is not None:
        query = query.filter(Book.rating >= rating_min)
    if has_epub is not None:
        query = query.filter(Book.has_epub == has_epub)

    # Count before pagination
    total = query.with_entities(func.count(Book.id)).scalar()

    # Sorting
    sort_column = getattr(Book, sort, Book.title_sort)
    if order == "desc":
        sort_column = sort_column.desc()
    query = query.order_by(sort_column)

    # Pagination
    books = query.offset((page - 1) * per_page).limit(per_page).all()

    # Deduplicate from joinedload
    seen = set()
    unique_books = []
    for book in books:
        if book.id not in seen:
            seen.add(book.id)
            unique_books.append(book)

    return unique_books, total
