from .factories import make_user, make_shrine
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
User = get_user_model()
from temples.models import Shrine

class ShrinePermissionTests(TestCase):
    def setUp(self):
        self.u1 = make_user("u1", password="p")
        self.u2 = make_user("u2", password="p")
        self.s1 = make_shrine(name="S1", owner=self.u1)

    def test_non_owner_cannot_view_detail(self):
        self.client.login(username="u2", password="p")
        resp = self.client.get(reverse("temples:shrine_detail", args=[self.s1.pk]))
        self.assertEqual(resp.status_code, 404)

    def test_non_owner_cannot_route(self):
        self.client.login(username="u2", password="p")
        resp = self.client.get(reverse("temples:shrine_route", args=[self.s1.pk]))
        self.assertEqual(resp.status_code, 404)
