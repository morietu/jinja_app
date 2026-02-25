import ast
from pathlib import Path


def test_plan_does_not_read_location_fields_from_request_data():
    # このテストファイル: temples/tests/test_concierge_plan_ast_contract.py
    # 目的ファイル:       temples/services/concierge_plan.py
    path = Path(__file__).resolve().parents[1] / "services" / "concierge_plan.py"
    src = path.read_text(encoding="utf-8")

    tree = ast.parse(src)

    banned = {"area", "where", "location_text", "lat", "lng", "lon", "radius_m", "radius_km", "locationbias"}

    violations = []

    class V(ast.NodeVisitor):
        def visit_Call(self, node: ast.Call):
            # request_data.get("lat") みたいな参照を検知
            if isinstance(node.func, ast.Attribute) and node.func.attr == "get":
                if node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                    key = node.args[0].value
                    if key in banned:
                        if isinstance(node.func.value, ast.Name) and node.func.value.id == "request_data":
                            violations.append((key, node.lineno))
            self.generic_visit(node)

    V().visit(tree)

    assert not violations, f"request_data から location系を参照している: {violations}"
