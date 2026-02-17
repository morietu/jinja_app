# backend/temples/domain/kyusei.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, Literal, Dict, Any
from django.utils import timezone


# ---- Public types ---------------------------------------------------------

StarNum = Literal[1, 2, 3, 4, 5, 6, 7, 8, 9]


@dataclass(frozen=True)
class KyuseiResult:
    # 例: 7, "七赤金星"
    num: StarNum
    name: str
    # 九星の「年」として扱った年（節分境界を反映した年）
    ki_year: int
    # ざっくりの流れ（UI/理由文向け）
    flow_label_ja: str
    theme_ja: str


# ---- Constants ------------------------------------------------------------

# NOTE: 境界は本来「立春」（毎年微妙にズレる）。最小実装として 2/4 を固定。
# 精度を上げたくなったら、ここだけ差し替えればよい。
DEFAULT_SETSUBUN_MONTH = 2
DEFAULT_SETSUBUN_DAY = 4

STAR_NAMES: Dict[int, str] = {
    1: "一白水星",
    2: "二黒土星",
    3: "三碧木星",
    4: "四緑木星",
    5: "五黄土星",
    6: "六白金星",
    7: "七赤金星",
    8: "八白土星",
    9: "九紫火星",
}

# 雑に強い「年の説明」テンプレ（当て物じゃなく推薦の“納得材料”）
STAR_FLOW: Dict[int, Dict[str, str]] = {
    1: {"flow": "整える", "theme": "足元固め・内省・基盤づくり"},
    2: {"flow": "整える", "theme": "継続・育成・コツコツ積み上げ"},
    3: {"flow": "攻める", "theme": "スタート・発信・スピード感"},
    4: {"flow": "整える", "theme": "ご縁・調整・信頼を育てる"},
    5: {"flow": "切り替える", "theme": "刷新・手放し・方向転換"},
    6: {"flow": "攻める", "theme": "決断・責任・成果を取りに行く"},
    7: {"flow": "楽しむ", "theme": "喜び・社交・金運/循環を意識"},
    8: {"flow": "整える", "theme": "変化への準備・守り・蓄える"},
    9: {"flow": "攻める", "theme": "注目・評価・表現/感性を磨く"},
}


# ---- Helpers --------------------------------------------------------------

def parse_birthdate(s: Optional[str]) -> Optional[date]:
    """
    Accepts:
      - "YYYY-MM-DD"
      - "YYYY/MM/DD"
      - "YYYYMMDD"
    Returns date or None.
    """
    if not s or not isinstance(s, str):
        return None
    t = s.strip()
    if not t:
        return None

    # YYYYMMDD
    if len(t) == 8 and t.isdigit():
        try:
            return date(int(t[0:4]), int(t[4:6]), int(t[6:8]))
        except Exception:
            return None

    # YYYY-MM-DD / YYYY/MM/DD
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(t, fmt).date()
        except Exception:
            continue

    return None


def _ki_year(d: date, *, setsubun_month: int = DEFAULT_SETSUBUN_MONTH, setsubun_day: int = DEFAULT_SETSUBUN_DAY) -> int:
    """
    九星の年切替（節分/立春境界の簡易版）。
    d が境界より前なら前年扱い。
    """
    boundary = date(d.year, setsubun_month, setsubun_day)
    return d.year - 1 if d < boundary else d.year


def _star_num_from_year(y: int) -> StarNum:
    """
    九星（年盤）の基本式（最小実装）:
      num = 11 - (y % 9)
    結果は 1..9 に収まる。
    例: 1984 -> 7（七赤）
    """
    r = y % 9
    n = 11 - r
    # n は 2..11 になるので 1..9 に正規化
    n = ((n - 1) % 9) + 1
    return n  # type: ignore[return-value]


def _build_result(num: StarNum, ki_year: int) -> KyuseiResult:
    name = STAR_NAMES[int(num)]
    meta = STAR_FLOW.get(int(num), {"flow": "整える", "theme": "バランスを取る"})
    return KyuseiResult(
        num=num,
        name=name,
        ki_year=ki_year,
        flow_label_ja=meta["flow"],
        theme_ja=meta["theme"],
    )


# ---- Public API -----------------------------------------------------------

def honmei_star(birthdate: Optional[str], *, setsubun_month: int = DEFAULT_SETSUBUN_MONTH, setsubun_day: int = DEFAULT_SETSUBUN_DAY) -> Optional[KyuseiResult]:
    """
    本命星（生まれ年ベース。節分境界考慮の簡易版）
    """
    d = parse_birthdate(birthdate)
    if not d:
        return None
    ky = _ki_year(d, setsubun_month=setsubun_month, setsubun_day=setsubun_day)
    num = _star_num_from_year(ky)
    return _build_result(num, ky)


def year_star(
    today: Optional[date] = None,
    *,
    setsubun_month: int = DEFAULT_SETSUBUN_MONTH,
    setsubun_day: int = DEFAULT_SETSUBUN_DAY,
) -> KyuseiResult:
    """
    年星（今年の流れ）。today を渡さなければ timezone.localdate()
    """
    d = today or timezone.localdate()
    ky = _ki_year(d, setsubun_month=setsubun_month, setsubun_day=setsubun_day)
    num = _star_num_from_year(ky)
    return _build_result(num, ky)


def kyusei_signals(birthdate: Optional[str], *, today: Optional[date] = None) -> Optional[Dict[str, Any]]:
    """
    concierge 側に刺しやすい dict 形式（_signals 用）
    """
    honmei = honmei_star(birthdate)
    if not honmei:
        return None

    ys = year_star(today=today)
    return {
        "honmei": {
            "num": honmei.num,
            "name": honmei.name,
            "ki_year": honmei.ki_year,
        },
        "year": {
            "num": ys.num,
            "name": ys.name,
            "ki_year": ys.ki_year,
            "flow_label_ja": ys.flow_label_ja,
            "theme_ja": ys.theme_ja,
        },
        "note": "年切替は簡易的に2/4境界（立春近似）で計算しています",
    }
