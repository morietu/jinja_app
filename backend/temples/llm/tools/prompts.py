"""Back-compat shim: temples.llm.tools.prompts -> temples.llm.prompts"""
from .. import prompts as _p
globals().update({k: getattr(_p, k) for k in dir(_p) if not k.startswith("_")})
