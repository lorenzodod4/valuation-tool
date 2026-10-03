"""SQLite-backed cache for FMP API responses, with TTL eviction."""

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from app.config import CACHE_DB_PATH, CACHE_TTL_SECONDS


DEFAULT_DB_PATH = CACHE_DB_PATH

# Rows older than this are deleted during housekeeping. Must exceed the
# longest stale-fallback window so stale rows survive long enough to be useful.
_HOUSEKEEPING_MAX_AGE_SECONDS = 8 * 24 * 3600


class PersistentCache:
    """Thread-safe SQLite cache with per-read TTL.

        cache.get(key)                    → parsed JSON, or None on miss/expiry
        cache.get(key, ttl_seconds=86400) → same, with a caller-chosen TTL
        cache.get_with_age(key)           → (value, created_at) ignoring TTL
        cache.set(key, value)             → upserts the row with current timestamp
    """

    def __init__(
        self,
        db_path: str | Path = DEFAULT_DB_PATH,
        ttl_seconds: int = CACHE_TTL_SECONDS,
    ) -> None:
        self._db_path = str(db_path)
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._miss_count = 0
        # check_same_thread=False lets us share one connection across the
        # uvicorn worker's threads; the Lock above serializes access.
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        with self._lock:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS fmp_cache (
                    cache_key TEXT PRIMARY KEY,
                    response_json TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                )
                """
            )
            self._conn.commit()

    def get(self, key: str, ttl_seconds: int | None = None) -> Any:
        value, created_at = self.get_with_age(key)
        ttl = self._ttl if ttl_seconds is None else ttl_seconds
        if created_at is None or created_at <= int(time.time()) - ttl:
            self._miss_count += 1
            # Occasional opportunistic housekeeping; cheap and bounded.
            if self._miss_count % 100 == 0:
                self.clear_expired()
            return None
        return value

    def get_with_age(self, key: str) -> tuple[Any, int | None]:
        """Return (value, created_at) regardless of TTL, or (None, None)."""
        with self._lock:
            row = self._conn.execute(
                "SELECT response_json, created_at FROM fmp_cache WHERE cache_key = ?",
                (key,),
            ).fetchone()
        if row is None:
            return None, None
        try:
            return json.loads(row[0]), int(row[1])
        except (ValueError, TypeError):
            return None, None

    def set(self, key: str, value: Any) -> None:
        payload = json.dumps(value)
        now = int(time.time())
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO fmp_cache "
                "(cache_key, response_json, created_at) VALUES (?, ?, ?)",
                (key, payload, now),
            )
            self._conn.commit()

    def clear_expired(self) -> None:
        cutoff = int(time.time()) - max(self._ttl, _HOUSEKEEPING_MAX_AGE_SECONDS)
        with self._lock:
            self._conn.execute(
                "DELETE FROM fmp_cache WHERE created_at <= ?",
                (cutoff,),
            )
            self._conn.commit()

    def clear(self) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM fmp_cache")
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            try:
                self._conn.close()
            except sqlite3.Error:
                pass
