"""Google Books API service — series info lookup."""
import re

import httpx

GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"


async def _get_volume(client: httpx.AsyncClient, isbn: str | None, title: str | None, author: str | None) -> dict | None:
    """Return the first matching Google Books volume item, or None."""
    if isbn:
        resp = await client.get(GOOGLE_BOOKS_URL, params={"q": f"isbn:{isbn}", "maxResults": 1})
        if resp.status_code == 200:
            items = resp.json().get("items", [])
            if items:
                return items[0]

    if title:
        q = f"intitle:{title}"
        if author:
            q += f"+inauthor:{author}"
        resp = await client.get(GOOGLE_BOOKS_URL, params={"q": q, "maxResults": 1})
        if resp.status_code == 200:
            items = resp.json().get("items", [])
            if items:
                return items[0]

    return None


async def fetch_series_info(
    isbn: str | None,
    title: str | None,
    author: str | None,
) -> dict | None:
    """
    Fetch series name and index from Google Books.
    Returns {"series_name": str | None, "series_index": float | None} or None if no series found.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            item = await _get_volume(client, isbn, title, author)
            if not item:
                return None

            volume_info = item.get("volumeInfo", {})
            series_info = volume_info.get("seriesInfo", {})
            if not series_info:
                return None

            # Extract series position
            series_index: float | None = None
            book_num = series_info.get("bookDisplayNumber")
            if book_num:
                try:
                    series_index = float(book_num)
                except ValueError:
                    pass
            if series_index is None:
                for vs in series_info.get("volumeSeries", []):
                    order = vs.get("orderNumber")
                    if order is not None:
                        try:
                            series_index = float(order)
                        except (ValueError, TypeError):
                            pass
                        break

            # Extract series name: try fetching the series volume by its ID
            series_name: str | None = None
            volume_series = series_info.get("volumeSeries", [])
            if volume_series:
                series_id = volume_series[0].get("seriesId")
                if series_id:
                    try:
                        sr = await client.get(f"{GOOGLE_BOOKS_URL}/{series_id}")
                        if sr.status_code == 200:
                            series_name = sr.json().get("volumeInfo", {}).get("title")
                    except httpx.HTTPError:
                        pass

            # Fallback: parse "(Series Name, #N)" pattern from subtitle / title
            if not series_name:
                for text in [volume_info.get("subtitle", ""), volume_info.get("title", "")]:
                    m = re.search(r'\(([^)]+),\s*#[\d.]+\)', text)
                    if m:
                        series_name = m.group(1).strip()
                        break

            if series_name or series_index is not None:
                return {"series_name": series_name, "series_index": series_index}

    except httpx.HTTPError:
        pass

    return None
