import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const base = `http://${req.headers.host || 'localhost'}`;
  const { pathname } = new URL(req.url || '/', base);

  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/health' || pathname === '/api/health/') {
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found', path: pathname }));
}
