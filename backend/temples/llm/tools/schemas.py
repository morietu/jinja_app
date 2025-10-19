"""Back-compat shim: temples.llm.tools.schemas -> temples.llm.schemas"""

from .. import schemas as _s

globals().update({k: getattr(_s, k) for k in dir(_s) if not k.startswith("_")})
