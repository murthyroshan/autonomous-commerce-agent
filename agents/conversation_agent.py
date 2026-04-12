"""
agents/conversation_agent.py — Conversational flow logic.
Uses Groq to decide if a query needs clarification, generate questions,
and enrich the original query with answers.
"""

import json
import logging
import os
import re

from groq import Groq

logger = logging.getLogger(__name__)

# Cache for the groq client so we don't recreate it every time
_groq_client = None


def _get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        _groq_client = Groq(api_key=api_key)
    return _groq_client


def needs_clarification(query: str) -> bool:
    """
    Returns True if query missing category, budget, or brand info.
    Returns False in mock mode or on API error (fail open).
    """
    if os.getenv("MOCK_ONLY", "false").lower() == "true":
        return False

    try:
        client = _get_groq_client()
        prompt = (
            f"Does this shopping query have enough information to "
            f"search for specific products? Query: '{query}'\n"
            f"Answer with only YES or NO."
        )

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=10,
        )

        ans = response.choices[0].message.content.strip().upper()
        if "NO" in ans:
            return True
        return False

    except Exception as e:
        logger.warning(f"needs_clarification error: {e}")
        return False


def get_clarifying_questions(query: str) -> list[str]:
    """
    Generate 1-3 targeted clarifying questions based on a vague query.
    Return as list of strings.
    """
    if os.getenv("MOCK_ONLY", "false").lower() == "true":
        return []

    try:
        client = _get_groq_client()
        prompt = (
            f"The user wants to buy something but their query is vague: "
            f"'{query}'. Generate 1-3 short clarifying questions to understand "
            f"their budget, use case, or preferences. Return as a JSON array "
            f"of question strings only."
        )

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=150,
        )

        content = response.choices[0].message.content.strip()
        # Some LLMs return markdown fenced blocks like ```json ... ```
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content).strip()

        data = json.loads(content)
        
        if isinstance(data, list):
            return [str(q) for q in data][:3]
        elif isinstance(data, dict):
            for val in data.values():
                if isinstance(val, list):
                    return [str(q) for q in val][:3]
        return []

    except Exception as e:
        logger.warning(f"get_clarifying_questions error: {e}")
        return []


def build_enriched_query(original: str, answers: dict) -> str:
    """
    Combine original query and answers into an enriched query.
    """
    if os.getenv("MOCK_ONLY", "false").lower() == "true":
        return original

    if not answers:
        return original

    try:
        client = _get_groq_client()
        prompt = (
            f"Original query: '{original}'\n"
            f"User answered these questions: {answers}\n"
            f"Write a single refined search query that captures all this "
            f"information. Return only the query string, nothing else."
        )

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=100,
        )

        query_str = response.choices[0].message.content.strip()
        # Remove quotes if the LLM added them
        query_str = re.sub(r'^["\']|["\']$', '', query_str)
        return query_str or original

    except Exception as e:
        logger.warning(f"build_enriched_query error: {e}")
        return original
