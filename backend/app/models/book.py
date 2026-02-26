from datetime import date, datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.mysql import MEDIUMBLOB, MEDIUMTEXT
from sqlalchemy.orm import relationship

from app.database import Base


class BookTag(Base):
    __tablename__ = "book_tags"

    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(500), nullable=False, unique=True, index=True)

    books = relationship("Book", secondary="book_tags", back_populates="tags")


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, autoincrement=True)
    calibre_id = Column(Integer, unique=True, nullable=True)
    uuid = Column(String(36), nullable=True)

    title = Column(String(512), nullable=False)
    title_sort = Column(String(512), nullable=True)
    author = Column(String(512), nullable=True)
    author_sort = Column(String(512), nullable=True)

    publisher = Column(String(255), nullable=True)
    publish_date = Column(Date, nullable=True)
    isbn = Column(String(20), nullable=True, index=True)
    google_id = Column(String(50), nullable=True)
    amazon_id = Column(String(50), nullable=True)
    language = Column(String(10), default="eng")
    description = Column(MEDIUMTEXT, nullable=True)
    notes = Column(Text, nullable=True)

    cover_key = Column(String(255), nullable=True)   # legacy B2 key, no longer used
    cover_data = Column(MEDIUMBLOB, nullable=True)    # full-size JPEG stored in DB
    cover_thumb = Column(MEDIUMBLOB, nullable=True)   # thumbnail JPEG stored in DB
    epub_key = Column(String(255), nullable=True)
    has_epub = Column(Boolean, default=False)

    rating = Column(Integer, default=0)  # 0-10 (Calibre scale)
    series_name = Column(String(255), nullable=True)
    series_index = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tags = relationship("Tag", secondary="book_tags", back_populates="books")

    __table_args__ = (
        Index("ft_title", "title", mysql_prefix="FULLTEXT"),
        Index("ft_author", "author", mysql_prefix="FULLTEXT"),
        Index("ft_description", "description", mysql_prefix="FULLTEXT"),
        Index("ft_all", "title", "author", "description", mysql_prefix="FULLTEXT"),
        Index("idx_title_sort", "title_sort"),
        Index("idx_author_sort", "author_sort"),
        Index("idx_publish_date", "publish_date"),
        Index("idx_rating", "rating"),
        Index("idx_has_epub", "has_epub"),
    )
