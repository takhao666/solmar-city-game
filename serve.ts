// A tiny static server for game/ (Node 22, standard library only), a development
// convenience for playing Solmar City locally without a build step:
//   node serve.ts            serves game/ on http://localhost:8080
//   node serve.ts --port 8091
//   node serve.ts --host 127.0.0.1 --port 8091
// It sends the MIME types a browser game needs and refuses any path outside game/.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const requested = portIndex === -1 ? 8080 : Number(args[portIndex + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;
const hostIndex = args.indexOf('--host');
const host = hostIndex === -1 ? undefined : args[hostIndex + 1];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((request, response) => {
  const started = Date.now();
  response.on('finish', () => {
    console.log(`${new Date().toISOString()} ${request.method} ${request.url} -> ${response.statusCode} (${Date.now() - started}ms)`);
  });
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = resolve(join(root, normalize(path).replace(/^(\.\.(\/|\\|$))+/, '')));
    if (!file.startsWith(root + sep) && file !== root) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    const stat = statSync(file);
    if (!stat.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch (err) {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, host, () => {
  console.log(`Solmar City serving game/ on http://${host || 'localhost'}:${port}`);
});
