import asyncio
from playwright.async_api import async_playwright

async def take_screenshots():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        # 1. Search for MacBook M3
        print("Taking MacBook M3 screenshot...")
        await page.goto('http://localhost:3000/')
        await page.wait_for_timeout(2000)
        
        # We need to fill the search and press enter.
        try:
            await page.fill('input[type="text"]', 'MacBook M3')
            await page.keyboard.press('Enter')
            await page.wait_for_timeout(15000) # Wait for agent to finish and stream
            await page.screenshot(path='docs/screenshots/search-results.png')
        except Exception as e:
            print(f"Error in MacBook search: {e}")
            await page.screenshot(path='docs/screenshots/search-results.png')
        
        # 2. x402 payment flow
        print("Taking x402 payment flow screenshot...")
        try:
            # Assuming there's a pay button
            await page.click('text="Pay"')
            await page.wait_for_timeout(3000) # Wait for WalletConnect dialog
            await page.screenshot(path='docs/screenshots/x402-payment.png')
        except Exception as e:
            print(f"Error in x402 payment: {e}")
            await page.screenshot(path='docs/screenshots/x402-payment.png')

        # 3. Algorand confirmation
        print("Taking Algorand confirmation screenshot...")
        try:
            # Click something to simulate confirmation? It's hard to simulate signing via script
            # Let's try navigating to a mock history or confirmation page
            await page.goto('http://localhost:3000/history')
            await page.wait_for_timeout(3000)
            await page.screenshot(path='docs/screenshots/algorand-confirm.png')
        except Exception as e:
            print(f"Error in Algorand confirmation: {e}")
            await page.screenshot(path='docs/screenshots/algorand-confirm.png')

        # 4. VS Battle Arena
        print("Taking VS Battle Arena screenshot...")
        try:
            await page.goto('http://localhost:3000/')
            await page.wait_for_timeout(2000)
            await page.fill('input[type="text"]', 'OnePlus 13 vs Samsung S25')
            await page.keyboard.press('Enter')
            await page.wait_for_timeout(15000)
            await page.screenshot(path='docs/screenshots/battle-arena.png')
        except Exception as e:
            print(f"Error in VS Battle: {e}")
            await page.screenshot(path='docs/screenshots/battle-arena.png')

        await browser.close()

asyncio.run(take_screenshots())
