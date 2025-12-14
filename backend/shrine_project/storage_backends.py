# backend/shrine_project/storage_backends.py
from storages.backends.s3boto3 import S3Boto3Storage


class R2MediaStorage(S3Boto3Storage):
    """
    Cloudflare R2 (S3互換) を Django の media 保存先として使う。
    - location は "media" にしない（付けると URL に /media/ が二重になりやすい）
    """
    location = ""                 # ここは空でOK（推奨）
    default_acl = None
    file_overwrite = False

    # 署名付きURLを使わない（public配信前提）
    querystring_auth = False
