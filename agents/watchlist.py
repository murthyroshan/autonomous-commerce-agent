"""
agents/watchlist.py — price watchlist: add, retrieve, remove, and check items.

Storage: watchlist/{user_id}.json  (list of watchlist entry dicts)

Phase 6 scope: log alerts only — no push notifications.
"""

import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

WATCHLIST_DIR = "watchlist"


def _watchlist_path(user_id: str) -> str:
    return os.path.join(WATCHLIST_DIR, f"{user_id}.json")


def _load_watchlist_raw(user_id: str) -> list[dict]:
    """Internal: read watchlist JSON, return [] if missing/corrupt."""
    path = _watchlist_path(user_id)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"_load_watchlist_raw({user_id}): read error — {e}")
        return []


def _save_watchlist_raw(user_id: str, items: list[dict]) -> None:
    """Internal: write watchlist atomically via temp-file + rename."""
    os.makedirs(WATCHLIST_DIR, exist_ok=True)
    path = _watchlist_path(user_id)
    dir_ = os.path.dirname(os.path.abspath(path))
    fd, tmp_path = tempfile.mkstemp(dir=dir_, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, path)
    except Exception as e:
        logger.error(f"_save_watchlist_raw({user_id}): write error — {e}")
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# ── Public API ────────────────────────────────────────────────────────────────

def add_to_watchlist(
    user_id: str,
    product: dict,
    target_price: float,
    query: str = "",
) -> None:
    """
    Add a product to the user's price watchlist.

    Entry structure:
    {
        "title":         str,
        "current_price": float,
        "target_price":  float,
        "source":        str,
        "link":          str,
        "query":         str,          # original search query to re-run
        "added_at":      ISO timestamp,
        "last_checked":  None,
        "triggered":     false,
    }
    Creates watchlist/ directory if needed.
    If an entry with the same title already exists it is replaced.
    """
    os.makedirs(WATCHLIST_DIR, exist_ok=True)
    items = _load_watchlist_raw(user_id)

    entry = {
        "title":         product.get("title", ""),
        "current_price": float(product.get("price", 0) or 0),
        "target_price":  float(target_price),
        "source":        product.get("source", ""),
        "link":          product.get("link", ""),
        "query":         query,
        "added_at":      datetime.now(timezone.utc).isoformat(),
        "last_checked":  None,
        "triggered":     False,
    }

    # Replace existing entry with same title, or append
    replaced = False
    for i, item in enumerate(items):
        if item.get("title") == entry["title"]:
            items[i] = entry
            replaced = True
            break
    if not replaced:
        items.append(entry)

    _save_watchlist_raw(user_id, items)
    logger.info(
        f"add_to_watchlist({user_id}): watching '{entry['title']}' "
        f"@ target ₹{target_price:,.0f}"
    )


def get_watchlist(user_id: str) -> list[dict]:
    """
    Return the full price watchlist for user_id.
    Returns [] if the file does not exist.
    """
    return _load_watchlist_raw(user_id)


def remove_from_watchlist(user_id: str, title: str) -> None:
    """
    Remove all entries whose title matches `title` from user_id's watchlist.
    Silently does nothing if the title is not found.
    """
    items = _load_watchlist_raw(user_id)
    new_items = [item for item in items if item.get("title") != title]
    if len(new_items) != len(items):
        _save_watchlist_raw(user_id, new_items)
        logger.info(f"remove_from_watchlist({user_id}): removed '{title}'")
    else:
        logger.debug(f"remove_from_watchlist({user_id}): '{title}' not found")


def check_watchlist_item(item: dict) -> Optional[dict]:
    """
    Re-run the search for item["query"] with item["target_price"] as the budget.
    If any result is priced at or below target_price, returns a trigger dict.
    Returns None if price not met or search fails.

    Trigger dict:
    {
        "triggered":    True,
        "product":      matched_product,
        "price":        matched_price,
        "saving":       item["current_price"] - matched_price,
    }

    Note: uses the pipeline search_agent with MOCK_ONLY respected.
    """
    from agents.state import initial_state
    from agents.search_agent import search_agent

    query = item.get("query", item.get("title", ""))
    target_price = float(item.get("target_price", 0))

    if not query:
        return None

    try:
        state = initial_state(query)
        result = search_agent(state)
        products = result.get("search_results", [])
    except Exception as e:
        logger.warning(f"check_watchlist_item: search failed for '{query}' — {e}")
        return None

    for product in products:
        price = float(product.get("price", 0) or 0)
        if price > 0 and price <= target_price:
            saving = float(item.get("current_price", 0)) - price
            logger.info(
                f"check_watchlist_item: TRIGGERED for '{item.get('title')}' "
                f"found ₹{price:,.0f} <= target ₹{target_price:,.0f}"
            )
            return {
                "triggered": True,
                "product":   product,
                "price":     price,
                "saving":    saving,
            }

    return None
