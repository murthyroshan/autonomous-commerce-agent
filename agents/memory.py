"""
agents/memory.py — user preference memory and purchase history.

File layout:
    prefs/{user_id}.json       — user preferences (avoided brands, boosts, max price)
    history/{user_id}.jsonl    — append-only purchase log (one JSON per line)

All I/O is synchronous (agents are sync; FastAPI routes wrap with asyncio.to_thread).
Never raises — all callers wrap in try/except.
"""

import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

PREFS_DIR = "prefs"
HISTORY_DIR = "history"

_DEFAULT_PREFS: dict = {
    "preferred_brands": [],
    "avoided_brands": [],
    "preferred_sources": [],
    "rules": [],
    "max_price": None,
}


# ── Preferences ───────────────────────────────────────────────────────────────

def load_prefs(user_id: str) -> dict:
    """
    Load preferences for user_id from prefs/{user_id}.json.
    Returns a copy of _DEFAULT_PREFS if the file does not exist.
    Creates the prefs/ directory if needed.
    """
    os.makedirs(PREFS_DIR, exist_ok=True)
    path = os.path.join(PREFS_DIR, f"{user_id}.json")
    if not os.path.exists(path):
        return dict(_DEFAULT_PREFS)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Backfill any keys that were added since the file was last written
        merged = dict(_DEFAULT_PREFS)
        merged.update(data)
        return merged
    except Exception as e:
        logger.warning(f"load_prefs({user_id}): could not read prefs — {e}")
        return dict(_DEFAULT_PREFS)


def save_pref(user_id: str, key: str, value) -> None:
    """
    Update a single preference key for user_id and write back atomically.
    Uses a temp-file + rename to avoid partial writes.
    """
    os.makedirs(PREFS_DIR, exist_ok=True)
    prefs = load_prefs(user_id)
    prefs[key] = value
    path = os.path.join(PREFS_DIR, f"{user_id}.json")
    # Atomic write: write to a temp file in the same directory, then rename
    dir_ = os.path.dirname(os.path.abspath(path))
    fd, tmp_path = tempfile.mkstemp(dir=dir_, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(prefs, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, path)
        logger.debug(f"save_pref({user_id}): saved key='{key}'")
    except Exception as e:
        logger.error(f"save_pref({user_id}): write failed — {e}")
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# ── Rule filtering ────────────────────────────────────────────────────────────

def apply_user_rules(products: list[dict], prefs: dict) -> list[dict]:
    """
    Apply hard rules to remove products BEFORE scoring.

    Rules applied (in order):
    1. If product title contains any word from avoided_brands → remove
    2. If prefs["max_price"] is set → remove products priced above it

    This is a filter (deleted), not a boost. Returns the filtered list.
    """
    avoided: list[str] = [b.lower() for b in prefs.get("avoided_brands", []) if b]
    max_price: Optional[float] = prefs.get("max_price")

    kept = []
    for product in products:
        title_lower = product.get("title", "").lower()

        # Avoid-brand filter: remove if ANY word from avoided_brands appears
        if any(word in title_lower for word in avoided):
            logger.debug(f"apply_user_rules: removed '{product.get('title')}' (avoided brand)")
            continue

        # Max-price filter
        if max_price is not None:
            price = float(product.get("price") or 0)
            if price > max_price:
                logger.debug(
                    f"apply_user_rules: removed '{product.get('title')}' "
                    f"(price {price} > max {max_price})"
                )
                continue

        kept.append(product)

    return kept


# ── Purchase history ──────────────────────────────────────────────────────────

def log_purchase(user_id: str, product: dict, tx_id: Optional[str], app_id: Optional[int] = None, escrow_status: Optional[str] = None) -> None:
    """
    Append one confirmed purchase to history/{user_id}.jsonl.
    Fields written: title, price, source, link, score, tx_id, timestamp (ISO 8601).
    Creates the history/ directory if it does not exist.
    """
    os.makedirs(HISTORY_DIR, exist_ok=True)
    path = os.path.join(HISTORY_DIR, f"{user_id}.jsonl")
    entry = {
        "title":     product.get("title", ""),
        "price":     product.get("price"),
        "source":    product.get("source", ""),
        "link":      product.get("link", ""),
        "score":     product.get("score"),
        "tx_id":     tx_id,
        "app_id":    app_id,
        "escrow_status": escrow_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        logger.info(f"log_purchase({user_id}): logged '{entry['title']}'")
    except Exception as e:
        logger.error(f"log_purchase({user_id}): write failed — {e}")
        raise

def update_purchase_status(user_id: str, app_id: int, new_status: str) -> None:
    """
    Updates the escrow_status of a specific purchase identified by app_id in the user's history jsonl.
    Since jsonl is append-only, this rewrites the file safely.
    """
    path = os.path.join(HISTORY_DIR, f"{user_id}.jsonl")
    if not os.path.exists(path):
        return
        
    entries = []
    updated = False
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip(): continue
            try:
                entry = json.loads(line)
                if entry.get("app_id") == app_id:
                    entry["escrow_status"] = new_status
                    updated = True
                entries.append(entry)
            except json.JSONDecodeError:
                continue
                
    if updated:
        dir_ = os.path.dirname(os.path.abspath(path))
        fd, tmp_path = tempfile.mkstemp(dir=dir_, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                for entry in entries:
                    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            os.replace(tmp_path, path)
            logger.info(f"update_purchase_status({user_id}): updated app_id={app_id} to '{new_status}'")
        except Exception as e:
            logger.error(f"update_purchase_status({user_id}): rewrite failed — {e}")
            try: os.unlink(tmp_path)
            except OSError: pass
            raise



def get_history(user_id: str, limit: int = 20) -> list[dict]:
    """
    Return the last `limit` purchase entries for user_id, newest first.
    Returns [] if the history file does not exist.
    """
    path = os.path.join(HISTORY_DIR, f"{user_id}.jsonl")
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]
        entries = []
        for line in lines:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue  # skip corrupted lines
        # newest first
        return list(reversed(entries))[:limit]
    except Exception as e:
        logger.error(f"get_history({user_id}): read failed — {e}")
        return []
