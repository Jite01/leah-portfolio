import webpush from 'web-push';
import fs from 'fs/promises';
import path from 'path';

const SUBS_PATH = path.join(process.cwd(), 'src', 'data', 'push-subs.json');

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  'mailto:leahbluewater@example.com',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

async function loadSubs() {
  try {
    const raw = await fs.readFile(SUBS_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    return Object.values(obj);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, title, body } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing URL' });
  }

  const subs = await loadSubs();

  if (subs.length === 0) {
    return res.status(200).json({ sent: 0, message: 'No subscribers' });
  }

  const payload = JSON.stringify({
    title: title || 'The Kickoff is live',
    body: body || 'Join the Space now',
    url
  });

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub, payload))
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  results.forEach((result, i) => {
    if (result.status === 'rejected' && result.reason?.statusCode === 410) {
      // Expired subscription — would need to remove from JSON
      // But we can't write to repo from serverless function easily
      // Leave for now, or add a cleanup endpoint
    }
  });

  return res.status(200).json({ sent, failed, total: subs.length });
}
