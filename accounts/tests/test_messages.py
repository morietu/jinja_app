from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User

class AuthMessagesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="p1")

    def test_login_shows_success_message(self):
        resp = self.client.post(
            reverse("login"),
            {"username": "u1", "password": "p1"},
            follow=True,  # リダイレクト後まで追う（= mypage）
        )
        # テンプレートに messages が来ているか
        msgs = list(resp.context["messages"])
        self.assertTrue(any("ログインしました" in m.message for m in msgs))

    def test_logout_shows_info_message(self):
        # 先にログイン
        self.client.post(reverse("login"), {"username": "u1", "password": "p1"})
        # POST ログアウト → Home へ
        resp = self.client.post(reverse("logout"), follow=True)
        msgs = list(resp.context["messages"])
        self.assertTrue(any("ログアウトしました" in m.message for m in msgs))
