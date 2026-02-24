import io
import zipfile
from xml.etree import ElementTree as ET

from ebooklib import epub


def extract_metadata(file_bytes: bytes) -> tuple[dict, bytes | None]:
    """Extract metadata and cover image from an EPUB file."""
    book = epub.read_epub(io.BytesIO(file_bytes))

    def get_first(field: str) -> str | None:
        values = book.get_metadata("DC", field)
        if values:
            return values[0][0]
        return None

    # Extract identifiers
    isbn = None
    identifiers = book.get_metadata("DC", "identifier")
    for ident, attrs in identifiers:
        scheme = attrs.get("opf:scheme", "").upper()
        if scheme == "ISBN" or (ident and (ident.startswith("978") or ident.startswith("979"))):
            isbn = ident
            break

    metadata = {
        "title": get_first("title"),
        "author": get_first("creator"),
        "publisher": get_first("publisher"),
        "description": get_first("description"),
        "language": get_first("language"),
        "isbn": isbn,
    }

    # Try to extract date
    date_val = get_first("date")
    if date_val:
        metadata["publish_date"] = date_val[:10]  # Just YYYY-MM-DD

    # Extract cover image
    cover_bytes = _extract_cover(book, file_bytes)

    return metadata, cover_bytes


def _extract_cover(book: epub.EpubBook, file_bytes: bytes) -> bytes | None:
    """Try multiple strategies to find the cover image."""
    # Strategy 1: Look for item with cover properties
    for item in book.get_items():
        if item.get_type() == 3:  # IMAGE type
            name = item.get_name().lower()
            if "cover" in name:
                return item.get_content()

    # Strategy 2: Check metadata for cover reference
    cover_meta = book.get_metadata("OPF", "cover")
    if cover_meta:
        cover_id = cover_meta[0][1].get("content", "")
        for item in book.get_items():
            if item.get_id() == cover_id:
                return item.get_content()

    # Strategy 3: Check the EPUB zip for common cover filenames
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            for name in zf.namelist():
                lower = name.lower()
                if "cover" in lower and any(lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png")):
                    return zf.read(name)
    except zipfile.BadZipFile:
        pass

    return None
