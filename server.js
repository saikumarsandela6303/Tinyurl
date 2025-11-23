// ...existing code...
const express = require('express');
const app = express();
app.use(express.json());

const BASE_URL = 'https://saiaroma.netlify.app';
let links = {}; // In-memory storage (use DB in real app)

function generateCode(length = 6) {
    return Math.random().toString(36).substring(2, 2 + length);
}

async function createTinyUrl(longUrl) {
    try {
        // public TinyURL endpoint that returns the short URL as plain text
        const api = `http://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`;
        const res = await fetch(api);
        if (!res.ok) throw new Error('TinyURL request failed');
        const short = (await res.text()).trim();
        // basic validation of returned value
        if (!/^https?:\/\/\S+/.test(short)) throw new Error('Invalid tinyurl response');
        return short;
    } catch (err) {
        // On failure, return null so caller can fallback to internal short url
        return null;
    }
}

app.post('/api/links', async (req, res) => {
  const { url, code } = req.body || {};
  if (!url || typeof url !== 'string' || !/^https?:\/\/\S+\.\S+/.test(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL' });
  }

  let finalCode = code && typeof code === 'string' ? code : generateCode();
  // avoid collisions
  while (links[finalCode]) {
    finalCode = generateCode();
  }

  // try to create a TinyURL short link; fallback to our BASE_URL short link
  const tiny = await createTinyUrl(url);
  const shortUrl = tiny || `${BASE_URL}/${finalCode}`;

  links[finalCode] = {
    url,
    clicks: 0,
    lastClicked: null,
    shortUrl
  };

  return res.status(201).json({ code: finalCode, url, shortUrl: links[finalCode].shortUrl });
});

app.get('/api/links', (req, res) => {
  res.json(links);
});

app.delete('/api/links/:code', (req, res) => {
  const { code } = req.params;
  if (!links[code]) return res.status(404).json({ error: 'Not found' });
  delete links[code];
  res.sendStatus(204);
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true, version: '1.0' });
});

// Wildcard redirect route must come after all /api and other specific routes
app.get('/:code', (req, res) => {
  const { code } = req.params;
  const link = links[code];
  if (!link) return res.status(404).send('Not found');
  link.clicks++;
  link.lastClicked = new Date().toISOString();
  res.redirect(302, link.url);
});

app.listen(3000, () => console.log('Server started on port 3000'));
// ...existing code...