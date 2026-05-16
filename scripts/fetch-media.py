#!/usr/bin/env python3
"""
fetch-media.py
──────────────
Scrape Leah Bluewater's X profile for "In Finance Today" posts.
Uses twscrape (Python) with cookie auth.
Only accepts tweets from TODAY (UTC).
Archives previous day's entry to previousDayInFinance.
"""

import asyncio
import json
import os
import re
from datetime import datetime, timezone

import twscrape
from twscrape import xclid

# ── Monkey patch for twscrape issue #298 ───────────────────────────────────
def _rextr(s, begin, end, pos):
    end_idx = s.rfind(end, 0, pos)
    if end_idx < 0:
        return None
    begin_idx = s.rfind(begin, 0, end_idx)
    if begin_idx < 0:
        return None
    return s[begin_idx + len(begin) : end_idx]

def _fextr(s, begin, end, pos=0):
    start = s.find(begin, pos)
    if start < 0:
        return None
    start += len(begin)
    stop = s.find(end, start)
    if stop < 0:
        return None
    return s[start:stop]

async def _patched_parse_anim_idx(text: str) -> list[int]:
    ondemand_pos = text.find('"ondemand.s"')
    if ondemand_pos >= 0:
        ondemand_key = _rextr(text, ",", ":", ondemand_pos)
        if ondemand_key:
            ondemand_s = _fextr(text, ondemand_key + ':"', '"', ondemand_pos)
            if ondemand_s:
                url = xclid.script_url("ondemand.s", f"{ondemand_s}a")
                js_text = await xclid.get_tw_page_text(url)
                items = [int(x.group(2)) for x in xclid.INDICES_REGEX.finditer(js_text)]
                if items:
                    return items
    scripts = list(xclid.get_scripts_list(text))
    scripts = [u for u in scripts if "/ondemand.s." in u]
    if not scripts:
        raise Exception("Couldn't get XClientTxId scripts")
    js_text = await xclid.get_tw_page_text(scripts[0])
    items = [int(x.group(2)) for x in xclid.INDICES_REGEX.finditer(js_text)]
    if not items:
        raise Exception("Couldn't get XClientTxId indices")
    return items

xclid.parse_anim_idx = _patched_parse_anim_idx
# ── End patch ──────────────────────────────────────────────────────────────

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COOKIES_PATH = os.path.join(ROOT, "cookies.json")
MEDIA_JSON = os.path.join(ROOT, "src", "data", "media.json")
LEAH_HANDLE = "leahbluewater"
KEYWORD = "In Finance Today"


def today_utc_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def load_cookies():
    with open(COOKIES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_media():
    try:
        with open(MEDIA_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"dayInFinance": {}, "highlights": {}, "previousDayInFinance": {}}


def save_media(data):
    os.makedirs(os.path.dirname(MEDIA_JSON), exist_ok=True)
    with open(MEDIA_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


async def find_finance_tweet():
    pool = twscrape.AccountsPool()

    try:
        await pool.delete_accounts(["user1"])
    except Exception:
        pass

    cookies = load_cookies()
    needed = {"auth_token", "ct0"}
    cookies_str = "; ".join(
        f"{item['name']}={item['value']}" for item in cookies if item["name"] in needed
    )

    await pool.add_account(
        username="user1",
        password="placeholder",
        email="placeholder@placeholder.com",
        email_password="placeholder",
        cookies=cookies_str,
    )

    await pool.login_all()
    api = twscrape.API(pool)

    user = await api.user_by_login(LEAH_HANDLE)
    if not user:
        print(f"User @{LEAH_HANDLE} not found")
        return None

    today = today_utc_iso()

    async for tweet in api.user_tweets(user.id, limit=30):
        text = (tweet.rawContent or "").strip()
        if KEYWORD.lower() not in text.lower():
            continue

        tweet_date = tweet.date.strftime("%Y-%m-%d") if hasattr(tweet, "date") else None
        if tweet_date != today:
            continue

        return tweet

    return None


def process_headlines(text):
    # Strip trailing t.co URL
    text = re.sub(r"https?://t\.co/[A-Za-z0-9]+\s*$", "", text).strip()
    # Strip "In Finance Today" with optional emoji
    text = re.sub(r"In Finance Today[⚡️⚡]?\s*$", "", text, flags=re.IGNORECASE).strip()
    # Split by double newlines
    headlines = [h.strip() for h in text.split("\n\n") if h.strip()]
    return "\n".join(headlines), headlines


async def main():
    tweet = await find_finance_tweet()
    if not tweet:
        print(f'No "In Finance Today" post found for {today_utc_iso()}.')
        return

    url = f"https://twitter.com/{LEAH_HANDLE}/status/{tweet.id}"
    date = today_utc_iso()

    raw_text = tweet.rawContent or ""
    headline, headlines = process_headlines(raw_text)

    media = load_media()

    if media.get("dayInFinance", {}).get("url") == url:
        print("Already have this post. No update needed.")
        return

    # Archive current to previous
    if media.get("dayInFinance", {}).get("url"):
        media["previousDayInFinance"] = dict(media["dayInFinance"])

    media["dayInFinance"] = {"date": date, "headline": headline, "url": url}
    save_media(media)

    print("Updated media.json:")
    print(f"  Date: {date}")
    print(f"  Lines: {len(headlines)}")
    for i, h in enumerate(headlines, 1):
        print(f"    {i}. {h}")
    prev = media.get("previousDayInFinance", {}).get("date", "none")
    print(f"  Previous: {prev}")


if __name__ == "__main__":
    asyncio.run(main())
