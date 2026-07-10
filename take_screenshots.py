"""
take_screenshots.py — capture README screenshots from the running app.

Prereqs: frontend on http://localhost:3000, backend on :8000.
Run:      python take_screenshots.py

Captures four images into docs/screenshots/:
  home.png            — landing hero
  search-results.png  — the winner recommendation card
  battle-arena.png     — head-to-head VS verdict
  history.png         — on-chain purchase log
"""

import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
OUT = "docs/screenshots"


async def start_search(page, query: str, handle_clarify: bool) -> None:
    """Type a query on the home page and kick off a search."""
    await page.goto(BASE, wait_until="networkidle")
    await page.wait_for_timeout(2500)
    inp = page.locator('input[type="text"]').first
    await inp.fill(query)
    await inp.press("Enter")

    if handle_clarify:
        # A vague query may ask clarifying questions first; the "Execute Search"
        # button appears once all questions are revealed.
        try:
            await page.wait_for_selector("text=Execute Search", timeout=12000)
            await page.get_by_text("Execute Search").first.click()
        except Exception:
            pass  # query skipped clarification — already searching


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,  # crisp retina-quality output
        )
        page = await ctx.new_page()

        print("1/4  home hero…")
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(4500)
        await page.screenshot(path=f"{OUT}/home.png")

        # The result views stream in below the fold; a taller frame fits the
        # full winner card / battle arena, and positioning by bounding box keeps
        # the component clear of the fixed navbar without clipping card edges.
        await page.set_viewport_size({"width": 1440, "height": 1400})

        print("2/4  search results…")
        await start_search(page, "gaming laptop under 80000", handle_clarify=True)
        # Wait for the recommendation to fully resolve — "AI Reasoning" only
        # renders on the winner card once the decision agent finishes.
        await page.wait_for_selector("text=AI Reasoning", timeout=60000)
        await page.wait_for_timeout(2500)  # let entrance animations settle
        winner = page.locator("div.mb-6").filter(has_text="AI Reasoning").first
        await winner.scroll_into_view_if_needed()
        box = await winner.bounding_box()
        await page.evaluate(f"window.scrollBy(0, {box['y'] - 150})")
        await page.wait_for_timeout(600)
        await page.screenshot(path=f"{OUT}/search-results.png")

        print("3/4  battle arena…")
        await start_search(page, "OnePlus 13 vs Samsung S25", handle_clarify=False)
        # The referee's verdict types out via a typewriter effect; a blinking
        # cursor span exists only while typing, so wait for it to appear and
        # then detach — that marks the verdict fully rendered.
        cursor = "span.animate-pulse.bg-violet-400"
        try:
            await page.wait_for_selector(cursor, timeout=60000)
            await page.wait_for_selector(cursor, state="detached", timeout=30000)
        except Exception as e:
            print(f"  (verdict wait: {e})")
        await page.wait_for_timeout(1500)
        arena = page.locator("div.rounded-3xl.mb-10").filter(has_text="Battle Arena").first
        await arena.scroll_into_view_if_needed()
        box = await arena.bounding_box()
        await page.evaluate(f"window.scrollBy(0, {box['y'] - 120})")
        await page.wait_for_timeout(600)
        await page.screenshot(path=f"{OUT}/battle-arena.png")

        await page.set_viewport_size({"width": 1440, "height": 900})

        print("4/4  purchase history…")
        await page.goto(f"{BASE}/history", wait_until="networkidle")
        await page.wait_for_timeout(4500)
        await page.screenshot(path=f"{OUT}/history.png")

        await browser.close()
        print("done ->", OUT)


asyncio.run(main())
