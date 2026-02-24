from datetime import date, datetime

from pydantic import BaseModel


class TagOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class BookListItem(BaseModel):
    id: int
    title: str
    title_sort: str | None = None
    author: str | None = None
    publisher: str | None = None
    publish_date: date | None = None
    isbn: str | None = None
    language: str | None = None
    cover_key: str | None = None
    has_epub: bool = False
    rating: int = 0
    series_name: str | None = None
    series_index: float | None = None
    tags: list[TagOut] = []

    model_config = {"from_attributes": True}


class BookDetail(BookListItem):
    calibre_id: int | None = None
    uuid: str | None = None
    author_sort: str | None = None
    google_id: str | None = None
    amazon_id: str | None = None
    description: str | None = None
    epub_key: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class BookCreate(BaseModel):
    title: str
    title_sort: str | None = None
    author: str | None = None
    author_sort: str | None = None
    publisher: str | None = None
    publish_date: date | None = None
    isbn: str | None = None
    google_id: str | None = None
    amazon_id: str | None = None
    language: str | None = "eng"
    description: str | None = None
    rating: int = 0
    series_name: str | None = None
    series_index: float | None = None
    tags: list[str] = []


class BookUpdate(BaseModel):
    title: str | None = None
    title_sort: str | None = None
    author: str | None = None
    author_sort: str | None = None
    publisher: str | None = None
    publish_date: date | None = None
    isbn: str | None = None
    google_id: str | None = None
    amazon_id: str | None = None
    language: str | None = None
    description: str | None = None
    rating: int | None = None
    series_name: str | None = None
    series_index: float | None = None
    tags: list[str] | None = None


class PaginatedBooks(BaseModel):
    items: list[BookListItem]
    total: int
    page: int
    per_page: int
    pages: int
