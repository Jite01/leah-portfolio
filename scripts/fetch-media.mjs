import { Scraper } from 'twscrape';
import fs from 'fs/promises';
import path from 'path';

const COOKIES_PATH = './scripts/cookies.json';
const MEDIA_JSON = './src/data/media.json';
const LEAH_HANDLE = 'leahbluewater';
const KEYWORD = 'In Finance Today';

function todayUtcIso() {
  return new Date().toISOString().split('T')[0];
}

async function loadCookies() {
  try {
    const raw = await fs.readFile(COOKIES_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  const cookies = await loadCookies();
  if (!cookies) {
    console.error('No cookies found. Run login script first.');
    process.exit(1);
  }

  const scraper = new Scraper();
  await scraper.setCookies(cookies);

  const tweets = [];
  for await (const tweet of scraper.getUserTweets(LEAH_HANDLE, 30)) {
    tweets.push(tweet);
  }

  const today = todayUtcIso();

  const match = tweets.find(t => {
    const text = t.rawContent || t.text || '';
    if (!text.toLowerCase().includes(KEYWORD.toLowerCase())) return false;
    const tweetDate = t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : null;
    return tweetDate === today;
  });

  if (!match) {
    console.log(`No "In Finance Today" post found for ${today}.`);
    return;
  }

  const url = `https://twitter.com/${LEAH_HANDLE}/status/${match.id}`;
  const date = today;

  let rawText = match.rawContent || match.text || '';

  // Strip trailing URL (https://t.co/...)
  rawText = rawText.replace(/https?:\/\/t\.co\/[A-Za-z0-9]+\.{0,3}\s*$/i, '').trim();

  // Strip "In Finance Today⚡️" (with optional lightning bolt and variants)
  rawText = rawText.replace(/In Finance Today[⚡️⚡]?\s*$/i, '').trim();

  // Split by double newlines to get individual headlines
  const headlines = rawText.split(/\n\s*\n/).map(h => h.trim()).filter(h => h.length > 0);

  // Join with single \n for JSON
  const headline = headlines.join('\n');

  let media = {};
  try {
    const raw = await fs.readFile(MEDIA_JSON, 'utf-8');
    media = JSON.parse(raw);
  } catch {
    media = { dayInFinance: {}, highlights: {}, previousDayInFinance: {} };
  }

  if (media.dayInFinance?.url === url) {
    console.log('Already have this post. No update needed.');
    return;
  }

  if (media.dayInFinance?.url) {
    media.previousDayInFinance = { ...media.dayInFinance };
  }

  media.dayInFinance = { date, headline, url };

  await fs.mkdir(path.dirname(MEDIA_JSON), { recursive: true });
  await fs.writeFile(MEDIA_JSON, JSON.stringify(media, null, 2) + '\n');

  console.log('Updated media.json:');
  console.log(`  Date: ${date}`);
  console.log(`  Lines: ${headlines.length}`);
  headlines.forEach((h, i) => console.log(`    ${i + 1}. ${h}`));
  console.log(`  Previous: ${media.previousDayInFinance?.date || 'none'}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
