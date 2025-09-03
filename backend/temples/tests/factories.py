import uuid
from django.contrib.auth import get_user_model
from django.db import models
from temples.models import Shrine

def make_user(username=None, password="p", **extra):
    User = get_user_model()
    username = username or f"u-{uuid.uuid4().hex[:6]}"
    return User.objects.create_user(username=username, password=password, **extra)

def make_shrine(**overrides):
    """
    Shrine のフィールド差異を吸収するファクトリ。
    - name -> name_jp へ自動マップ（存在すれば）
    - owner/user -> 実際のUser FKフィールド名へ自動マップ
    - address が必須ならデフォルトを補う
    """
    fields = {f.name for f in Shrine._meta.fields}
    data = {}

    # name 系
    if "name" in overrides:
        val = overrides.pop("name")
        if "name" in fields:
            data["name"] = val
        elif "name_jp" in fields:
            data["name_jp"] = val
    else:
        if "name" in fields:
            data["name"] = "テスト神社"
        elif "name_jp" in fields:
            data["name_jp"] = "テスト神社"

    # address 必須なら補う
    if "address" in fields and "address" not in overrides:
        data["address"] = "東京都テスト区1-1-1"

    # User FK フィールド名を推測
    owner_override = overrides.pop("owner", None) or overrides.pop("user", None)
    owner_field = None
    for f in Shrine._meta.fields:
        if isinstance(f, models.ForeignKey):
            model = getattr(getattr(f, "remote_field", None), "model", None)
            if model and "user" in model.__name__.lower():
                owner_field = f.name
                break
    if owner_override and owner_field:
        data[owner_field] = owner_override

    data.update(overrides)
        # keep schema compatibility between `name` and `name_jp`
    if 'name' in data and 'name_jp' not in data:
        data['name_jp'] = data['name']
    if 'name' not in data and 'name_jp' in data:
        data['name'] = data['name_jp']
        # -- schema-compat for name/name_jp --
    # 1) prefer to mirror 'name' -> 'name_jp' when model has no 'name'
    from temples.models import Shrine as _S
    _fields = {f.name for f in _S._meta.get_fields() if getattr(f, "column", None)}

    if "name" in data and "name" not in _fields and "name_jp" in _fields:
        # copy over then drop invalid key
        data.setdefault("name_jp", data["name"])
        data.pop("name", None)

    if "name_jp" in data and "name_jp" not in _fields and "name" in _fields:
        data.setdefault("name", data["name_jp"])
        data.pop("name_jp", None)

    # （将来のスキーマ差異に備え）未知のキーは除去
    data = {k: v for k, v in data.items() if k in _fields}

    return Shrine.objects.create(**data)
