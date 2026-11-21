// Development-only static server for the guide in app/.
// Usage: node serve.ts --port 8123   (default port 8123)
// Serves app/ at its root so app/index.html works exactly like the entry.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const portArg = process.argv.indexOf('--port');
const wanted = portArg === -1 ? NaN : Number(process.argv[portArg + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8123;

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
]);

const server = createServer((req, res) => {
  const rawPath = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
  const rel = rawPath.endsWith('/') ? rawPath + 'index.html' : rawPath;
  const file = resolve(join(rootDir, '.' + rel));
  if (!file.startsWith(rootDir)) { res.writeHead(403); res.end('forbidden'); return; }
  let body;
  try {
    if (!statSync(file).isFile()) throw new Error('missing');
    body = readFileSync(file);
  } catch {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': types.get(extname(file).toLowerCase()) ?? 'application/octet-stream', 'content-length': body.length, 'cache-control': 'no-store' });
  res.end(body);
});
server.listen(port, '127.0.0.1', () => console.log(`Leonida guide at http://127.0.0.1:${port}/`));
