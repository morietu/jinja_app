# backend/temples/domain/extra_condition_tags.py
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Tuple

# ここは「プロダクトが返せる価値」の軸。増やすのは後でいい。
# tags は英語キーで固定（DB/集計/UIに有利）
EXTRA_TAGS: Dict[str, List[str]] = {
    # sort 指示
    "sort_distance": ["近い", "近く", "徒歩", "できるだけ近", "最寄り", "距離優先"],
    "sort_popular": ["人気", "有名", "評判", "人が多い", "賑やか"],

    # 気分・エネルギー
    "energize": ["前向き", "活力", "元気", "やる気", "パワー", "エネルギー", "背中を押", "勇気"],
    "calm": ["落ち着", "静か", "穏やか", "ゆっくり", "整え", "安心", "リラックス"],
    "refresh": ["気分転換", "スッキリ", "浄化", "リセット", "切り替え", "リフレッシュ"],

    # 集中・思考
    "focus": ["集中", "整える", "思考", "頭が回", "クリア", "決めたい", "判断", "迷い"],
    "confidence": ["自信", "自己肯定", "肯定感", "堂々", "芯", "ブレない"],

    # 回復・ケア
    "healing": ["癒", "回復", "疲れ", "休み", "休息", "眠", "しんど", "ダメージ"],
    "stress_relief": ["ストレス", "不安", "緊張", "モヤモヤ", "心配", "焦り"],

    # 人間関係
    "relationship": ["人間関係", "対人", "コミュニケーション", "縁", "仲直り", "和解"],

    # 仕事・キャリア（need_tags と被るけど、extra の表現を拾う用）
    "career": ["転職", "仕事", "キャリア", "面接", "昇進", "挑戦", "環境", "適職"],
}

# ひらがな/カタカナ揺れ等は雑に吸収したいので正規化を軽く入れる
def _norm_text(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", "", s)
    return s

@dataclass(frozen=True)
class ExtraExtract:
    tags: List[str]
    hits: Dict[str, List[str]]

def extract_extra_tags(text: str, *, max_tags: int = 3) -> ExtraExtract:
    """
    自由文 extra_condition を辞書タグに落とす。
    - tags: 推定タグ（優先度順、最大 max_tags）
    - hits: {tag: [マッチした語...]}
    """
    t = _norm_text(text)
    if not t:
        return ExtraExtract(tags=[], hits={})

    hits: Dict[str, List[str]] = {}
    scores: List[Tuple[str, int]] = []

    for tag, words in EXTRA_TAGS.items():
        matched: List[str] = []
        for w in words:
            w2 = _norm_text(w)
            if not w2:
                continue
            # 部分一致。ここは後で改善（形態素/類義語）してもいいが、まずは辞書で勝つ。
            if w2 in t:
                matched.append(w)
        if matched:
            hits[tag] = matched
            # 雑スコア：ヒット数が多いほど強い
            scores.append((tag, len(matched)))

    # ヒット数→タグ優先度
    scores.sort(key=lambda x: x[1], reverse=True)
    tags = [tag for tag, _ in scores][:max_tags]

    return ExtraExtract(tags=tags, hits=hits)
