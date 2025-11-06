# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - navigation [ref=e3]:
      - link "Jinja" [ref=e4] [cursor=pointer]:
        - /url: /
      - link "検索" [ref=e5] [cursor=pointer]:
        - /url: /search
      - link "ランキング" [ref=e6] [cursor=pointer]:
        - /url: /ranking
      - link "御朱印帳" [ref=e8] [cursor=pointer]:
        - /url: /mypage?tab=goshuin
  - main [ref=e9]:
    - main [ref=e10]:
      - heading "あなたの近くの神社" [level=1] [ref=e11]
      - paragraph [ref=e12]: ブラウザの位置情報の許可が必要です。
      - region "近くの神社" [ref=e13]:
        - generic [ref=e14]: 現在地 緯度35.6812 経度139.7671、上限 10 件
        - status [ref=e15]:
          - img [ref=e17]
          - paragraph [ref=e22]: 見つかりませんでした
          - paragraph [ref=e23]: 検索半径を広げるか、キーワードを調整してください。
          - button "再検索" [ref=e24]
  - button "Open Next.js Dev Tools" [ref=e30] [cursor=pointer]:
    - img [ref=e31]
  - alert [ref=e34]
```