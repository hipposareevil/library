import httpx

from app.config import settings

_cache: dict[str, dict | None] = {}

USER_AGENT = 'My Books (hipposareevil@protonmail.com)'


async def get_book_overview(isbn: str) -> dict | None:
    """Fetch book overview from OpenLibrary by ISBN. Returns cached result if available."""
    if isbn in _cache:
        return _cache[isbn]

    base = settings.openlibrary_base_url
    headers = {"User-Agent": USER_AGENT}
    try:
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            # Try ISBN lookup
            resp = await client.get(f"{base}/isbn/{isbn}.json")
            if resp.status_code != 200:
                _cache[isbn] = None
                return None

            book_data = resp.json()

            # Get the work for a richer description
            works = book_data.get("works", [])
            if works:
                work_key = works[0].get("key", "")
                work_resp = await client.get(f"{base}{work_key}.json")
                if work_resp.status_code == 200:
                    work_data = work_resp.json()
                    description = work_data.get("description", "")
                    if isinstance(description, dict):
                        description = description.get("value", "")
                    book_data["work_description"] = description
                    book_data["subjects"] = work_data.get("subjects", [])[:10]

            _cache[isbn] = book_data
            return book_data
    except httpx.HTTPError:
        _cache[isbn] = None
        return None


def get_cover_url(isbn: str, size: str = "L") -> str:
    """Get OpenLibrary cover URL by ISBN. Sizes: S, M, L."""
    return f"https://covers.openlibrary.org/b/isbn/{isbn}-{size}.jpg"


async def fetch_metadata_for_book(
    isbn: str | None,
    title: str | None,
    author: str | None,
) -> dict | None:
    """
    Fetch structured metadata from OpenLibrary for form population.
    Tries ISBN search first, falls back to title+author search.
    Returns a normalized dict with: title, author, publisher, publish_date,
    description, language, isbn, subjects (list[str]), cover_url (str|None).
    """
    base = settings.openlibrary_base_url
    headers = {"User-Agent": USER_AGENT}
    fields = "title,author_name,publisher,first_publish_year,isbn,subject,language,cover_i,key"

    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        doc = None

        # Strategy 1: search by ISBN
        if isbn:
            resp = await client.get(
                f"{base}/search.json",
                params={"isbn": isbn, "fields": fields, "limit": 1},
            )
            if resp.status_code == 200:
                docs = resp.json().get("docs", [])
                if docs:
                    doc = docs[0]

        # Strategy 2: search by title + author
        if doc is None and title:
            params: dict = {"title": title, "fields": fields, "limit": 1}
            if author:
                params["author"] = author
            resp = await client.get(f"{base}/search.json", params=params)
            if resp.status_code == 200:
                docs = resp.json().get("docs", [])
                if docs:
                    doc = docs[0]

        if doc is None:
            return None

        result: dict = {}

        if doc.get("title"):
            result["title"] = doc["title"]

        authors = doc.get("author_name", [])
        if authors:
            result["author"] = " & ".join(authors)

        publishers = doc.get("publisher", [])
        if publishers:
            result["publisher"] = publishers[0]

        year = doc.get("first_publish_year")
        if year:
            result["publish_date"] = f"{year}-01-01"

        isbns = doc.get("isbn", [])
        if isbns:
            isbn13 = next((i for i in isbns if len(i) == 13), None)
            result["isbn"] = isbn13 or isbns[0]

        langs = doc.get("language", [])
        if langs:
            result["language"] = langs[0]

        subjects = doc.get("subject", [])
        if subjects:
            result["subjects"] = subjects[:15]

        # Cover URL: prefer cover_i (cover ID), fall back to ISBN
        cover_i = doc.get("cover_i")
        if cover_i:
            result["cover_url"] = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
        elif result.get("isbn"):
            result["cover_url"] = f"https://covers.openlibrary.org/b/isbn/{result['isbn']}-L.jpg"
        elif isbn:
            result["cover_url"] = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"

        # Fetch description from work record
        work_key = doc.get("key")
        if work_key:
            try:
                work_resp = await client.get(f"{base}{work_key}.json")
                if work_resp.status_code == 200:
                    work_data = work_resp.json()
                    description = work_data.get("description", "")
                    if isinstance(description, dict):
                        description = description.get("value", "")
                    if description:
                        result["description"] = str(description)
            except httpx.HTTPError:
                pass

        return result or None
