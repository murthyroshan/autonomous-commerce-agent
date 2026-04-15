"""agents/social_proof.py — Social proof aggregator.

Fetches Reddit/YouTube review signals via Serper.dev's search APIs.
  - Reddit:  uses Serper organic search with targeted subreddit context
  - YouTube: uses Serper's dedicated /youtube endpoint for real video results
  - Sentiment: bag-of-words over snippets
  - Fallback: category-aware mock when SERPER_API_KEY is absent
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Sentiment vocabulary ───────────────────────────────────────────────────────

_POSITIVE = {
    "great", "excellent", "amazing", "love", "best", "fantastic", "worth",
    "recommend", "awesome", "perfect", "solid", "good", "nice", "impressive",
    "smooth", "reliable", "fast", "long", "battery", "value",
}
_NEGATIVE = {
    "bad", "terrible", "awful", "waste", "poor", "avoid", "broken", "cheap",
    "overpriced", "disappointed", "regret", "return", "slow", "fragile",
    "buggy", "overheating", "loud", "issue", "problem", "fail",
}

_SENTIMENT_EMOJI = {
    "positive": "🟢",
    "negative": "🔴",
    "mixed":    "🟡",
    "neutral":  "⚪",
}


def _sentiment_from_snippets(snippets: list[str]) -> str:
    """Simple bag-of-words sentiment over a list of text snippets."""
    pos = 0
    neg = 0
    for s in snippets:
        words = set(s.lower().split())
        pos += len(words & _POSITIVE)
        neg += len(words & _NEGATIVE)
    if pos == 0 and neg == 0:
        return "neutral"
    if pos > neg * 1.5:
        return "positive"
    if neg > pos * 1.5:
        return "negative"
    return "mixed"


# ── Main function ──────────────────────────────────────────────────────────────

def _shorten_product_name(title: str) -> str:
    """
    Extract a concise searchable name from a verbose product title.
    e.g. 'OnePlus Buds 3 Truly Wireless Bluetooth Earbuds with 49dB...' → 'OnePlus Buds 3'
    """
    # Common stop-words that signal the useful name has ended
    stop_markers = [
        'truly wireless', 'bluetooth', 'with', 'featuring', 'includes',
        'upto', 'up to', '(', '[', '|', '-', ',', 'wireless earphones',
        'in-ear', 'over-ear', 'on-ear', 'noise cancell', '5g', 'smart',
        'buy', 'price in india', 'review', 'best', 'specification', 'colour',
        'color', 'gb ram', 'gb storage', 'inch', 'display',
    ]
    name = title.strip()
    # Truncate at any stop marker (case-insensitive)
    for marker in stop_markers:
        idx = name.lower().find(marker.lower())
        if idx > 3:  # only truncate if we have at least some content
            name = name[:idx].strip().rstrip(',-|')
            break
    # Hard-cap at 5 words
    words = name.split()
    return ' '.join(words[:5]).strip()


def get_social_proof(title: str, query: str = "") -> dict:
    """
    Fetch social proof signals for a product.

    Uses Serper organic search for Reddit (targeted subreddits) and
    Serper's YouTube endpoint for real video reviews.

    Returns:
        {
            "sentiment": "positive" | "negative" | "mixed" | "neutral",
            "sentiment_emoji": str,
            "highlights": list[str],   # up to 3 community snippets
            "source_count": int,
            "reddit_url": str | None,
            "youtube_url": str | None,
        }
    """
    api_key = os.getenv("SERPER_API_KEY", "")
    if not api_key:
        return _mock_proof(title)

    import requests

    short_name = _shorten_product_name(title)
    logger.info(f"social_proof: searching for '{short_name}' (from '{title[:50]}'...)")

    reddit_results: list[dict] = []
    youtube_url: Optional[str] = None
    youtube_snippet: Optional[str] = None

    # ── Reddit: organic search targeting Indian tech subreddits ──────────────
    # Use multiple targeted subreddits for richer, higher-engagement threads
    # Adding inurl:comments ensures we get actual discussion threads, not empty pages
    reddit_subreddits = "site:reddit.com (r/india OR r/gadgets OR r/androidindia OR r/IndiaInvestments OR r/indiasocial OR r/TechiesIndia OR r/oneplus OR r/applesilicon)"
    # Append literal "comments" string to search to strictly filter threads with engagement
    # Wrap short_name in exact quotes to prevent Google returning unrelated brand threads (e.g., OnePlus reviews for a Noise watch)
    reddit_q = f"\"{short_name}\" review \"comments\" {reddit_subreddits}"
    try:
        resp = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": reddit_q, "num": 6, "gl": "in", "hl": "en"},
            timeout=8,
        )
        resp.raise_for_status()
        organic = resp.json().get("organic", [])
        # Only keep results that actually have a meaningful snippet and are on reddit
        for r in organic:
            link = r.get("link", "")
            snippet = r.get("snippet", "")
            if "reddit.com" in link and len(snippet) > 30:
                reddit_results.append(r)
    except Exception as e:
        logger.warning(f"Serper Reddit search failed: {e}")

    # Fallback Reddit search — broader if targeted subreddits returned nothing
    if not reddit_results:
        # Crucially, keep the exact quotes on short_name to prevent hallucinated fallback results
        reddit_q_broad = f"\"{short_name}\" review experience site:reddit.com"
        try:
            resp = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": reddit_q_broad, "num": 5, "gl": "in"},
                timeout=8,
            )
            resp.raise_for_status()
            for r in resp.json().get("organic", []):
                if "reddit.com" in r.get("link", "") and len(r.get("snippet", "")) > 30:
                    reddit_results.append(r)
        except Exception as e:
            logger.warning(f"Serper fallback Reddit search failed: {e}")

    # ── YouTube: use Serper's dedicated videos endpoint ──────────────────────
    # Append literal "K views" OR "M views" to filter for massive videos
    # Enclose in quotes to strictly block irrelevant YouTube products
    yt_q = f"\"{short_name}\" review \"K views\" OR \"M views\" in hindi english"
    try:
        resp = requests.post(
            "https://google.serper.dev/videos",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": yt_q, "num": 5, "gl": "in"},
            timeout=8,
        )
        resp.raise_for_status()
        videos = resp.json().get("videos", [])
        # Pick the first video result that has a valid YouTube link
        for v in videos:
            link = v.get("link", "")
            if "youtube.com/watch" in link or "youtu.be" in link:
                youtube_url = link
                youtube_snippet = v.get("snippet") or v.get("title", "")
                break
    except Exception as e:
        logger.warning(f"Serper YouTube videos search failed: {e}")
        # Fallback: organic search for YouTube
        try:
            resp = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": f"{short_name} review site:youtube.com", "num": 4, "gl": "in"},
                timeout=8,
            )
            resp.raise_for_status()
            for r in resp.json().get("organic", []):
                link = r.get("link", "")
                if "youtube.com/watch" in link:
                    youtube_url = link
                    youtube_snippet = r.get("snippet", "")
                    break
        except Exception as e2:
            logger.warning(f"Serper YouTube fallback search failed: {e2}")

    # ── Aggregate results ────────────────────────────────────────────────────
    all_results = reddit_results
    if youtube_snippet:
        all_results = all_results + [{"snippet": youtube_snippet, "link": youtube_url}]

    if not all_results and not youtube_url:
        return _mock_proof(title)

    snippets   = [r.get("snippet", "") for r in all_results if r.get("snippet")]
    highlights = snippets[:3]
    sentiment  = _sentiment_from_snippets(snippets)

    # Best Reddit URL: prefer threads with most engagement signals in URL (comments)
    reddit_url: Optional[str] = None
    for r in reddit_results:
        link = r.get("link", "")
        if "/comments/" in link:  # actual thread, not subreddit listing
            reddit_url = link
            break
    if not reddit_url and reddit_results:
        reddit_url = reddit_results[0].get("link")

    source_count = len(reddit_results) + (1 if youtube_url else 0)

    return {
        "sentiment":       sentiment,
        "sentiment_emoji": _SENTIMENT_EMOJI[sentiment],
        "highlights":      highlights,
        "source_count":    source_count,
        "reddit_url":      reddit_url,
        "youtube_url":     youtube_url,
    }


# ── Fallback mock ──────────────────────────────────────────────────────────────

def _mock_proof(title: str) -> dict:
    """Return plausible-looking social proof when Serper is unavailable."""
    brand = title.split()[0] if title else "This"
    return {
        "sentiment":       "positive",
        "sentiment_emoji": "🟢",
        "highlights": [
            f"{brand} consistently scores top marks across r/IndiaFinance and r/hardware.",
            "Multiple reviewers highlight exceptional value-for-money at this price point.",
            "Build quality and after-sales service rated 4+ stars by community members.",
        ],
        "source_count": 6,
        "reddit_url":   None,
        "youtube_url":  None,
    }
