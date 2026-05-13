#!/usr/bin/env python3
"""
fetch-kickoff.py
────────────────
Scrape Leah Bluewater's X profile for a live/scheduled Space URL.
Uses the link-only heuristic: Leah's Space tweets are her own tweets
(not RTs) where rawContent contains ONLY a t.co shortlink.
Only accepts tweets from TODAY (WAT timezone).
Clears stale URLs from previous days before fetching.
Schedule: 11:02, 11:05, 11:10 WAT  (cron: 2,5,10 10 * * * UTC)
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
DATA_PATH = os.path.join(ROOT, "src", "data", "kickoffs.json")
COOKIES_PATH = os.path.join(ROOT, "cookies.json")
LEAH_USERNAME = "leahbluewater"


def load_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def today_wat_iso():
    """Return today's date as YYYY-MM-DD in WAT timezone."""
    wat_now = datetime.now(timezone.utc).astimezone(
        __import__('zoneinfo').ZoneInfo('Africa/Lagos')
    )
    return wat_now.strftime('%Y-%m-%d')


def clear_stale_url(data):
    """Clear url and startedAt if they are from a previous day."""
    started_at = data["nextKickoff"].get("startedAt")
    if not started_at:
        return False

    started_date = started_at[:10]  # YYYY-MM-DD
    if started_date != today_wat_iso():
        print(f"Stale URL from {started_date} cleared. Re-fetching...")
        data["nextKickoff"]["url"] = None
        data["nextKickoff"]["startedAt"] = None
        save_data(data)
        return True
    return False


def already_has_url():
    data = load_data()
    if data["nextKickoff"].get("url") is None:
        return False
    # Check if existing URL is stale (from previous day)
    if clear_stale_url(data):
        return False
    print("URL already captured today. Exiting.")
    return True


def is_link_only_today(tweet) -> str | None:
    """
    Returns the Space URL if this tweet matches Leah's Space signature:
      1. Her own tweet (URL contains /leahbluewater/status/)
      2. Not a retweet (no 'RT @' in rawContent)
      3. rawContent is ONLY a t.co shortlink (nothing else)
      4. Tweet was posted TODAY (WAT timezone)
    Returns the t.co shortlink string, or None.
    """
    # Must be her own tweet, not a retweet by someone else
    if not tweet.url or "/leahbluewater/status/" not in tweet.url:
        return None

    # Skip retweets / quote tweets with RT prefix
    raw = (tweet.rawContent or "").strip()
    if raw.startswith("RT @") or raw.startswith("rt @" ):
        return None

    # Must be ONLY a t.co shortlink, nothing else
    if not re.fullmatch(r"https?://t\.co/[A-Za-z0-9]+\s*", raw):
        return None

    # Must be from TODAY
    tweet_date = tweet.date.strftime('%Y-%m-%d') if hasattr(tweet, 'date') else None
    if tweet_date != today_wat_iso():
        return None

    # Extract the clean URL
    m = re.search(r"https?://t\.co/[A-Za-z0-9]+", raw)
    if m:
        return m.group(0)

    return None


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

    # Scan recent tweets for link-only Space tweets from TODAY
    async for tweet in api.user_tweets(user.id, limit=30):
        space_url = is_link_only_today(tweet)
        if space_url:
            return space_url

    return None


async def main():
    if already_has_url():
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
