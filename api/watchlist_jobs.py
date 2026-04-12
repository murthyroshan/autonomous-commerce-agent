"""
api/watchlist_jobs.py — APScheduler job that checks all user watchlists every 24 h.

Phase 6 scope: log alerts to logs/watchlist_alerts.jsonl only.
No push notifications.
"""

import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

WATCHLIST_DIR = "watchlist"
LOGS_DIR      = "logs"
ALERTS_LOG    = os.path.join(LOGS_DIR, "watchlist_alerts.jsonl")


def check_all_watchlists() -> None:
    """
    Scan every watchlist/{user_id}.json file.
    For each un-triggered item, call check_watchlist_item().
    On trigger: log to logs/watchlist_alerts.jsonl and mark as triggered.
    """
    if not os.path.isdir(WATCHLIST_DIR):
        logger.debug("check_all_watchlists: watchlist/ dir not found — nothing to do")
        return

    from agents.watchlist import (
        get_watchlist,
        _save_watchlist_raw,
        check_watchlist_item,
    )

    os.makedirs(LOGS_DIR, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()

    for filename in os.listdir(WATCHLIST_DIR):
        if not filename.endswith(".json"):
            continue
        user_id = filename[:-5]  # strip ".json"

        items = get_watchlist(user_id)
        changed = False

        for item in items:
            if item.get("triggered"):
                continue  # already triggered — don't re-alert

            try:
                result = check_watchlist_item(item)
            except Exception as e:
                logger.warning(f"check_all_watchlists: error checking item for {user_id} — {e}")
                continue

            item["last_checked"] = now

            if result:
                item["triggered"] = True
                changed = True

                alert = {
                    "user_id":     user_id,
                    "title":       item.get("title"),
                    "target_price": item.get("target_price"),
                    "found_price": result["price"],
                    "saving":      result["saving"],
                    "timestamp":   now,
                }
                try:
                    with open(ALERTS_LOG, "a", encoding="utf-8") as f:
                        f.write(json.dumps(alert, ensure_ascii=False) + "\n")
                    logger.info(
                        f"WATCHLIST ALERT: {user_id} — '{item.get('title')}' "
                        f"found at ₹{result['price']:,.0f} "
                        f"(target ₹{item.get('target_price', 0):,.0f})"
                    )
                except Exception as e:
                    logger.error(f"check_all_watchlists: alert log write failed — {e}")

        if changed:
            try:
                _save_watchlist_raw(user_id, items)
            except Exception as e:
                logger.error(f"check_all_watchlists: save failed for {user_id} — {e}")


def start_watchlist_scheduler() -> None:
    """
    Start the APScheduler background scheduler.
    Runs check_all_watchlists() immediately on startup (next_run_time=now),
    then every 24 hours.
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            check_all_watchlists,
            trigger=IntervalTrigger(hours=24),
            id="watchlist_check",
            name="Price watchlist checker",
            replace_existing=True,
            # Run immediately at startup so users see instant feedback in dev
            next_run_time=datetime.now(timezone.utc),
        )
        scheduler.start()
        logger.info("Watchlist scheduler started — next run in 24 h")
    except ImportError:
        logger.warning(
            "APScheduler not installed — watchlist background checks disabled. "
            "Run: pip install apscheduler==3.10.4"
        )
    except Exception as e:
        logger.error(f"start_watchlist_scheduler: failed to start — {e}")
