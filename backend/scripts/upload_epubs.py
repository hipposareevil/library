"""Upload EPUB files to Backblaze B2."""
import glob
import os
import sys

from app.database import SessionLocal
from app.models.book import Book
from app.services.b2_service import upload_file


def main(epub_dir: str = "/data/epub"):
    if not os.path.isdir(epub_dir):
        print(f"EPUB directory not found: {epub_dir}")
        sys.exit(1)

    db = SessionLocal()
    try:
        books = db.query(Book).filter(Book.has_epub == True, Book.epub_key.is_(None)).all()
        print(f"Found {len(books)} books with EPUBs to upload")

        uploaded = 0
        for book in books:
            if not book.calibre_id:
                continue

            # Find the epub file
            epub_files = glob.glob(
                os.path.join(epub_dir, "*", f"*({book.calibre_id})", "*.epub")
            )
            if not epub_files:
                continue

            epub_path = epub_files[0]
            try:
                b2_key = f"epubs/{book.calibre_id}.epub"
                upload_file(epub_path, b2_key, content_type="application/epub+zip")
                book.epub_key = b2_key
                uploaded += 1

                if uploaded % 20 == 0:
                    db.commit()
                    print(f"  Uploaded {uploaded} EPUBs...")
            except Exception as e:
                print(f"  Error uploading EPUB for book {book.calibre_id}: {e}")

        db.commit()
        print(f"EPUB upload complete: {uploaded} files uploaded")
    finally:
        db.close()


if __name__ == "__main__":
    epub_dir = sys.argv[1] if len(sys.argv) > 1 else "/data/epub"
    main(epub_dir)
