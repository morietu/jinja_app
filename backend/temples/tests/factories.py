# temples/tests/factories.py
import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory
from temples.models import Shrine

User = get_user_model()


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")


def make_user(username="user", password="p"):
    u = UserFactory(username=username)
    u.set_password(password)
    u.save()
    return u


class ShrineFactory(DjangoModelFactory):
    class Meta:
        model = Shrine

    # NOT NULL を満たすデフォルト
    name_jp = factory.Sequence(lambda n: f"S{n}")
    address = "東京都テスト区1-1-1"
    latitude = 35.0
    longitude = 139.0
    # Shrine.save() 側で lat/lng -> location が自動反映される想定


def make_shrine(*args, **kwargs):
    """
    テスト用ヘルパ（柔軟な呼び方が可能）:
      - 位置指定: make_shrine("名前", 35.6, 139.7, address="...")
      - キーワード: make_shrine(name="名前", lat=..., lng=..., address="...")
      - 既存互換: name -> name_jp にマッピング
    """
    # 位置を引数でも受けられるように
    if len(args) >= 3:
        name, lat, lng = args[:3]
        kwargs.setdefault("name", name)
        kwargs.setdefault("lat", lat)
        kwargs.setdefault("lng", lng)

    mapped = dict(kwargs)

    # エイリアスをモデル項目へマッピング
    if "name" in mapped:
        mapped["name_jp"] = mapped.pop("name")
    if "lat" in mapped:
        mapped["latitude"] = mapped.pop("lat")
    if "lng" in mapped:
        mapped["longitude"] = mapped.pop("lng")

    # 余計な引数は落とす（owner/user などモデルに無い物）
    mapped.pop("owner", None)
    mapped.pop("user", None)

    # デフォルト補完
    mapped.setdefault("address", "東京都テスト区1-1-1")
    mapped.setdefault("latitude", 35.0)
    mapped.setdefault("longitude", 139.0)

    return ShrineFactory(**mapped)
