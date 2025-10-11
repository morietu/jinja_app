# NOTE: admin 等が `from temples.models import Deity, GoriyakuTag, Shrine` を期待するため、
# 既存モデルの再エクスポートを維持した上で ConciergeHistory を追加する。

# 新規履歴モデル
from .concierge import ConciergeHistory
from .deity import Deity  # ← 同上
from .shrine import Shrine  # ← ファイル名が違う場合は正しいモジュールに修正
from .tags import GoriyakuTag  # ← 同上

__all__ = [
    "Shrine",
    "Deity",
    "GoriyakuTag",
    "ConciergeHistory",
]
