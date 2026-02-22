from __future__ import annotations

import re
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

# Google Place ID は基本 "ChI" で始まる（いまの方針）
_PLACE_ID_RE = re.compile(r"^ChI[A-Za-z0-9_-]{11,197}$")
_TEST_OR_INTERNAL_PLACE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{3,255}$")  # PID123 とかも通す

def validate_google_place_id_strict(value: str) -> str:
    v = (value or "").strip()
    if not v or not _PLACE_ID_RE.match(v):
        raise serializers.ValidationError({"place_id": "must be a Google Place ID starting with 'ChI'."})
    return v

# permissive: internal/test ids allowed, but guarded
def validate_place_id_permissive(value: str) -> str:
    v = (value or "").strip()
    if not v or not _TEST_OR_INTERNAL_PLACE_ID_RE.match(v):
        raise serializers.ValidationError({"place_id": "invalid place_id."})
    return v


# backward compat: old name used by older modules / imports.
# Keep until all call sites are migrated.
validate_place_id = validate_place_id_permissive

# backward compat (old name) - strict
validate_google_place_id = validate_google_place_id_strict


