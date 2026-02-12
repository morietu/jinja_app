from __future__ import annotations

from rest_framework import serializers
from PIL import Image, UnidentifiedImageError

def validate_image_file(
    f,
    *,
    allowed_ct: set[str],
    allowed_formats: set[str],
    max_bytes: int,
) -> None:
    # content_type は “あれば” ゆるく見る（厳密禁止）
    ct = getattr(f, "content_type", None)
    if isinstance(ct, str) and ct:
        ct0 = ct.split(";", 1)[0].strip().lower()
        if ct0 and ct0 not in allowed_ct:
            raise serializers.ValidationError("Unsupported image type.")

    size = getattr(f, "size", None)
    if isinstance(size, int) and size > max_bytes:
        raise serializers.ValidationError("Image too large.")

    # 実体チェック（拡張子・ct偽装対策）
    try:
        try:
            f.seek(0)
        except Exception:
            pass

        img = Image.open(f)
        img.verify()
        fmt = (img.format or "").upper()
        if fmt not in allowed_formats:
            raise serializers.ValidationError("Unsupported image type.")
    except (UnidentifiedImageError, OSError):
        raise serializers.ValidationError("Unsupported image type.")
    finally:
        try:
            f.seek(0)  # verify() で読まれるので戻す
        except Exception:
            pass
