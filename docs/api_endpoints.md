### GET /api/shrines/nearby/
半径内の神社を距離順で返す（km）。
Query: lat(float), lng(float), radius(m, default 1500, max 10000), limit(default 3, max 20)

**Example**
```bash
curl "http://localhost:8000/api/shrines/nearby/?lat=35.681236&lng=139.767125&radius=2000&limit=3" | python -m json.tool
