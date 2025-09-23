def rough_route(distance_m: int, transport: str = "walking") -> int:
    """距離[m]から概算の移動時間[分]を求める（MVP用のラフ計算）。"""
    if transport == "walking":
        return max(1, distance_m // 80)  # 徒歩 ≒ 80 m/分
    if transport == "driving":
        return max(1, distance_m // 500)  # 市街地走行 ≒ 30 km/h
    return max(1, distance_m // 120)  # 公共交通（徒歩+待ち等のラフ換算）
