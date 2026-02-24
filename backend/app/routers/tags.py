from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.book import BookTag, Tag

router = APIRouter()


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    results = (
        db.query(Tag.id, Tag.name, func.count(BookTag.book_id).label("count"))
        .outerjoin(BookTag, Tag.id == BookTag.tag_id)
        .group_by(Tag.id, Tag.name)
        .order_by(Tag.name)
        .all()
    )
    return [{"id": r.id, "name": r.name, "count": r.count} for r in results]
