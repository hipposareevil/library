"""Upload cover images to Backblaze B2.

Priority: epub/ cover.jpg (higher res) > opf/ matching .jpg
Resizes to max 600px wide for web delivery.
"""
import glob
import io
import os
import sys

from PIL import Image

from app.database import SessionLocal
from app.models.book import Book
from app.services.b2_service import upload_bytes


def resize_cover(image_path: str, max_width: int = 600) -> bytes:
    """Resize an image to max_width while maintaining aspect ratio. Returns JPEG bytes."""
    with Image.open(image_path) as img:
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        if img.width > max_width:
            ratio = max_width / img.width
            new_size = (max_width, int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        return buf.getvalue()


def find_cover(calibre_id: int, opf_dir: str, epub_dir: str) -> str | None:
    """Find the best cover image for a book. Prefers epub/ (higher res)."""
    # Try epub/ directory first (higher resolution covers)
    epub_covers = glob.glob(os.path.join(epub_dir, "*", f"*({calibre_id})", "cover.jpg"))
    if epub_covers:
        return epub_covers[0]

    # Try opf/ directory - need to match by filename pattern
    # OPF covers share the base name with the .opf file
    opf_files = glob.glob(os.path.join(opf_dir, "*.opf"))
    for opf_file in opf_files:
        base = os.path.splitext(opf_file)[0]
        jpg_path = base + ".jpg"
        if os.path.exists(jpg_path):
            # Quick check: parse the OPF to see if calibre_id matches
            try:
                from scripts.import_opf import parse_opf
                data = parse_opf(opf_file)
                if data.get("calibre_id") == calibre_id:
                    return jpg_path
            except Exception:
                continue

    return None


def main(opf_dir: str = "/data/opf", epub_dir: str = "/data/epub"):
    db = SessionLocal()
    try:
        # Build a lookup of calibre_id -> opf cover path for efficiency
        print("Building OPF cover index...")
        opf_cover_index = {}
        from scripts.import_opf import parse_opf
        for opf_file in glob.glob(os.path.join(opf_dir, "*.opf")):
            try:
                data = parse_opf(opf_file)
                cid = data.get("calibre_id")
                if cid:
                    base = os.path.splitext(opf_file)[0]
                    jpg = base + ".jpg"
                    if os.path.exists(jpg):
                        opf_cover_index[cid] = jpg
            except Exception:
                continue
        print(f"  Found {len(opf_cover_index)} OPF covers")

        books = db.query(Book).filter(Book.cover_key.is_(None)).all()
        print(f"Uploading covers for {len(books)} books...")

        uploaded = 0
        for i, book in enumerate(books):
            if not book.calibre_id:
                continue

            cover_path = None

            # Prefer epub/ cover (higher res)
            epub_covers = glob.glob(
                os.path.join(epub_dir, "*", f"*({book.calibre_id})", "cover.jpg")
            )
            if epub_covers:
                cover_path = epub_covers[0]
            elif book.calibre_id in opf_cover_index:
                cover_path = opf_cover_index[book.calibre_id]

            if not cover_path:
                continue

            try:
                image_bytes = resize_cover(cover_path)
                b2_key = f"covers/{book.calibre_id}.jpg"
                upload_bytes(image_bytes, b2_key, content_type="image/jpeg")
                book.cover_key = b2_key
                uploaded += 1

                if (uploaded) % 50 == 0:
                    db.commit()
                    print(f"  Uploaded {uploaded} covers...")
            except Exception as e:
                print(f"  Error uploading cover for book {book.calibre_id}: {e}")

        db.commit()
        print(f"Cover upload complete: {uploaded} covers uploaded")
    finally:
        db.close()


if __name__ == "__main__":
    opf_dir = sys.argv[1] if len(sys.argv) > 1 else "/data/opf"
    epub_dir = sys.argv[2] if len(sys.argv) > 2 else "/data/epub"
    main(opf_dir, epub_dir)
