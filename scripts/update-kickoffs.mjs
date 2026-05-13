#!/usr/bin/env node
/**
 * update-kickoffs.mjs
 * ───────────────────
 * Run after The Kickoff ends (10:15 UTC / 11:15 WAT).
 * 1. Archives the completed kickoff (max 3 entries).
 * 2. Generates a template summary from metadata.
 * 3. Advances nextKickoff to the following day, clears URL.
 *    ── Skips Sunday: no Kickoff on Sundays.
 *    ── Guards against double-advance via lastAdvancedAt.
 *    ── Duration is fixed at ~50m (startedAt is unreliable due to cron drift).
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

function getNextKickoffDate(dateStr) {
  const d = new Date(dateStr + 'T11:00:00+01:00');
  d.setDate(d.getDate() + 1);

  // Skip Sunday (0) — no Kickoff on Sundays
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
  }

  return d.toISOString().split('T')[0];
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

/* ── template summary generator ───────────────────────────────────────────── */
function generateSummary(dateStr, duration) {
  const d = new Date(dateStr + 'T11:00:00+01:00');
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayName = days[d.getDay()];

  const templates = [
    `Leah hosted The Kickoff on ${dayName}, covering the day's crypto market moves and on-chain narratives in a ${duration} session.`,
    `A ${duration} live session on ${dayName} — macro trends, altcoin rotations, and community Q&A with Leah.`,
    `The Kickoff for ${dayName}: ${duration} of market commentary, ETF flows, and Doginal Dogs community updates.`,
    `Leah broke down the crypto week so far on ${dayName} — ${duration} of charts, sentiment, and space culture.`,
    `${dayName}'s session ran ${duration}. Leah covered Bitcoin dominance, altseason signals, and Nigeria crypto adoption updates.`,
  ];

  const idx = d.getDate() % templates.length;
  return templates[idx];
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function main() {
  const data = loadData();
  const today = todayIso();

  // Guard: already advanced today
  if (data.lastAdvancedAt === today) {
    console.log('Already advanced today (' + today + '). Skipping.');
    return;
  }

  // ── No URL captured — just advance date if we're past it ──
  if (!data.nextKickoff.url) {
    const nextDate = new Date(data.nextKickoff.date + 'T11:00:00+01:00');
    const nowWat   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));

    if (nowWat > nextDate) {
      const tomorrowStr = getNextKickoffDate(data.nextKickoff.date);
      data.nextKickoff.date     = tomorrowStr;
      data.nextKickoff.dayLabel = formatDayLabel(new Date(tomorrowStr + 'T11:00:00+01:00'));
      data.nextKickoff.startedAt = null;
      data.lastAdvancedAt = today;
      saveData(data);
      console.log('No URL found today — advanced to', tomorrowStr);
    } else {
      console.log('No URL and date still in future — nothing to do.');
    }
    return;
  }

  // ── Archive today's kickoff ──
  const nk = data.nextKickoff;
  // Fixed ~50m duration — startedAt is unreliable due to cron drift
  const duration = '~50m';
  const summary = generateSummary(nk.date, duration);

  data.archive.unshift({
    date: nk.date,
    title: 'The Kickoff',
    duration,
    summary,
    url: nk.url,
  });

  // enforce 3-entry ceiling
  if (data.archive.length > 3) {
    data.archive = data.archive.slice(0, 3);
  }

  // ── Advance to next day (skipping Sunday) ──
  const nextDateStr = getNextKickoffDate(nk.date);
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

  data.lastAdvancedAt = today;
  saveData(data);
  console.log('Archived', nk.date, '— next kickoff:', nextDateStr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
