# backend/temples/services/goshuin_limit.py
MAX_MY_GOSHUINS_FREE = 10

def get_my_goshuin_limit(user) -> int:
    return MAX_MY_GOSHUINS_FREE
