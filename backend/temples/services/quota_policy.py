# temples/services/quota_policy.py
from __future__ import annotations

QUOTA_POLICY = {
    "anonymous": {
        "concierge": {"limit": 3, "unlimited": False},
        "favorite": {"limit": 0, "unlimited": False},
        "goshuin_upload": {"limit": 0, "unlimited": False},
        "shrine_search": {"limit": None, "unlimited": True, "mode": "db_only"},
    },
    "free": {
        "concierge": {"limit": 3, "unlimited": False},
        "favorite": {"limit": 10, "unlimited": False},
        "goshuin_upload": {"limit": 5, "unlimited": False},
        "shrine_search": {"limit": None, "unlimited": True, "mode": "db_only"},
    },
    "premium": {
        "concierge": {"limit": None, "unlimited": True},
        "favorite": {"limit": None, "unlimited": True},
        "goshuin_upload": {"limit": None, "unlimited": True},
        "shrine_search": {"limit": None, "unlimited": True, "mode": "extended"},
    },
}


def get_feature_policy(plan: str, feature: str) -> dict:
    return QUOTA_POLICY[plan][feature]
