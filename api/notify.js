import webpush from 'web-push';
import { kv } from '@vercel/kv';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  'mailto:leahbluewater@example.com',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, title, body } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing URL' });
  }

  // Get all subscriptions from KV
  const keys = await kv.keys('sub:*');
  const subs = [];
  for (const key of keys) {
    const val = await kv.get(key);
    if (val) subs.push(JSON.parse(val));
  }

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

  // Clean up invalid subscriptions
  results.forEach((result, i) => {
    if (result.status === 'rejected' && result.reason?.statusCode === 410) {
      const key = `sub:${Buffer.from(subs[i].endpoint).toString('base64').slice(0, 32)}`;
      kv.del(key);
    }
  });

  return res.status(200).json({ sent, failed, total: subs.length });
}
