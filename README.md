# Library

A personal book library web application for browsing, searching, and managing a collection of books with cover art, metadata, and EPUB downloads.

## Features

- Browse books in Grid, List, Masonry, or Table views
- Full-text search by title, author, and description
- Filter by tags, year, and rating
- 5 color themes: Dark, Light, Nord, Space, Forest
- Book detail pages with OpenLibrary integration
- EPUB download support (authenticated users)
- Admin panel for adding, editing, and deleting books
- EPUB upload with automatic metadata extraction
- Cover images and EPUBs stored on Backblaze B2

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Python + FastAPI
- **Database**: MariaDB 11
- **Storage**: Backblaze B2
- **Deployment**: Docker Compose

## Setup

1. Copy the environment file and fill in your values:
   ```bash
   cp .env.example .env
   ```

2. Start the services:
   ```bash
   docker compose up -d
   ```

3. Access the app at `http://localhost`

## Importing Existing Data

If you have Calibre OPF/EPUB data, place them in `opf/` and `epub/` directories, then run the import worker:

```bash
docker compose --profile import up import-worker
```

This will:
- Parse OPF metadata files and insert books into the database
- Parse EPUB directory metadata and merge by calibre ID
- Resize and upload cover images to Backblaze B2
- Upload EPUB files to Backblaze B2

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DB_ROOT_PASSWORD` | MariaDB root password |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | Secret key for JWT tokens |
| `B2_KEY_ID` | Backblaze B2 key ID |
| `B2_APP_KEY` | Backblaze B2 application key |
| `B2_BUCKET_NAME` | Backblaze B2 bucket name |
| `B2_ENDPOINT` | Backblaze B2 endpoint URL |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |

## Development

Run backend and frontend separately for development:

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to the backend at port 8000.
