import html
import io
import logging
import re
import tempfile
import zipfile
from html.parser import HTMLParser
from xml.etree import ElementTree as ET

from ebooklib import epub

logger = logging.getLogger(__name__)


class _StripHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def get_text(self) -> str:
        return " ".join(p.strip() for p in self._parts if p.strip())


def _clean_description(text: str | None) -> str | None:
    if not text:
        return None
    # Strip HTML tags
    parser = _StripHTML()
    parser.feed(text)
    text = parser.get_text()
    # Decode HTML entities (&amp; &lt; etc.)
    text = html.unescape(text)
    # Strip common markdown (bold, italic, headers, links, images, code)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)         # images
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)     # [text](url) -> text
    text = re.sub(r"#{1,6}\s*", "", text)                     # headers
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)     # bold/italic *
    text = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", text)       # bold/italic _
    text = re.sub(r"`+([^`]+)`+", r"\1", text)                # inline code
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)  # bullets
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text or None


def extract_metadata(file_bytes: bytes) -> tuple[dict, bytes | None]:
    """Extract metadata and cover image from an EPUB file."""
    logger.info("epub_service: writing %d bytes to tempfile", len(file_bytes))
    with tempfile.NamedTemporaryFile(suffix=".epub", delete=True) as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        logger.info("epub_service: reading epub from %s", tmp.name)
        book = epub.read_epub(tmp.name)
    logger.info("epub_service: epub parsed ok")

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
        "description": _clean_description(get_first("description")),
        "language": get_first("language"),
        "isbn": isbn,
    }

    # Try to extract date
    date_val = get_first("date")
    if date_val:
        metadata["publish_date"] = date_val[:10]  # Just YYYY-MM-DD

    logger.info("epub_service: metadata = %s", {k: v for k, v in metadata.items() if k != "description"})

    # Extract cover image
    cover_bytes = _extract_cover(book, file_bytes)
    logger.info("epub_service: cover extraction %s", f"succeeded ({len(cover_bytes)} bytes)" if cover_bytes else "returned None")

    return metadata, cover_bytes


_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp")


def _extract_cover(book: epub.EpubBook, file_bytes: bytes) -> bytes | None:
    """Try multiple strategies to find the cover image."""

    # Strategy 1: EPUB3 — item with properties="cover-image"
    for item in book.get_items():
        props = getattr(item, "properties", []) or []
        if "cover-image" in props:
            logger.info("cover strategy 1 hit: %s", item.get_name())
            return item.get_content()

    # Strategy 2: image item whose id or filename contains "cover"
    for item in book.get_items():
        if item.get_type() == 3:  # IMAGE
            item_id = (item.get_id() or "").lower()
            name = item.get_name().lower()
            if "cover" in item_id or "cover" in name:
                logger.info("cover strategy 2 hit: %s", item.get_name())
                return item.get_content()

    # Strategy 3: OPF meta name="cover" pointing to a manifest id
    for ns_key in ("OPF", ""):
        cover_meta = book.get_metadata(ns_key, "cover")
        if cover_meta:
            cover_id = cover_meta[0][1].get("content", "")
            for item in book.get_items():
                if item.get_id() == cover_id:
                    logger.info("cover strategy 3 hit: id=%s name=%s", cover_id, item.get_name())
                    return item.get_content()

    logger.info("cover strategies 1-3 missed, falling back to ZIP parsing")
    # Strategies 4-7: parse the EPUB zip directly
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            namelist = set(zf.namelist())

            # Locate the OPF file via META-INF/container.xml
            opf_path, opf_dir = None, ""
            try:
                container = ET.fromstring(zf.read("META-INF/container.xml"))
                ns_c = {"cn": "urn:oasis:names:tc:opendocument:xmlns:container"}
                rf = container.find(".//cn:rootfile", ns_c)
                if rf is not None:
                    opf_path = rf.get("full-path", "")
                    opf_dir = opf_path.rsplit("/", 1)[0] if "/" in opf_path else ""
            except Exception:
                pass

            if opf_path and opf_path in namelist:
                opf_root = ET.fromstring(zf.read(opf_path))
                ns_opf = {"opf": "http://www.idpf.org/2007/opf"}

                def _resolve(href: str) -> str:
                    href = href.split("#")[0]
                    full = f"{opf_dir}/{href}" if opf_dir else href
                    return full.lstrip("/")

                def _read_if_image(path: str) -> bytes | None:
                    if path in namelist and any(path.lower().endswith(e) for e in _IMAGE_EXTS):
                        return zf.read(path)
                    return None

                # Strategy 4: manifest item with properties="cover-image"
                for item in opf_root.findall(".//opf:manifest/opf:item", ns_opf):
                    if "cover-image" in (item.get("properties") or ""):
                        data = _read_if_image(_resolve(item.get("href", "")))
                        if data:
                            return data

                # Strategy 5: <meta name="cover" content="id">
                cover_id = None
                for meta in opf_root.findall(".//opf:metadata/opf:meta", ns_opf):
                    if meta.get("name") == "cover":
                        cover_id = meta.get("content")
                        break
                if cover_id:
                    for item in opf_root.findall(".//opf:manifest/opf:item", ns_opf):
                        if item.get("id") == cover_id:
                            data = _read_if_image(_resolve(item.get("href", "")))
                            if data:
                                return data

                # Strategy 6: <guide> reference with type="cover"
                for ref in opf_root.findall(".//opf:guide/opf:reference", ns_opf):
                    if ref.get("type") == "cover":
                        href_path = _resolve(ref.get("href", ""))
                        # Direct image
                        data = _read_if_image(href_path)
                        if data:
                            return data
                        # HTML cover page — find first <img src>
                        if href_path in namelist:
                            try:
                                page = ET.fromstring(zf.read(href_path))
                                page_dir = href_path.rsplit("/", 1)[0] if "/" in href_path else ""
                                for img in page.iter("{http://www.w3.org/1999/xhtml}img"):
                                    src = img.get("src", "")
                                    if src:
                                        img_path = (f"{page_dir}/{src}" if page_dir else src).lstrip("/")
                                        data = _read_if_image(img_path)
                                        if data:
                                            return data
                            except Exception:
                                pass

            # Strategy 7: any zip entry with "cover" in its name
            for name in sorted(zf.namelist()):
                lower = name.lower()
                if "cover" in lower and any(lower.endswith(e) for e in _IMAGE_EXTS):
                    return zf.read(name)

            # Strategy 8: first image in the archive (last resort)
            images = [n for n in zf.namelist() if any(n.lower().endswith(e) for e in _IMAGE_EXTS)]
            if images:
                return zf.read(images[0])

    except (zipfile.BadZipFile, ET.ParseError) as e:
        logger.error("cover ZIP parsing failed: %s", e)

    logger.warning("all cover strategies exhausted, returning None")
    return None
