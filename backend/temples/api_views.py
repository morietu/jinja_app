# 旧: temples.api_views への参照を、新APIへ橋渡しする shim
from temples.api.views.shrine import NearestShrinesAPIView as ShrineNearbyView
from temples.api.views.shrine import ShrineViewSet

__all__ = ["ShrineViewSet", "ShrineNearbyView"]
