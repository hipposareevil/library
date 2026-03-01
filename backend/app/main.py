import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, books, tags, admin, covers, manage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)

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


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
