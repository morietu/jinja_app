# tests/utils.py
from rest_framework.test import APIClient


def api_client_as(user=None):
    """
    認証あり/なしの APIClient を返す。
    user を渡せば force_authenticate する。
    """
    c = APIClient()
    if user is not None:
        c.force_authenticate(user=user)
    return c
