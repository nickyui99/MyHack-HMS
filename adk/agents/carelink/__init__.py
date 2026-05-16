# `adk api_server agents/` adds `agents/` to sys.path and imports `carelink` as a
# top-level package — so absolute imports like `from agents.carelink ...` and
# sibling imports like `from tools ...` would fail. Add adk/ root to sys.path
# before any sibling import. Pytest unaffected (it discovers via conftest at adk/).
import pathlib
import sys

_ADK_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
if str(_ADK_ROOT) not in sys.path:
    sys.path.insert(0, str(_ADK_ROOT))

from agents.carelink.agent import root_agent  # noqa: E402

__all__ = ["root_agent"]
