# backend/temples/domain/fortune.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

ETO = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
# 十二支→五行（ざっくり対応）
ETO_TO_GOGYOU = {
    "子": "水",
    "丑": "土",
    "寅": "木",
    "卯": "木",
    "辰": "土",
    "巳": "火",
    "午": "火",
    "未": "土",
    "申": "金",
    "酉": "金",
    "戌": "土",
    "亥": "水",
}


@dataclass(frozen=True)
class FortuneProfile:
    year: int
    month: int
    day: int
    eto: Optional[str]
    gogyou: Optional[str]


def _parse_birthdate(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        # 受け付け例: "1988-03-12", "19880312"
        if "-" in s:
            y, m, d = s.split("-")
        else:
            y, m, d = s[:4], s[4:6], s[6:8]
        return date(int(y), int(m), int(d))
    except Exception:
        return None


def _eto_of_year(year: int) -> str:
    # 2020=子 になるように: (year - 4) % 12 -> 0: 子
    return ETO[(year - 4) % 12]


def fortune_profile(birthdate: Optional[str]) -> FortuneProfile:
    """
    生年月日(YYYY-MM-DD / YYYYMMDD)から十二支と五行をざっくり算出。
    失敗時は None を返さず、eto/gogyou を None にして返す（加点しないため）。
    """
    dt = _parse_birthdate(birthdate)
    if not dt:
        return FortuneProfile(0, 0, 0, None, None)
    eto = _eto_of_year(dt.year)
    gogyou = ETO_TO_GOGYOU.get(eto)
    return FortuneProfile(dt.year, dt.month, dt.day, eto, gogyou)
