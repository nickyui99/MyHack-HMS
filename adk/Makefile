.PHONY: install ping serve smoke seed-check clean

install:
	uv sync

# Verify ADC + Vertex Gemini reachability with one real call.
ping:
	uv run python -c "import os; from google import genai; \
	  c = genai.Client(vertexai=True); \
	  r = c.models.generate_content(model='gemini-flash-latest', contents='reply with the single word: pong'); \
	  print(r.text)"

# Run the ADK API server on :8100, exposing /run_sse for the React renderer.
# (Node Express matching API owns :8000, so the ADK chat server lives on :8100.)
serve:
	uv run adk api_server agents/ --port 8100

smoke:
	uv run pytest tests/ -v

seed-check:
	uv run python -c "import orjson, pathlib; \
	  d = orjson.loads(pathlib.Path('backend_stub/seed/actors.json').read_bytes()); \
	  print(f'{len(d)} actors loaded'); \
	  print(', '.join(a['name'] for a in d))"

clean:
	rm -rf .venv .pytest_cache __pycache__ */__pycache__ */*/__pycache__
