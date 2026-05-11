"""SQLite-backed cache for FMP API responses, with TTL eviction."""

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from app.config import CACHE_TTL_SECONDS


# Resolves to backend/cache.db regardless of cwd:
#   backend/app/services/cache.py  →  parent.parent.parent  →  backend/
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "cache.db"


class PersistentCache:
    """Thread-safe SQLite cache with TTL-based read expiry.

    Drop-in replacement for the previous in-memory `TTLCache`:
        cache.get(key)  →  parsed JSON, or None on miss/expiry
        cache.set(key, value)  →  upserts the row with current timestamp
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

    def get(self, key: str) -> Any:
        cutoff = int(time.time()) - self._ttl
        with self._lock:
            cursor = self._conn.execute(
                "SELECT response_json FROM fmp_cache "
                "WHERE cache_key = ? AND created_at > ?",
                (key, cutoff),
            )
            row = cursor.fetchone()

        if row is None:
            self._miss_count += 1
            # Occasional opportunistic housekeeping; cheap and bounded.
            if self._miss_count % 100 == 0:
                self.clear_expired()
            return None

        try:
            return json.loads(row[0])
        except (ValueError, TypeError):
            return None

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
        cutoff = int(time.time()) - self._ttl
        with self._lock:
            self._conn.execute(
                "DELETE FROM fmp_cache WHERE created_at <= ?",
                (cutoff,),
            )
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            try:
                self._conn.close()
            except sqlite3.Error:
                pass
