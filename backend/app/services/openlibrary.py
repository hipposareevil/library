import httpx

from app.config import settings

_cache: dict[str, dict | None] = {}


async def get_book_overview(isbn: str) -> dict | None:
    """Fetch book overview from OpenLibrary by ISBN. Returns cached result if available."""
    if isbn in _cache:
        return _cache[isbn]

    base = settings.openlibrary_base_url
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
