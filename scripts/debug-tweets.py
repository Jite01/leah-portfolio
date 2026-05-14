#!/usr/bin/env python3
import asyncio
import json
import os
import twscrape
from twscrape import xclid

# ── Monkey patch ──
def _rextr(s, begin, end, pos):
    end_idx = s.rfind(end, 0, pos)
    if end_idx < 0: return None
    begin_idx = s.rfind(begin, 0, end_idx)
    if begin_idx < 0: return None
    return s[begin_idx + len(begin):end_idx]

def _fextr(s, begin, end, pos=0):
    start = s.find(begin, pos)
    if start < 0: return None
    start += len(begin)
    stop = s.find(end, start)
    if stop < 0: return None
    return s[start:stop]

async def _patched_parse_anim_idx(text: str) -> list[int]:
    ondemand_pos = text.find('"ondemand.s"')
    if ondemand_pos >= 0:
        ondemand_key = _rextr(text, ",", ':', ondemand_pos)
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
# ── End patch ──

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COOKIES_PATH = os.path.join(ROOT, "cookies.json")
LEAH_USERNAME = "leahbluewater"

async def main():
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
        username="user1", password="placeholder",
        email="placeholder@placeholder.com", email_password="placeholder",
        cookies=cookies_str,
    )
    await pool.login_all()
    api = twscrape.API(pool)

    user = await api.user_by_login(LEAH_USERNAME)
    if not user:
        print("User not found")
        return

    print(f"Found user: {user.displayname} (@{user.username}) | id={user.id}\n")
    print("Recent tweets:\n")

    count = 0
    async for tweet in api.user_tweets(user.id, limit=20):
        count += 1
        print(f"--- Tweet {count} ---")
        print(f"id:        {tweet.id}")
        print(f"url:       {tweet.url}")
        print(f"date:      {tweet.date}")
        print(f"rawContent: {tweet.rawContent[:200] if tweet.rawContent else 'None'}...")
        print(f"replyCount: {getattr(tweet, 'replyCount', 'N/A')}")
        print(f"retweetCount: {getattr(tweet, 'retweetCount', 'N/A')}")
        print(f"likeCount: {getattr(tweet, 'likeCount', 'N/A')}")
        print(f"entities:  {getattr(tweet, 'entities', 'N/A')}")
        print()

    print(f"\nTotal tweets scanned: {count}")

asyncio.run(main())
