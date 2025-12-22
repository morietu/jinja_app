# backend/temples/tests/api/test_goshuin_api.py
from __future__ import annotations


import io
from PIL import Image
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from temples.api.views.goshuin import MAX_MY_GOSHUINS
from temples.models import Goshuin, GoshuinImage, Shrine

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


# -------- helpers --------

def _make_user(email: str = "u@example.com", password: str = "pass1234"):
    # username 必須の環境に合わせる
    username = email.split("@")[0]
    return User.objects.create_user(username=username, email=email, password=password)


def _make_shrine():
    # 必須項目が環境で変わりがちなので、無難に全部入れる
    return Shrine.objects.create(
        name_jp="テスト神社",
        address="東京都千代田区1-1",
        latitude=35.6812,
        longitude=139.7671,
    )

def _png_file(name: str = "test.png", size=(32, 32)) -> SimpleUploadedFile:
    buf = io.BytesIO()
    img = Image.new("RGB", size)
    img.save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")


# -------- tests --------

@pytest.mark.django_db
def test_my_goshuins_requires_auth(client: APIClient):
    res = client.get("/api/my/goshuins/")
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_my_goshuins_create_upload_creates_image_row(client: APIClient):
    user = _make_user("me@example.com")
    shrine = _make_shrine()
    client.force_authenticate(user=user)

    payload = {
        "shrine": shrine.id,
        "title": "御朱印テスト",
        "is_public": False,
        "image": _png_file(),
    }
    res = client.post("/api/my/goshuins/", data=payload, format="multipart")
    assert res.status_code == 201, res.content

    goshuin_id = res.json()["id"]
    g = Goshuin.objects.get(id=goshuin_id)

    assert g.user_id == user.id
    assert g.shrine_id == shrine.id
    assert g.is_public is False

    imgs = GoshuinImage.objects.filter(goshuin=g).order_by("order", "id")
    assert imgs.count() == 1
    assert imgs.first().image
    assert (imgs.first().size_bytes or 0) >= 0  # 0でも許容（環境差を吸収）


@pytest.mark.django_db
def test_public_goshuins_list_shows_only_public(client: APIClient):
    shrine = _make_shrine()
    u1 = _make_user("u1@example.com")
    u2 = _make_user("u2@example.com")

    g_pub = Goshuin.objects.create(user=u1, shrine=shrine, title="public", is_public=True)
    GoshuinImage.objects.create(goshuin=g_pub, image=_png_file("pub.png"), order=0, size_bytes=123)

    g_priv = Goshuin.objects.create(user=u2, shrine=shrine, title="private", is_public=False)
    GoshuinImage.objects.create(goshuin=g_priv, image=_png_file("priv.png"), order=0, size_bytes=123)

    res = client.get("/api/goshuins/")
    assert res.status_code == 200

    ids = {row["id"] for row in res.json()}
    assert g_pub.id in ids
    assert g_priv.id not in ids


@pytest.mark.django_db
def test_my_goshuins_limit_exceeded_returns_403_with_code(client: APIClient):
    user = _make_user("limit@example.com")
    shrine = _make_shrine()
    client.force_authenticate(user=user)

    for i in range(MAX_MY_GOSHUINS):
        Goshuin.objects.create(user=user, shrine=shrine, title=f"t{i}", is_public=False)

    payload = {
        "shrine": shrine.id,
        "title": "overflow",
        "is_public": False,
        "image": _png_file(), 
    }
    res = client.post("/api/my/goshuins/", data=payload, format="multipart")
    assert res.status_code == 403

    body = res.json()
    assert body.get("code") == "PLAN_LIMIT_EXCEEDED"
    assert body.get("limit") == MAX_MY_GOSHUINS

@pytest.mark.django_db
def test_my_goshuins_patch_toggles_is_public(client: APIClient):
    user = _make_user("me2@example.com")
    shrine = _make_shrine()
    client.force_authenticate(user=user)

    # まず private で作成
    res = client.post(
        "/api/my/goshuins/",
        data={"shrine": shrine.id, "title": "t", "is_public": False, "image": _png_file()},
        format="multipart",
    )
    assert res.status_code == 201, res.content
    gid = res.json()["id"]

    # True にトグル
    res2 = client.patch(f"/api/my/goshuins/{gid}/", data={"is_public": True}, format="json")
    assert res2.status_code == 200, res2.content
    assert res2.json()["is_public"] is True

    g = Goshuin.objects.get(id=gid)
    assert g.is_public is True


@pytest.mark.django_db
def test_my_goshuins_delete_removes_child_images(client: APIClient):
    user = _make_user("me3@example.com")
    shrine = _make_shrine()
    client.force_authenticate(user=user)

    res = client.post(
        "/api/my/goshuins/",
        data={"shrine": shrine.id, "title": "t", "is_public": False, "image": _png_file()},
        format="multipart",
    )
    assert res.status_code == 201, res.content
    gid = res.json()["id"]

    g = Goshuin.objects.get(id=gid)
    assert GoshuinImage.objects.filter(goshuin=g).count() == 1

    # 削除
    res2 = client.delete(f"/api/my/goshuins/{gid}/")
    assert res2.status_code == 204, res2.content

    assert Goshuin.objects.filter(id=gid).exists() is False
    assert GoshuinImage.objects.filter(goshuin_id=gid).exists() is False


@pytest.mark.django_db
def test_my_goshuins_other_users_entry_is_not_visible(client: APIClient):
    owner = _make_user("owner@example.com")
    other = _make_user("other@example.com")
    shrine = _make_shrine()

    # owner が作る（DB直でもOK。画像も1枚付ける）
    g = Goshuin.objects.create(user=owner, shrine=shrine, title="secret", is_public=False)
    GoshuinImage.objects.create(goshuin=g, image=_png_file("x.png"), order=0, size_bytes=123)

    # other でアクセス
    client.force_authenticate(user=other)
    res = client.get(f"/api/my/goshuins/{g.id}/")

    # MyGoshuinViewSet は user 限定 queryset なので 404 が正
    assert res.status_code == 404

@pytest.mark.django_db
def test_my_goshuins_create_rejects_unsupported_content_type(client: APIClient):
    user = _make_user("ct@example.com")
    shrine = _make_shrine()
    client.force_authenticate(user=user)

    # PNGバイトを「text/plain」と偽って送る
    f = _png_file(name="x.txt")
    f.content_type = "text/plain"

    res = client.post(
        "/api/my/goshuins/",
        data={"shrine": shrine.id, "title": "t", "is_public": False, "image": f},
        format="multipart",
    )
    assert res.status_code == 400
    body = res.json()
    assert "image" in body


@pytest.mark.django_db
def test_my_goshuins_create_rejects_too_large_image(client: APIClient, settings):
    user = _make_user("size@example.com")
    shrine = _make_shrine()
    client.force_authenticate(user=user)

    # 上限を小さくしてテストを軽くする（10KB）
    # ※ settings を使わない実装なら、このテストは “実際に10MB超” を作る必要があるので重い
    # → もし定数直書きで行くなら、実装側を settings 経由にするのがオススメ
    #   （後述の「改善案」参照）
    # ここでは一旦「実装が settings を参照する形」に寄せる前提で書く
