import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const sub = req.body;
    if (!sub || !sub.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    // Store subscription keyed by endpoint hash
    const key = `sub:${Buffer.from(sub.endpoint).toString('base64').slice(0, 32)}`;
    await kv.set(key, JSON.stringify(sub));

    return res.status(201).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' });
    }

    const key = `sub:${Buffer.from(endpoint).toString('base64').slice(0, 32)}`;
    await kv.del(key);

    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
