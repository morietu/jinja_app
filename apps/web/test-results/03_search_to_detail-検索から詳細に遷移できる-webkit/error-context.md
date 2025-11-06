# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - navigation [ref=e3]:
      - link "Jinja" [ref=e4]:
        - /url: /
      - link "検索" [ref=e5]:
        - /url: /search
      - link "ランキング" [ref=e6]:
        - /url: /ranking
      - link "御朱印帳" [ref=e8]:
        - /url: /mypage?tab=goshuin
  - main [ref=e9]:
    - main [ref=e10]:
      - heading "検索結果" [level=1] [ref=e11]
      - generic [ref=e12]:
        - textbox "神社名や地域で検索..." [ref=e13]
        - button "現在地を使う" [ref=e14]
        - button "検索" [ref=e15]
      - paragraph [ref=e16]: キーワードを入力して検索してください。
  - button "Open Next.js Dev Tools" [ref=e22] [cursor=pointer]:
    - img [ref=e23]
  - alert [ref=e28]
```