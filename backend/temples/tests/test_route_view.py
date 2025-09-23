from .factories import make_user, make_shrine

# temples/tests/test_route_view.py
import os
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from temples.models import Shrine

User = get_user_model()


class RouteViewTests(TestCase):
    def setUp(self):
        # テンプレで <script ... key=...> を出すために一時キーを設定
        os.environ["GOOGLE_MAPS_API_KEY"] = "test-key"
        # 最小のユーザー＆神社
        self.user = make_user(username="u", password="p")
        self.shrine = make_shrine(name="S1", owner=self.user)

    def test_requires_login_redirects_to_login(self):
        url = reverse("temples:shrine_route", args=[self.shrine.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 302)
        # /accounts/login/?next=... に飛ぶこと
        self.assertIn("/accounts/login/", resp["Location"])
        self.assertIn("next=", resp["Location"])

    def test_route_page_renders_with_script_and_map_div(self):
        # 先にログイン
        self.client.login(username="u", password="p")

        url = reverse("temples:shrine_route", args=[self.shrine.pk])
        resp = self.client.get(url + "?lat=35&lng=139")
        self.assertEqual(resp.status_code, 200)

        html = resp.content
        # map コンテナがあること
        self.assertIn(b'id="map"', html)
        # Maps JS の読み込み（callback=initMap）が出力されていること
        self.assertIn(b"callback=initMap", html)
        # テスト用キーが埋め込まれていること
        self.assertIn(b"key=test-key", html)
