# backend/temples/domain/astrology.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import logging
from typing import Optional, Literal

log = logging.getLogger(__name__)


Element = Literal["火", "土", "風", "水"]

# 星座境界（トロピカル固定）
# 星座境界（開始日）: 1月→12月の昇順にする
_ZODIAC = [
    ((1, 20), "水瓶座", "風"),
    ((2, 19), "魚座", "水"),
    ((3, 21), "牡羊座", "火"),
    ((4, 20), "牡牛座", "土"),
    ((5, 21), "双子座", "風"),
    ((6, 21), "蟹座", "水"),
    ((7, 23), "獅子座", "火"),
    ((8, 23), "乙女座", "土"),
    ((9, 23), "天秤座", "風"),
    ((10, 23), "蠍座", "水"),
    ((11, 22), "射手座", "火"),
    ((12, 22), "山羊座", "土"),
]

@dataclass(frozen=True)
class SunProfile:
    sign: str
    element: Element

def _parse_birthdate(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        # "1988-03-12" or "19880312"
        if "-" in s:
            y, m, d = s.split("-")
        else:
            y, m, d = s[:4], s[4:6], s[6:8]
        return date(int(y), int(m), int(d))
    except Exception:
        return None

def sun_sign_and_element(birthdate: Optional[str]) -> Optional[SunProfile]:
    dt = _parse_birthdate(birthdate)
    if not dt:
        return None

    # yearは境界計算に不要。月日だけで判定。
    m, d = dt.month, dt.day

    # _ZODIACは「開始日」で昇順。
    # 対象日付以上で最後にヒットした開始を採用。
    chosen = None
    for (sm, sd), sign, elem in _ZODIAC:
        if (m, d) >= (sm, sd):
            chosen = (sign, elem)
    # 1/1〜2/18 は山羊座（12/22開始）が chosen にならないので補完
    if chosen is None:
        chosen = ("山羊座", "土")

    return SunProfile(sign=chosen[0], element=chosen[1])  # type: ignore[return-value]

# backend/temples/domain/astrology.py（追記）
_COMPAT: dict[Element, list[Element]] = {
    "火": ["火", "風"],
    "風": ["風", "火"],
    "水": ["水", "土"],
    "土": ["土", "水"],
}

_EN_TO_JA: dict[str, Element] = {
    "fire": "火",
    "earth": "土",
    "air": "風",
    "water": "水",
    "火": "火",
    "土": "土",
    "風": "風",
    "水": "水",
}

def element_priority(user_elem: Element, shrine_elems: list[str] | None) -> int:
    if not shrine_elems:
        return 0

    # ★ 正規化（英語→日本語）
    norm: set[Element] = set()
    for x in shrine_elems:
        k = str(x).strip().lower()
        ja = _EN_TO_JA.get(k)
        if ja:
            norm.add(ja)

    if not norm:
        return 0

    if user_elem in norm:
        return 2
    if any(e in norm for e in _COMPAT[user_elem]):
        return 1
    return 0
