#!/usr/bin/env python3
"""
fetch-kickoff.py
────────────────
Scrape Leah Bluewater's X profile for a live/scheduled Space URL.
Schedule: 11:02, 11:05, 11:10 WAT  (cron: 2,5,10 10 * * * UTC)
Exits early if kickoffs.json already has a URL for today.
"""

import asyncio
import json
import os
import re
import sys
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
DATA_PATH = os.path.join(ROOT, "src", "data", "kickoffs.json")
COOKIES_PATH = os.path.join(ROOT, "cookies.json")
LEAH_USERNAME = "leahbluewater"


def load_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def already_has_url():
    data = load_data()
    return data["nextKickoff"].get("url") is not None


async def find_space_url():
    pool = twscrape.AccountsPool()

    try:
        await pool.delete_accounts(["user1"])
    except Exception:
        pass

    with open(COOKIES_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    needed = {"auth_token", "ct0"}
    cookies_str = "; ".join(
        f"{item['name']}={item['value']}" for item in raw if item["name"] in needed
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

    # Resolve Leah's user ID
    user = await api.user_by_login(LEAH_USERNAME)
    if not user:
        print(f"User @{LEAH_USERNAME} not found")
        return None

    # Scan recent tweets for Space URLs
    async for tweet in api.user_tweets(user.id, limit=30):
        urls = []

        # Entities URLs
        if tweet.urls:
            urls.extend(tweet.urls)

        # Card URL (Spaces often appear as cards)
        card_url = getattr(tweet.card, "url", None) if tweet.card else None
        if card_url:
            urls.append(card_url)

        # Raw content regex fallback
        if tweet.rawContent:
            m = re.search(r'https?://(?:twitter|x)\.com/i/spaces/([a-zA-Z0-9]+)', tweet.rawContent)
            if m:
                urls.append(f"https://twitter.com/i/spaces/{m.group(1)}")

        for url in urls:
            if "twitter.com/i/spaces/" in url or "x.com/i/spaces/" in url:
                return url

    return None


async def main():
    if already_has_url():
        print("URL already captured. Exiting.")
        return

    space_url = await find_space_url()
    if not space_url:
        print("No Space URL found this run.")
        return

    data = load_data()
    data["nextKickoff"]["url"] = space_url
    data["nextKickoff"]["startedAt"] = datetime.now(timezone.utc).isoformat()
    save_data(data)
    print(f"Captured Space URL: {space_url}")


if __name__ == "__main__":
    asyncio.run(main())
