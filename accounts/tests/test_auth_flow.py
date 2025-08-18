from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model

User = get_user_model()

class AuthFlowTests(TestCase):
    def setUp(self):
        self.login_url = reverse("login")
        self.logout_url = reverse("logout")
        self.register_url = reverse("register")
        self.mypage_url = reverse("mypage")

    def test_login_page_renders(self):
        resp = self.client.get(self.login_url)
        self.assertEqual(resp.status_code, 200)
        self.assertTemplateUsed(resp, "registration/login.html")

    def test_register_creates_user_and_redirects_to_mypage(self):
        data = {"username": "etsuko", "password1": "Str0ngPass!123", "password2": "Str0ngPass!123"}
        resp = self.client.post(self.register_url, data, follow=False)
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp.headers.get("Location"), self.mypage_url)
        resp2 = self.client.get(self.mypage_url)
        self.assertEqual(resp2.status_code, 200)
        self.assertTrue(resp2.wsgi_request.user.is_authenticated)

    def test_mypage_requires_login(self):
        resp = self.client.get(self.mypage_url, follow=False)
        self.assertEqual(resp.status_code, 302)
        self.assertIn(self.login_url, resp.headers.get("Location"))
        self.assertIn("next=", resp.headers.get("Location"))

    def test_login_then_mypage(self):
        user = User.objects.create_user(username="taro", password="xYz-12345")
        resp = self.client.post(self.login_url, {"username": "taro", "password": "xYz-12345"})
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp.headers.get("Location"), self.mypage_url)
        resp2 = self.client.get(self.mypage_url)
        self.assertEqual(resp2.status_code, 200)

    def test_logout_requires_post(self):
        user = User.objects.create_user(username="jiro", password="xYz-12345")
        self.client.post(self.login_url, {"username": "jiro", "password": "xYz-12345"})
        resp_get = self.client.get(self.logout_url)
        self.assertEqual(resp_get.status_code, 405)
        resp_post = self.client.post(self.logout_url, follow=False)
        self.assertEqual(resp_post.status_code, 302)
        self.assertEqual(resp_post.headers.get("Location"), "/")
        resp_home = self.client.get("/")
        self.assertFalse(resp_home.wsgi_request.user.is_authenticated)
