// Serves the web export (app/dist) for the end-to-end tests: static files, and index.html for
// any other path (the app is a single page). Usage: node e2e/serve.mjs [port]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../app/dist', import.meta.url)));
const port = Number(process.argv[2] ?? 8081);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error(
    `${root}/index.html not found: run "npm run export:web -w @constraintpuzzler/app" first`,
  );
  process.exit(1);
}

createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname));
  let file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, 'index.html');
  }
  response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
