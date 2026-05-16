const GIST_ID    = process.env.GITHUB_GIST_ID;
const GH_TOKEN   = process.env.GITHUB_TOKEN;
const GIST_FILE  = 'push-subs.json';
const GIST_API   = `https://api.github.com/gists/${GIST_ID}`;

const headers = {
  Authorization: `token ${GH_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
};

async function readSubs() {
  const res  = await fetch(GIST_API, { headers });
  const data = await res.json();
  const raw  = data.files?.[GIST_FILE]?.content ?? '{}';
  return JSON.parse(raw);
}

async function writeSubs(subs) {
  await fetch(GIST_API, {
    method:  'PATCH',
    headers,
    body: JSON.stringify({
      files: { [GIST_FILE]: { content: JSON.stringify(subs, null, 2) } },
    }),
  });
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const sub = req.body;
    if (!sub?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

    const subs = await readSubs();
    const key  = Buffer.from(sub.endpoint).toString('base64').slice(0, 32);
    subs[key]  = sub;
    await writeSubs(subs);
    return res.status(201).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

    const subs = await readSubs();
    const key  = Buffer.from(endpoint).toString('base64').slice(0, 32);
    delete subs[key];
    await writeSubs(subs);
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
