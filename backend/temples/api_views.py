# 旧: temples.api_views への参照を、新APIへ橋渡しするshim
from temples.api.views.shrine import ShrineViewSet, NearestShrinesAPIView as ShrineNearbyView

__all__ = ["ShrineViewSet", "ShrineNearbyView"]
