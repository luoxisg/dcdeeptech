"""
utils/logging.py — Logging configuration for the gateway.

Uses stdlib logging with a clean format. Structured JSON logging can be
added here later (e.g. python-json-logger) without touching call sites.
"""

import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    """Configure root logger. Call once at startup."""
    fmt = "%(asctime)s %(levelname)-8s [%(name)s] %(message)s"
    datefmt = "%Y-%m-%dT%H:%M:%S"

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt, datefmt=datefmt))

    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.handlers = [handler]

    # Quiet down noisy third-party loggers
    for noisy in ("httpx", "httpcore", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
