import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const types = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  wasm: 'application/wasm',
};
const port = Number(process.argv[2] ?? 4173);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = path === '/' ? '/index.html' : path;
  if (!/^\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+$/i.test(file) || file.includes('..')) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(new URL('./dist' + file, import.meta.url));
    response.writeHead(200, { 'Content-Type': types[file.split('.').at(-1)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
