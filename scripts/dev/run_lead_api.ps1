$env:PYTHONPATH = "."
python -m uvicorn apps.api.app.main:app --reload --host 0.0.0.0 --port 8000
