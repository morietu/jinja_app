import re

def normalize_address(address: str) -> str:
    """Zenkaku spaces -> Hankaku, collapse spaces, strip."""
    if not address:
        return address
    s = address.replace("　", " ")
    s = re.sub(r"\s+", " ", s)
    return s.strip()
