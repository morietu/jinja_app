from __future__ import annotations

from typing import Any, Dict

def build_plan(*, request_data: Dict[str, Any], serializer_validated: Dict[str, Any]) -> Dict[str, Any]:
    """
    ConciergePlanView のロジックを移植して body を返す。
    ここでは挙動変更しない（まずは移植のみ）。
    """
    # TODO: ここに ConciergePlanView.post の中身を移す
    raise NotImplementedError
