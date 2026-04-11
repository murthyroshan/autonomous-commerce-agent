"""
agents/mock_data.py — hardcoded fallback products.

Used when all live API tiers fail. Never raises exceptions.
Covers the most common Indian e-commerce search categories.
"""

MOCK_PRODUCTS: dict[str, list[dict]] = {
    "laptop": [
        {
            "title": "ASUS VivoBook 15 (Ryzen 5 5500U, 16GB RAM, 512GB SSD)",
            "price": 54990.0,
            "rating": 4.3,
            "review_count": 2847,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/B09ABC001",
        },
        {
            "title": "Lenovo IdeaPad Gaming 3 (i5-12450H, 16GB, RTX 3050)",
            "price": 67990.0,
            "rating": 4.1,
            "review_count": 1923,
            "source": "Flipkart",
            "link": "https://www.flipkart.com/lenovo-ideapad-gaming",
        },
        {
            "title": "HP Victus 15 (Ryzen 5 5600H, 8GB, GTX 1650)",
            "price": 59999.0,
            "rating": 4.2,
            "review_count": 3102,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/B09ABC003",
        },
        {
            "title": "Acer Nitro 5 (i5-12500H, 8GB, RTX 3050Ti)",
            "price": 72990.0,
            "rating": 4.0,
            "review_count": 1450,
            "source": "Croma",
            "link": "https://www.croma.com/acer-nitro-5",
        },
        {
            "title": "MSI GF63 Thin (i7-12650H, 16GB, RTX 4050)",
            "price": 79990.0,
            "rating": 4.4,
            "review_count": 890,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/B09ABC005",
        },
    ],
    "phone": [
        {
            "title": "Samsung Galaxy M34 5G (8GB/128GB, Exynos 1280)",
            "price": 16999.0,
            "rating": 4.2,
            "review_count": 12450,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/B0C001",
        },
        {
            "title": "Redmi Note 13 Pro 5G (8GB/256GB, Snapdragon 7s Gen 2)",
            "price": 24999.0,
            "rating": 4.3,
            "review_count": 8920,
            "source": "Flipkart",
            "link": "https://www.flipkart.com/redmi-note-13-pro",
        },
        {
            "title": "OnePlus Nord CE 3 Lite (8GB/128GB, Snapdragon 695)",
            "price": 19999.0,
            "rating": 4.1,
            "review_count": 5340,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/B0C003",
        },
        {
            "title": "iQOO Z9 5G (12GB/256GB, Dimensity 7200)",
            "price": 22999.0,
            "rating": 4.4,
            "review_count": 3780,
            "source": "Flipkart",
            "link": "https://www.flipkart.com/iqoo-z9",
        },
        {
            "title": "Realme Narzo 60 Pro (8GB/128GB, Dimensity 6080)",
            "price": 17999.0,
            "rating": 4.0,
            "review_count": 2100,
            "source": "Flipkart",
            "link": "https://www.flipkart.com/realme-narzo-60-pro",
        },
    ],
    "tv": [
        {
            "title": "Samsung 43-inch 4K Smart TV (Crystal UHD, Tizen OS)",
            "price": 34990.0,
            "rating": 4.3,
            "review_count": 5620,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/TV001",
        },
        {
            "title": "LG 43-inch 4K NanoCell TV (a5 Gen6 Processor)",
            "price": 42990.0,
            "rating": 4.4,
            "review_count": 2340,
            "source": "Croma",
            "link": "https://www.croma.com/lg-nanocell",
        },
        {
            "title": "Sony Bravia 43 X74L 4K Google TV",
            "price": 52990.0,
            "rating": 4.5,
            "review_count": 1890,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/TV003",
        },
        {
            "title": "MI TV 5X 43-inch 4K QLED (PatchWall, Android TV)",
            "price": 29999.0,
            "rating": 4.1,
            "review_count": 7230,
            "source": "Flipkart",
            "link": "https://www.flipkart.com/mi-tv-5x",
        },
        {
            "title": "Hisense 43A6H 4K UHD Smart TV (VIDAA OS)",
            "price": 27990.0,
            "rating": 4.0,
            "review_count": 1120,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/TV005",
        },
    ],
    "headphones": [
        {
            "title": "Sony WH-1000XM4 Wireless Noise Cancelling Headphones",
            "price": 24990.0,
            "rating": 4.6,
            "review_count": 18920,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/HP001",
        },
        {
            "title": "Boat Rockerz 450 Bluetooth On-Ear Headphones",
            "price": 1499.0,
            "rating": 4.0,
            "review_count": 45200,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/HP002",
        },
        {
            "title": "JBL Tune 770NC Wireless Noise Cancelling Headphones",
            "price": 6999.0,
            "rating": 4.2,
            "review_count": 3450,
            "source": "Flipkart",
            "link": "https://www.flipkart.com/jbl-tune-770nc",
        },
        {
            "title": "Jabra Evolve2 55 Business Wireless Headset",
            "price": 18999.0,
            "rating": 4.4,
            "review_count": 780,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/HP004",
        },
        {
            "title": "Bose QuietComfort 45 Wireless Noise Cancelling Headphones",
            "price": 29900.0,
            "rating": 4.5,
            "review_count": 4120,
            "source": "Amazon",
            "link": "https://www.amazon.in/dp/HP005",
        },
    ],
    "default": [
        {
            "title": "Sample Product A",
            "price": 5999.0,
            "rating": 4.2,
            "review_count": 1200,
            "source": "Amazon",
            "link": "#",
        },
        {
            "title": "Sample Product B",
            "price": 7499.0,
            "rating": 4.0,
            "review_count": 800,
            "source": "Flipkart",
            "link": "#",
        },
        {
            "title": "Sample Product C",
            "price": 4499.0,
            "rating": 4.4,
            "review_count": 2100,
            "source": "Amazon",
            "link": "#",
        },
    ],
}


def get_mock_products(query: str) -> list[dict]:
    """Return mock products for the best-matching category."""
    q = query.lower()
    for category in MOCK_PRODUCTS:
        if category in q:
            return MOCK_PRODUCTS[category]
    return MOCK_PRODUCTS["default"]
