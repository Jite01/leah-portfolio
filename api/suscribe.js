import fs from 'fs/promises';
import path from 'path';

const SUBS_PATH = path.join(process.cwd(), 'src', 'data', 'push-subs.json');

async function loadSubs() {
  try {
    const raw = await fs.readFile(SUBS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveSubs(subs) {
  await fs.mkdir(path.dirname(SUBS_PATH), { recursive: true });
  await fs.writeFile(SUBS_PATH, JSON.stringify(subs, null, 2) + '\n');
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const sub = req.body;
    if (!sub || !sub.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    const subs = await loadSubs();
    const key = Buffer.from(sub.endpoint).toString('base64').slice(0, 32);
    subs[key] = sub;
    await saveSubs(subs);

    return res.status(201).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' });
    }

    const subs = await loadSubs();
    const key = Buffer.from(endpoint).toString('base64').slice(0, 32);
    delete subs[key];
    await saveSubs(subs);

    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
