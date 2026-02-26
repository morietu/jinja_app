# temples/tests/test_route_view.py
import pytest
from django.test import TestCase
from django.urls import reverse

from tests.factories import make_shrine, make_user


class RouteViewTests(TestCase):
    def setUp(self):
        self.user = make_user(username="u", password="p")
        self.shrine = make_shrine(name="S1", owner=self.user)

    @pytest.mark.slow
    def test_requires_login_redirects_to_login(self):
        url = reverse("temples:shrine_route", args=[self.shrine.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 302)
        self.assertIn("/accounts/login/", resp["Location"])
        self.assertIn("next=", resp["Location"])

    @pytest.mark.slow
    def test_route_page_renders_google_maps_links(self):
        self.client.login(username="u", password="p")

        url = reverse("temples:shrine_route", args=[self.shrine.pk])
        resp = self.client.get(url + "?lat=35&lng=139")
        self.assertEqual(resp.status_code, 200)

        html = resp.content

        # ✅ もう埋め込み地図はしない（課金/依存を増やさない）
        self.assertNotIn(b"maps.googleapis.com/maps/api/js", html)
        self.assertNotIn(b"callback=initMap", html)
        self.assertNotIn(b'id="map"', html)

        # ✅ Googleマップへ「検索」と「ルート」のリンクがあること
        self.assertIn(b"https://www.google.com/maps/search/?api=1", html)
        self.assertIn(b"https://www.google.com/maps/dir/?api=1", html)

        # ✅ 座標を渡したなら destination=lat,lng が出る（URL encode の %2C を許容）
        self.assertTrue(
            (b"destination=35%2C139" in html) or (b"destination=35,139" in html),
            msg="destination に 35,139 が含まれていない",
        )
