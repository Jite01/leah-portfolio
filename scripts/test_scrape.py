import asyncio
import twscrape
from twscrape import xclid

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

async def main():
    api = twscrape.API()
    user = await api.user_by_login("twitter")
    if user:
        print("✅ Working! User:", user.username, user.id)
    else:
        print("❌ Failed")

asyncio.run(main())
