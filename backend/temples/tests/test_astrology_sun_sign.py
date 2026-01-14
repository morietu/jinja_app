import pytest
from temples.domain.astrology import sun_sign_and_element

@pytest.mark.parametrize(
    "birthdate, sign, element",
    [
        ("2000-03-21", "牡羊座", "火"),
        ("1984-05-15", "牡牛座", "土"),
        ("2000-02-19", "魚座", "水"),  # 魚座の開始側も1点置く
    ],
)
def test_sun_sign_and_element_known_dates(birthdate, sign, element):
    prof = sun_sign_and_element(birthdate)
    assert prof is not None
    assert prof.sign == sign
    assert prof.element == element
