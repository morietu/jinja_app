# backend/shrine_project/cache_keys.py
from hashlib import md5


def memcache_safe_key(key: str, key_prefix: str, version: int) -> str:
    """
    memcached が要求する ASCII & 250文字以下の制約を満たすキーを返す。
    非ASCII/長すぎる場合は md5 でハッシュ化した短いキーにする。
    """
    base = f"{key_prefix}:{version}:{key}"
    try:
        base.encode("ascii")
        # バックエンドが付加する余白も見て少し短めに
        if len(base) <= 200:
            return base
    except UnicodeEncodeError:
        pass

    digest = md5(base.encode("utf-8")).hexdigest()
    return f"{key_prefix}:{version}:md5:{digest}"
