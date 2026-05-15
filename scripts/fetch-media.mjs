import { Scraper } from 'twscrape';
import fs from 'fs/promises';
import path from 'path';

const COOKIES_PATH = './scripts/cookies.json';
const MEDIA_JSON = './src/data/media.json';
const LEAH_HANDLE = 'leahbluewater';
const KEYWORD = 'In Finance Today';

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

  // Fetch Leah's recent tweets
  const tweets = [];
  for await (const tweet of scraper.getUserTweets(LEAH_HANDLE, 20)) {
    tweets.push(tweet);
  }

  // Find first tweet containing "In Finance Today"
  const match = tweets.find(t => {
    const text = t.rawContent || t.text || '';
    return text.toLowerCase().includes(KEYWORD.toLowerCase());
  });

  if (!match) {
    console.log('No "In Finance Today" post found.');
    return;
  }

  // Extract data
  const url = `https://twitter.com/${LEAH_HANDLE}/status/${match.id}`;
  const date = new Date(match.createdAt || Date.now()).toISOString().split('T')[0];
  const headline = (match.rawContent || match.text || '')
    .replace(/In Finance Today/gi, '')
    .trim()
    .substring(0, 120);

  // Read current media.json
  let media = {};
  try {
    const raw = await fs.readFile(MEDIA_JSON, 'utf-8');
    media = JSON.parse(raw);
  } catch {
    media = { dayInFinance: {}, highlights: {}, previousDayInFinance: {} };
  }

  // Only update if this is a new post (different URL)
  if (media.dayInFinance?.url === url) {
    console.log('Already have this post. No update needed.');
    return;
  }

  // Archive current → previous
  if (media.dayInFinance?.url) {
    media.previousDayInFinance = { ...media.dayInFinance };
  }

  // Write new
  media.dayInFinance = { date, headline, url };

  await fs.mkdir(path.dirname(MEDIA_JSON), { recursive: true });
  await fs.writeFile(MEDIA_JSON, JSON.stringify(media, null, 2) + '\n');

  console.log('Updated media.json:');
  console.log(`  Latest: ${date} — ${headline}`);
  console.log(`  Previous: ${media.previousDayInFinance?.date || 'none'}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
