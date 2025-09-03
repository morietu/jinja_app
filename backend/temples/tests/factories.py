import uuid
from django.contrib.auth import get_user_model
from django.db import models
from temples.models import Shrine

def make_user(username=None, password="p", **extra):
    User = get_user_model()
    username = username or f"u-{uuid.uuid4().hex[:6]}"
    return User.objects.create_user(username=username, password=password, **extra)

def make_shrine(**overrides):
    # owner/user は取り出して保持（FK/M2M に使う）
    owner = overrides.pop("owner", None) or overrides.pop("user", None)

    fields = {f.name for f in Shrine._meta.fields}
    data = {}

    # name → name_jp の互換
    name = overrides.pop("name", None)
    if name is not None:
        if "name" in fields:
            data["name"] = name
        elif "name_jp" in fields:
            data["name_jp"] = name
    else:
        if "name" in fields:
            data["name"] = "テスト神社"
        elif "name_jp" in fields:
            data["name_jp"] = "テスト神社"

    # address がモデルにあればデフォルトを補う
    if "address" in fields and "address" not in overrides:
        data["address"] = "東京都テスト区1-1-1"

    # User FK フィールド名を推測してセット（存在する場合）
    owner_fk_field = None
    for f in Shrine._meta.fields:
        if isinstance(f, models.ForeignKey):
            model = getattr(getattr(f, "remote_field", None), "model", None)
            if model and "user" in model.__name__.lower():
                owner_fk_field = f.name
                break
    if owner and owner_fk_field:
        data[owner_fk_field] = owner

    # 実在フィールドのみ上書き
    for k, v in overrides.items():
        if k in fields:
            data[k] = v

    shrine = Shrine.objects.create(**data)

    # M2M owners があれば追加
    owners_rel = getattr(shrine, "owners", None)
    if owner and owners_rel is not None and hasattr(owners_rel, "add"):
        owners_rel.add(owner)

    return shrine
