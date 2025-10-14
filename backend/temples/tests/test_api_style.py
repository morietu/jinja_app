import json
import re
import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_openapi_conventions(client: APIClient):
    # /api/schema/ から OpenAPI を取得（drf-spectacular）
    url = reverse("schema")
    res = client.get(url)
    assert res.status_code == 200
    if "application/json" in res["Content-Type"]:
        schema = res.json()
    else:
        schema = json.loads(res.content.decode("utf-8"))

    paths = schema.get("paths", {})
    assert paths, "OpenAPI paths が空です"

    # ルール
    kebab = re.compile(r"^[a-z0-9\-{}\/]+$")  # 英数, -, /, {id}
    pluralish = re.compile(r"/api/[a-z0-9\-]+s(/|$)")

    violations = []

    for p in paths.keys():
        if not p.startswith("/api/"):
            # API 以外（/admin/, /schema など）はスキップ
            continue

        # 1) 文字種（kebab-case）とスラッシュ
        if not kebab.match(p):
            violations.append(f"[path-case] {p}")

        # 2) リソースは複数形（/api/xxx[s]/...）
        # 例外レジスター（必要に応じてここへ）
        exceptions = {
            "/api/auth/jwt/create/",
            "/api/auth/jwt/refresh/",
            "/api/auth/jwt/verify/",
            "/api/concierge/plan/",
        }
        if p not in exceptions and not pluralish.search(p):
            violations.append(f"[plural] {p}")

        # 3) 詳細系は /{id}/ を使う（数字/uuid はOpenAPIだと {id} 置換になってるはず）
        # → 必須ではないが、resource/{id}/パターンに寄せる指針をチェックしたい場合は追加

        # 4) メソッドは限定（GET/POST/PATCH/DELETE）
        allowed = {"get", "post", "patch", "delete"}
        methods = set(paths[p].keys())
        unknown = {m for m in methods if m not in allowed and m not in {"parameters"}}
        if unknown:
            violations.append(f"[methods] {p} -> {sorted(unknown)}")

    assert not violations, "API style violations:\n" + "\n".join(violations)
