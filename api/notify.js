import webpush from 'web-push';

const GIST_ID   = process.env.GITHUB_GIST_ID;
const GH_TOKEN  = process.env.GITHUB_TOKEN;
const GIST_FILE = 'push-subs.json';
const NOTIFY_SECRET = process.env.NOTIFY_SECRET; // simple shared secret to protect this endpoint

webpush.setVapidDetails(
  'mailto:jamesoyibode968@gmail.com,      
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

async function readSubs() {
  const res  = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  const data = await res.json();
  const raw  = data.files?.[GIST_FILE]?.content ?? '{}';
  return Object.values(JSON.parse(raw));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Guard: only allow calls from your GitHub workflow
  if (req.headers['x-notify-secret'] !== NOTIFY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { title = 'The Kickoff is live', body = 'Join the Space now', url } = req.body;

  const subs   = await readSubs();
  const payload = JSON.stringify({ title, body, url });

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub, payload))
  );

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  res.status(200).json({ sent, failed });
}
