// Zero-dependency API + static file server.
//   GET /api/events?club=smalls,mezzrow&from=2026-07-13&to=2026-07-31
//   GET /api/clubs
//   GET /*  -> serves web/dist (built frontend)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data', 'events.json');
const STATIC = join(__dirname, '..', 'web', 'dist');
const PORT = process.env.PORT ?? 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function loadData() {
  try {
    return JSON.parse(await readFile(DATA, 'utf8'));
  } catch {
    return { generatedAt: null, clubs: [], events: [], errors: ['no data yet — run: npm run crawl'] };
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-cache',
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/events') {
    const data = await loadData();
    let events = data.events;
    const club = url.searchParams.get('club');
    if (club) {
      const ids = new Set(club.split(','));
      events = events.filter((e) => ids.has(e.clubId));
    }
    const from = url.searchParams.get('from');
    if (from) events = events.filter((e) => e.date >= from);
    const to = url.searchParams.get('to');
    if (to) events = events.filter((e) => e.date <= to);
    return sendJson(res, 200, { generatedAt: data.generatedAt, count: events.length, events });
  }

  if (url.pathname === '/api/clubs') {
    const data = await loadData();
    return sendJson(res, 200, { clubs: data.clubs });
  }

  // static frontend
  let filePath = normalize(join(STATIC, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!filePath.startsWith(STATIC)) {
    res.writeHead(403); return res.end('forbidden');
  }
  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    // SPA fallback
    try {
      const body = await readFile(join(STATIC, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('not found — build the frontend first: npm run build:web');
    }
  }
});

server.listen(PORT, () => console.log(`jazzlineup.com listening on http://localhost:${PORT}`));
