"""Parse metadata.opf files from the /epub directory tree and merge into the database.

The epub directory has structure: /epub/Author/Title (calibre_id)/metadata.opf
Also flags books that have actual .epub files alongside the metadata.
"""
import glob
import os
import re
import sys

from app.database import SessionLocal
from app.models.book import Book
from scripts.import_opf import parse_opf, upsert_book

# Pattern to extract calibre_id from directory name like "Title (1573)"
CALIBRE_ID_PATTERN = re.compile(r"\((\d+)\)$")


def main(epub_dir: str = "/data/epub"):
    if not os.path.isdir(epub_dir):
        print(f"EPUB directory not found: {epub_dir}")
        sys.exit(1)

    # Find all metadata.opf files recursively
    opf_files = sorted(glob.glob(os.path.join(epub_dir, "*", "*", "metadata.opf")))
    print(f"Found {len(opf_files)} metadata.opf files in {epub_dir}")

    db = SessionLocal()
    imported = 0
    epub_count = 0
    errors = 0

    try:
        for i, filepath in enumerate(opf_files):
            try:
                data = parse_opf(filepath)
                if not data or "title" not in data:
                    continue

                # If no calibre_id from XML, try extracting from directory name
                if "calibre_id" not in data:
                    parent_dir = os.path.basename(os.path.dirname(filepath))
                    match = CALIBRE_ID_PATTERN.search(parent_dir)
                    if match:
                        data["calibre_id"] = int(match.group(1))

                book = upsert_book(db, data)
                if book:
                    imported += 1

                    # Check for .epub file in same directory
                    book_dir = os.path.dirname(filepath)
                    epub_files = glob.glob(os.path.join(book_dir, "*.epub"))
                    if epub_files:
                        book.has_epub = True
                        epub_count += 1

                if (i + 1) % 100 == 0:
                    db.commit()
                    print(f"  Processed {i + 1}/{len(opf_files)}...")

            except Exception as e:
                errors += 1
                print(f"  Error parsing {filepath}: {e}")

        db.commit()
        print(f"Import complete: {imported} books merged, {epub_count} with EPUBs, {errors} errors")
    finally:
        db.close()


if __name__ == "__main__":
    epub_dir = sys.argv[1] if len(sys.argv) > 1 else "/data/epub"
    main(epub_dir)
