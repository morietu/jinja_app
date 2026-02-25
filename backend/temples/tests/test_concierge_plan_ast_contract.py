import ast
from pathlib import Path

FORBIDDEN_KEYS = {
    "area", "where", "location_text", "area_resolved",
    "lat", "lng", "lon",
    "radius_m", "radius_km", "radius",
    "locationbias",
}

def test_plan_does_not_read_location_fields_from_request_data():
    path = Path("backend/temples/services/concierge_plan.py")
    src = path.read_text(encoding="utf-8")
    tree = ast.parse(src)

    violations = []

    class V(ast.NodeVisitor):
        def _key_from_first_arg(self, node):
            if node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                return node.args[0].value
            return None

        def visit_Call(self, node: ast.Call):
            # request_data.get("lat") / request_data.pop("lat") / request_data.setdefault("lat") 等
            if (
                isinstance(node.func, ast.Attribute)
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id == "request_data"
                and node.func.attr in {"get", "pop", "setdefault"}
            ):
                key = self._key_from_first_arg(node)
                if key in FORBIDDEN_KEYS:
                    violations.append((f"request_data.{node.func.attr}('{key}')", node.lineno))
            self.generic_visit(node)

        def visit_Subscript(self, node: ast.Subscript):
            # request_data["lat"] も禁止
            if isinstance(node.value, ast.Name) and node.value.id == "request_data":
                sl = node.slice
                if isinstance(sl, ast.Constant) and isinstance(sl.value, str):
                    key = sl.value
                    if key in FORBIDDEN_KEYS:
                        violations.append((f"request_data['{key}']", node.lineno))
            self.generic_visit(node)

    V().visit(tree)

    assert not violations, f"Forbidden location reads from request_data found: {violations}"
