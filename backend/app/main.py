import logging
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, books, tags, admin, covers, manage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("library.startup")

app = FastAPI(title="Library API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(books.router, prefix="/api/books", tags=["books"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
app.include_router(covers.router, prefix="/api/covers", tags=["covers"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(manage.router, prefix="/api/admin", tags=["manage"])


@app.on_event("startup")
def startup_diagnostics():
    parsed = urlparse(settings.database_url)
    logger.info("=== STARTUP DIAGNOSTICS ===")
    logger.info("DATABASE_URL host=%s port=%s db=%s user=%s",
                parsed.hostname, parsed.port, parsed.path.lstrip("/"), parsed.username)

    # Test DB connection
    try:
        from app.database import engine
        with engine.connect() as conn:
            result = conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            result.fetchone()
        logger.info("DB connection: OK")
    except Exception as e:
        logger.error("DB connection: FAILED — %s: %s", type(e).__name__, e)

    # Test B2 connection
    logger.info("B2_KEY_ID=%s... B2_BUCKET=%s B2_ENDPOINT=%s",
                settings.b2_key_id[:4] + "****" if settings.b2_key_id else "(empty)",
                settings.b2_bucket_name or "(empty)",
                settings.b2_endpoint or "(empty)")
    try:
        from app.services.b2_service import _get_bucket
        bucket = _get_bucket()
        logger.info("B2 connection: OK — bucket=%s", bucket.name)
    except Exception as e:
        logger.error("B2 connection: FAILED — %s: %s", type(e).__name__, e)

    logger.info("=== END DIAGNOSTICS ===")


@app.get("/api/health")
def health_check():
    checks = {"status": "ok", "db": "unknown", "b2": "unknown"}

    try:
        from app.database import engine
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1")).fetchone()
        checks["db"] = "ok"
    except Exception as e:
        checks["status"] = "degraded"
        checks["db"] = f"error: {type(e).__name__}: {e}"

    try:
        from app.services.b2_service import _get_bucket
        _get_bucket()
        checks["b2"] = "ok"
    except Exception as e:
        checks["status"] = "degraded"
        checks["b2"] = f"error: {type(e).__name__}: {e}"

    return checks
