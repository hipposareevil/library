import logging

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

logger = logging.getLogger("library.database")

logger.info("Creating engine with DATABASE_URL scheme=%s host=%s",
            settings.database_url.split("://")[0] if "://" in settings.database_url else "?",
            settings.database_url.split("@")[-1].split("/")[0] if "@" in settings.database_url else "?")

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)


@event.listens_for(engine, "connect")
def _on_connect(dbapi_conn, connection_record):
    logger.info("New DB connection established")


@event.listens_for(engine, "checkout")
def _on_checkout(dbapi_conn, connection_record, connection_proxy):
    logger.debug("DB connection checked out from pool")


@event.listens_for(engine, "invalidate")
def _on_invalidate(dbapi_conn, connection_record, exception):
    logger.warning("DB connection invalidated: %s", exception)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
