"""Parse OPF files from the /opf directory and import into the database."""
import glob
import os
import sys
from datetime import date

from lxml import etree

from app.database import SessionLocal
from app.models.book import Book, BookTag, Tag

NS = {
    "opf": "http://www.idpf.org/2007/opf",
    "dc": "http://purl.org/dc/elements/1.1/",
}
OPF_SCHEME = "{http://www.idpf.org/2007/opf}scheme"
OPF_FILE_AS = "{http://www.idpf.org/2007/opf}file-as"
OPF_ROLE = "{http://www.idpf.org/2007/opf}role"


def parse_opf(filepath: str) -> dict:
    """Parse a single OPF file and return a metadata dict."""
    tree = etree.parse(filepath)
    metadata = tree.find(".//opf:metadata", NS)
    if metadata is None:
        return {}

    data = {"_subjects": [], "_cover_file": None}

    # Calibre ID
    for ident in metadata.findall("dc:identifier", NS):
        scheme = ident.get(OPF_SCHEME, "")
        text = (ident.text or "").strip()
        if scheme == "calibre":
            try:
                data["calibre_id"] = int(text)
            except ValueError:
                pass
        elif scheme == "uuid" or "uuid" in ident.get("id", ""):
            data["uuid"] = text
        elif scheme == "ISBN":
            data["isbn"] = text
        elif scheme == "GOOGLE":
            data["google_id"] = text
        elif scheme == "AMAZON":
            data["amazon_id"] = text

    # Title
    title_el = metadata.find("dc:title", NS)
    if title_el is not None and title_el.text:
        data["title"] = title_el.text.strip()

    # Authors (may be multiple dc:creator)
    authors = []
    author_sort = None
    for creator in metadata.findall("dc:creator", NS):
        role = creator.get(OPF_ROLE, "")
        if role and role != "aut":
            continue
        if creator.text:
            authors.append(creator.text.strip())
        if not author_sort:
            file_as = creator.get(OPF_FILE_AS, "")
            if file_as:
                author_sort = file_as

    if authors:
        data["author"] = " & ".join(authors)
    if author_sort:
        data["author_sort"] = author_sort

    # Publisher
    pub_el = metadata.find("dc:publisher", NS)
    if pub_el is not None and pub_el.text:
        data["publisher"] = pub_el.text.strip()

    # Date
    date_el = metadata.find("dc:date", NS)
    if date_el is not None and date_el.text:
        try:
            date_str = date_el.text.strip()[:10]  # YYYY-MM-DD
            parts = date_str.split("-")
            year = int(parts[0])
            if 100 < year < 2100:
                month = int(parts[1]) if len(parts) > 1 else 1
                day = int(parts[2]) if len(parts) > 2 else 1
                month = max(1, min(12, month))
                day = max(1, min(28, day))
                data["publish_date"] = date(year, month, day)
        except (ValueError, IndexError):
            pass

    # Language
    lang_el = metadata.find("dc:language", NS)
    if lang_el is not None and lang_el.text:
        data["language"] = lang_el.text.strip()

    # Description
    desc_el = metadata.find("dc:description", NS)
    if desc_el is not None and desc_el.text:
        data["description"] = desc_el.text.strip()

    # Subjects (tags)
    for subj in metadata.findall("dc:subject", NS):
        if subj.text:
            data["_subjects"].append(subj.text.strip())

    # Calibre meta elements (no namespace)
    for meta in metadata.findall("meta"):
        name = meta.get("name", "")
        content = meta.get("content", "")
        if name == "calibre:title_sort":
            data["title_sort"] = content
        elif name == "calibre:rating":
            try:
                data["rating"] = int(float(content))
            except ValueError:
                pass
        elif name == "calibre:series":
            data["series_name"] = content
        elif name == "calibre:series_index":
            try:
                data["series_index"] = float(content)
            except ValueError:
                pass

    # Cover file reference from <guide>
    guide = tree.find(".//opf:guide", NS)
    if guide is not None:
        for ref in guide.findall("opf:reference", NS):
            if ref.get("type") == "cover":
                data["_cover_file"] = ref.get("href")

    return data


def get_or_create_tag(db, name: str) -> Tag:
    name = name[:500]  # guard against subjects longer than the column
    tag = db.query(Tag).filter(Tag.name == name).first()
    if not tag:
        tag = Tag(name=name)
        db.add(tag)
        db.flush()
    return tag


def upsert_book(db, data: dict) -> Book:
    """Insert or update a book by calibre_id."""
    subjects = data.pop("_subjects", [])
    cover_file = data.pop("_cover_file", None)

    calibre_id = data.get("calibre_id")
    if not calibre_id:
        return None

    book = db.query(Book).filter(Book.calibre_id == calibre_id).first()
    if book:
        # Update only if we have new non-None values
        for key, value in data.items():
            if value is not None:
                current = getattr(book, key, None)
                if current is None or key in ("description", "rating", "series_name", "series_index"):
                    setattr(book, key, value)
    else:
        # Ensure title exists
        if "title" not in data:
            return None
        book = Book(**{k: v for k, v in data.items() if not k.startswith("_")})
        db.add(book)

    db.flush()

    # Set tags
    if subjects:
        existing_tag_ids = {bt.tag_id for bt in db.query(BookTag).filter(BookTag.book_id == book.id).all()}
        for subj in subjects:
            tag = get_or_create_tag(db, subj)
            if tag.id not in existing_tag_ids:
                db.add(BookTag(book_id=book.id, tag_id=tag.id))

    return book


def main(opf_dir: str = "/data/opf"):
    if not os.path.isdir(opf_dir):
        print(f"OPF directory not found: {opf_dir}")
        sys.exit(1)

    opf_files = sorted(glob.glob(os.path.join(opf_dir, "*.opf")))
    print(f"Found {len(opf_files)} OPF files in {opf_dir}")

    db = SessionLocal()
    imported = 0
    errors = 0

    try:
        for i, filepath in enumerate(opf_files):
            try:
                data = parse_opf(filepath)
                if not data or "title" not in data:
                    continue
                book = upsert_book(db, data)
                if book:
                    imported += 1

                if (i + 1) % 100 == 0:
                    db.commit()
                    print(f"  Processed {i + 1}/{len(opf_files)}...")

            except Exception as e:
                errors += 1
                db.rollback()
                print(f"  Error parsing {os.path.basename(filepath)}: {e}")

        db.commit()
        print(f"Import complete: {imported} books imported, {errors} errors")
    finally:
        db.close()


if __name__ == "__main__":
    opf_dir = sys.argv[1] if len(sys.argv) > 1 else "/data/opf"
    main(opf_dir)
