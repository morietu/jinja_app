# temples/tests/fixtures/concierge_eval_queries.py

from __future__ import annotations

from typing import TypedDict


class ConciergeEvalQuery(TypedDict):
    id: str
    query: str
    expected_need: str
    expected_top_names: list[str]
    note: str


CONCIERGE_EVAL_QUERIES: list[ConciergeEvalQuery] = [
    {
        "id": "love_001",
        "query": "良縁に恵まれたい",
        "expected_need": "love",
        "expected_top_names": ["出雲大社", "明治神宮", "筑波山神社"],
        "note": "王道の縁結びクエリ",
    },
    {
        "id": "love_002",
        "query": "恋愛成就を願って参拝したい",
        "expected_need": "love",
        "expected_top_names": ["出雲大社", "明治神宮", "大國魂神社"],
        "note": "恋愛直球",
    },
    {
        "id": "love_003",
        "query": "人とのご縁を大事にしたい",
        "expected_need": "love",
        "expected_top_names": ["出雲大社", "明治神宮", "大國魂神社"],
        "note": "恋愛に限らない広めの縁",
    },
    {
        "id": "love_004",
        "query": "夫婦円満を願いたい",
        "expected_need": "love",
        "expected_top_names": ["筑波山神社", "明治神宮", "出雲大社"],
        "note": "夫婦・関係改善寄り",
    },
    {
        "id": "career_001",
        "query": "仕事で良い流れをつかみたい",
        "expected_need": "career",
        "expected_top_names": ["神田神社（神田明神）", "鶴岡八幡宮", "伏見稲荷大社"],
        "note": "仕事運の標準クエリ",
    },
    {
        "id": "career_002",
        "query": "転職を成功させたい",
        "expected_need": "career",
        "expected_top_names": ["神田神社（神田明神）", "猿田彦神社", "鶴岡八幡宮"],
        "note": "転機・方向転換",
    },
    {
        "id": "career_003",
        "query": "新しい挑戦を後押ししてほしい",
        "expected_need": "career",
        "expected_top_names": ["猿田彦神社", "鶴岡八幡宮", "宇佐神宮"],
        "note": "導き・勝運・前進",
    },
    {
        "id": "career_004",
        "query": "受験に向けて学業成就を祈願したい",
        "expected_need": "career",
        "expected_top_names": ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
        "note": "学業系も career に寄せる",
    },
    {
        "id": "money_001",
        "query": "商売繁盛を願いたい",
        "expected_need": "money",
        "expected_top_names": ["伏見稲荷大社", "神田神社（神田明神）", "西宮神社"],
        "note": "事業系金運",
    },
    {
        "id": "money_002",
        "query": "金運を上げたい",
        "expected_need": "money",
        "expected_top_names": ["伏見稲荷大社", "西宮神社", "神田神社（神田明神）"],
        "note": "最重要の money 基準",
    },
    {
        "id": "money_003",
        "query": "売上を伸ばしたい",
        "expected_need": "money",
        "expected_top_names": ["神田神社（神田明神）", "伏見稲荷大社", "松尾大社"],
        "note": "ビジネス成果寄り",
    },
    {
        "id": "money_004",
        "query": "事業を安定させたい",
        "expected_need": "money",
        "expected_top_names": ["神田神社（神田明神）", "伏見稲荷大社", "西宮神社"],
        "note": "派手すぎない商売系",
    },
    {
        "id": "mental_001",
        "query": "厄除けして心を整えたい",
        "expected_need": "mental",
        "expected_top_names": ["明治神宮", "春日大社", "熊野本宮大社"],
        "note": "厄除けとメンタル回復の複合",
    },
    {
        "id": "mental_002",
        "query": "不安が強いので気持ちを落ち着けたい",
        "expected_need": "mental",
        "expected_top_names": ["熊野本宮大社", "明治神宮", "伊勢神宮（内宮）"],
        "note": "不安軽減",
    },
    {
        "id": "mental_003",
        "query": "最近つらいので守ってほしい",
        "expected_need": "mental",
        "expected_top_names": ["日光東照宮", "春日大社", "明治神宮"],
        "note": "守護・厄除け寄り",
    },
    {
        "id": "mental_004",
        "query": "人生の流れを整えたい",
        "expected_need": "mental",
        "expected_top_names": ["伊勢神宮（内宮）", "明治神宮", "熊野本宮大社"],
        "note": "抽象度高めの mental",
    },
    {
        "id": "rest_001",
        "query": "静かな場所で心身をリセットしたい",
        "expected_need": "rest",
        "expected_top_names": ["熊野本宮大社", "伊勢神宮（内宮）", "春日大社"],
        "note": "休息ニーズの王道",
    },
    {
        "id": "rest_002",
        "query": "疲れたので落ち着ける神社に行きたい",
        "expected_need": "rest",
        "expected_top_names": ["春日大社", "明治神宮", "富士山本宮浅間大社"],
        "note": "静けさ・回復",
    },
    {
        "id": "rest_003",
        "query": "自然の中で穏やかに過ごしたい",
        "expected_need": "rest",
        "expected_top_names": ["伊勢神宮（内宮）", "熊野本宮大社", "富士山本宮浅間大社"],
        "note": "自然志向の rest",
    },
    {
        "id": "rest_004",
        "query": "慌ただしい日常から離れてひと息つきたい",
        "expected_need": "rest",
        "expected_top_names": ["明治神宮", "春日大社", "熊野本宮大社"],
        "note": "都市疲れからの回復",
    },
]
