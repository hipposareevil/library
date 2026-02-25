import io
from pathlib import Path

from b2sdk.v2 import B2Api, InMemoryAccountInfo

from app.config import settings

_b2_api: B2Api | None = None
_bucket = None


def _get_bucket():
    global _b2_api, _bucket
    if _bucket is None:
        info = InMemoryAccountInfo()
        _b2_api = B2Api(info)
        _b2_api.authorize_account("production", settings.b2_key_id, settings.b2_app_key)
        _bucket = _b2_api.get_bucket_by_name(settings.b2_bucket_name)
    return _bucket


def upload_file(local_path: str, b2_key: str, content_type: str = "application/octet-stream") -> str:
    bucket = _get_bucket()
    file_info = bucket.upload_local_file(
        local_file=local_path,
        file_name=b2_key,
        content_type=content_type,
    )
    return file_info.id_


def upload_bytes(data: bytes, b2_key: str, content_type: str = "application/octet-stream") -> str:
    bucket = _get_bucket()
    file_info = bucket.upload_bytes(
        data_bytes=data,
        file_name=b2_key,
        content_type=content_type,
    )
    return file_info.id_


def get_download_url(b2_key: str) -> str:
    bucket = _get_bucket()
    return bucket.get_download_url(b2_key)


def download_bytes(b2_key: str) -> bytes:
    bucket = _get_bucket()
    downloaded = bucket.download_file_by_name(b2_key)
    buf = io.BytesIO()
    downloaded.save(buf)
    buf.seek(0)
    return buf.read()


def delete_file(b2_key: str) -> None:
    bucket = _get_bucket()
    file_version = bucket.get_file_info_by_name(b2_key)
    bucket.delete_file_version(file_version.id_, file_version.file_name)
