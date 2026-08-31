import sys, types
mod = types.ModuleType("blasthttp")
class _E(Exception): pass
mod.HTTPStatusError = _E
mod.HTTPStatus = type("HTTPStatus", (), {"OK":200,"NOT_FOUND":404,"ERROR":0})
mod.HTTPResponse = type("HTTPResponse", (), {})
mod.HTTPClient = type("HTTPClient", (), {})
sys.modules["blasthttp"] = mod
sys.argv = ["bbot"] + sys.argv[1:]
from bbot.cli import main
main()
