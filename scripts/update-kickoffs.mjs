#!/usr/bin/env node
/**
 * update-kickoffs.mjs
 * ───────────────────
 * Run after The Kickoff ends (suggest 12:15 WAT → cron: 15 11 * * * UTC).
 * 1. Archives the completed kickoff (max 3 entries).
 * 2. Generates summary placeholder (swap in lurky.ai call when key arrives).
 * 3. Advances nextKickoff to the following day, clears URL.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'kickoffs.json');

/* ── helpers ─────────────────────────────────────────────────────────────── */

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function formatDayLabel(dateObj) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[dateObj.getDay()]}, ${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T11:00:00+01:00'); // anchor to 11:00 WAT
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function calcDuration(startedAtIso) {
  if (!startedAtIso) return '~50m';
  const started = new Date(startedAtIso);
  const ended   = new Date();
  const diffMin = Math.round((ended - started) / 60000);
  if (diffMin < 1)  return '<1m';
  if (diffMin < 60) return `${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* ── lurky.ai placeholder ────────────────────────────────────────────────── */
async function generateSummary(/* spaceUrl */) {
  // TODO: replace with lurky.ai API call when your friend sends the key.
  // const res = await fetch('https://api.lurky.ai/v1/summarize', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': 'Bearer YOUR_API_KEY',
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ url: spaceUrl }),
  // });
  // const { summary } = await res.json();
  // return summary;

  return 'AI episode summary coming soon…';
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function main() {
  const data = loadData();

  // Nothing to archive — just advance date if we're past it
  if (!data.nextKickoff.url) {
    const nextDate = new Date(data.nextKickoff.date + 'T11:00:00+01:00');
    const nowWat   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));

    if (nowWat > nextDate) {
      const tomorrowStr = addDays(data.nextKickoff.date, 1);
      data.nextKickoff.date     = tomorrowStr;
      data.nextKickoff.dayLabel = formatDayLabel(new Date(tomorrowStr + 'T11:00:00+01:00'));
      data.nextKickoff.startedAt = null;
      saveData(data);
      console.log('No URL found today — advanced to', tomorrowStr);
    } else {
      console.log('No URL and date still in future — nothing to do.');
    }
    return;
  }

  // ── Archive today's kickoff ──
  const nk = data.nextKickoff;
  const summary = await generateSummary(nk.url);
  const duration = calcDuration(nk.startedAt);

  data.archive.unshift({
    date: nk.date,
    title: 'The Kickoff',          // override if you scrape the real title later
    duration,
    summary,
    url: nk.url,
  });

  // enforce 3-entry ceiling
  if (data.archive.length > 3) {
    data.archive = data.archive.slice(0, 3);
  }

  // ── Advance to next day ──
  const nextDateStr = addDays(nk.date, 1);
  const nextDateObj = new Date(nextDateStr + 'T11:00:00+01:00');

  data.nextKickoff = {
    date: nextDateStr,
    dayLabel: formatDayLabel(nextDateObj),
    utc: '10:00 AM UTC',
    est: '5:00 AM EST',
    cst: '4:00 AM CST',
    url: null,
    startedAt: null,
  };

  saveData(data);
  console.log('Archived', nk.date, '— next kickoff:', nextDateStr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
