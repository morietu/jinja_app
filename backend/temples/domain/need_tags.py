# backend/temples/domain/need_tags.py
from __future__ import annotations

from dataclasses import dataclass
import re


NeedTag = str

# 15 tags fixed
NEED_TAGS: List[NeedTag] = [
    "love",
    "relationship",
    "marriage",
    "communication",
    "career",
    "money",
    "study",
    "health",
    "mental",
    "protection",
    "courage",
    "focus",
    "rest",
    "family",
    "travel_safe",
]

# 優先度（上ほど強い）
NEED_PRIORITY: List[NeedTag] = [
    "protection",
    "marriage",
    "love",
    "family",
    "study",
    "career",
    "money",
    "health",
    "mental",
    "relationship",
    "communication",
    "courage",
    "focus",
    "rest",
    "travel_safe",
]

# tag -> keywords (strings are treated as plain substrings; regex allowed with r"...")
# backend/temples/domain/need_tags.py

KEYWORDS: Dict[NeedTag, List[str]] = {
    "marriage": ["縁結び", "良縁", "結婚", "婚活", "結縁", "ご縁", "夫婦円満"],
    "love": ["恋愛", "恋", "復縁", "片思い", "両思い", "出会い", "告白"],
    "relationship": ["人間関係", "職場", "上司", "同僚", "家族", "親子", "友達", "対人"],
    "communication": ["会話", "発信", "伝える", "話す", "営業", "交渉", "プレゼン", "面接"],
    "career": [
        "転職", "仕事", "就職", "昇進", "独立", "起業", "キャリア", "天職",
        "道を開く",
    ],
    "money": [
        "金運", "収入", "給料", "貯金", "商売", "繁盛", "売上", "お金",
        "事業", "経営", "安定", "資金", "利益", "業績",
    ],
    "study": ["学業", "合格", "試験", "受験", "資格", "勉強", "成績", "学び直し"],
    "health": ["健康", "体調", "病気", "不調", "体力", "回復", "治す"],
    "mental": [
        "不安", "落ち込み", "ストレス", "メンタル", "自信", "焦り", "しんどい",
        "つらい", "辛い", "苦しい",
        "心を整えたい", "心を整える", "気持ちを整えたい", "整えたい", "癒し",
        "疲れ", "疲れて", "疲れている", "疲労",
    ],
    "protection": [
        "厄除", "厄払い", "浄化", "邪気", "お祓い", "災難", "守護",
        "守って", "守ってほしい", "守られたい",
    ],
    "courage": [
        "決断", "挑戦", "一歩", "背中押して", "勇気", "変わりたい", "踏み出す",
        "開運", "開運祈願", "開運祈願したい", "開運したい",
        "運を開きたい", "流れを変えたい", "流れを良くしたい",
        "背中を押してほしい", "背中を押して",
        "行動", "きっかけ", "行動したい", "動き出したい", "動きたい",
        "前向きになりたい", "後押ししてほしい",
    ],
    "focus": ["集中", "習慣", "継続", "怠け", "先延ばし", "やる気", "ルーティン"],
    "rest": [
        "休みたい", "休息", "疲れ", "回復", "睡眠", "眠れない", "リセット",
        "穏やか", "静か", "落ち着きたい", "落ち着く", "心を整えたい",
        "整えたい", "自然", "ゆっくり", "過ごしたい", "癒し",
        "ひと息", "ひと息つきたい", "日常から離れたい", "離れて", "慌ただしい"
    ],
    "family": ["子宝", "安産", "妊活", "授かり", "出産", "育児"],
    "travel_safe": ["旅行", "旅", "出張", "移動", "交通安全", "安全祈願"],
}

# 追加で拾う：漢字ゆれ等（regex）
REGEX: Dict[NeedTag, List[re.Pattern]] = {
    "protection": [
        re.compile(r"厄(除|払)"),
        re.compile(r"お祓い"),
        re.compile(r"守って"),
        re.compile(r"守られたい"),
    ],
    "study": [re.compile(r"(合格|必勝|試験)"), re.compile(r"受験")],
    "marriage": [re.compile(r"(縁結び|良縁|結婚)")],
    "love": [re.compile(r"(恋愛|復縁|片思い)")],
    "mental": [
        re.compile(r"つらい"),
        re.compile(r"辛い"),
        re.compile(r"苦しい"),
        re.compile(r"心を整え"),
        re.compile(r"疲れ(て|が|た)?"),
    ],
    "rest": [
        re.compile(r"(穏やか|静か|落ち着|リセット|休息|癒し|ひと息|一息)")
    ],
    "courage": [
        re.compile(r"背中を押して"),
        re.compile(r"運を開きたい"),
        re.compile(r"流れを良くしたい"),
        re.compile(r"開運(祈願)?"),
        re.compile(r"(行動|動き出|踏み出)"),
        re.compile(r"きっかけ(が)?ほしい"),
    ],
}

NEED_TEXT_HINTS = {
    "career": [
        "転職", "仕事", "転機", "キャリア", "挑戦", "前進",
    ],
    "mental": [
        "不安", "落ち込む", "気持ち", "心", "悩み",
        "疲れ", "疲れている", "しんどい",
        "落ち着きたい", "落ち着ける",
        "心を整えたい", "気持ちを整えたい",
    ],
    "rest": [
        "休みたい", "休息", "静か", "リセット", "ひと息",
    ],
    "courage": [
        "背中を押してほしい", "前向き", "一歩踏み出したい",
    ],
}

@dataclass(frozen=True)
class NeedExtract:
    tags: List[NeedTag]
    hits: Dict[NeedTag, List[str]]  # デバッグ用：どの語で当たったか

def extract_need_tags(query: str, *, max_tags: int = 3) -> NeedExtract:
    q = (query or "").strip()
    if not q:
        return NeedExtract(tags=[], hits={})

    hits: Dict[NeedTag, List[str]] = {}

    # substring match
    for tag, words in KEYWORDS.items():
        for w in words:
            if w and w in q:
                hits.setdefault(tag, []).append(w)

    # regex match
    for tag, patterns in REGEX.items():
        for p in patterns:
            m = p.search(q)
            if m:
                hits.setdefault(tag, []).append(m.group(0))

    # pick by priority
    picked: List[NeedTag] = []
    for tag in NEED_PRIORITY:
        if tag in hits and tag not in picked:
            picked.append(tag)
        if len(picked) >= max_tags:
            break

    return NeedExtract(tags=picked, hits=hits)
