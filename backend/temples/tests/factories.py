# temples/tests/factories.py
import factory
from factory.django import DjangoModelFactory  # <-- you were missing this
from django.contrib.auth import get_user_model
from temples.models import Shrine  # adjust if your import path differs

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

    # Provide safe defaults that satisfy NOT NULLs
    name_jp = factory.Sequence(lambda n: f"S{n}")
    address = "東京都テスト区1-1-1"
    latitude = 35.0
    longitude = 139.0


def make_shrine(**kw):
    """
    Test helper that accepts test-friendly kwargs and maps them to model fields.
    Accepted aliases:
      - name  -> name_jp
      - owner/user are swallowed (don’t pass to model)
    """
    mapped = dict(kw)

    # Map alias fields expected by tests
    if "name" in mapped:
        mapped["name_jp"] = mapped.pop("name")

    # Do NOT forward owner/user into model (Shrine has no such field)
    _owner = mapped.pop("owner", None)
    _user = mapped.pop("user", None)

    # Ensure non-null coords if caller left them out
    mapped.setdefault("latitude", 35.0)
    mapped.setdefault("longitude", 139.0)

    shrine = ShrineFactory(**mapped)

    # If the model ever gains an owner field, attach it defensively
    if (_owner or _user) and hasattr(shrine, "owner_id"):
        shrine.owner = _owner or _user
        shrine.save()

    return shrine
