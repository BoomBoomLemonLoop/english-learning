import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../_site');
const prefix = '/english-learning';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
export function createServer(directory = root) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/') { res.writeHead(302, { Location: `${prefix}/` }); res.end(); return; }
      if (!url.pathname.startsWith(prefix + '/')) { res.writeHead(404); res.end('Not found'); return; }
      let file = path.resolve(directory, '.' + decodeURIComponent(url.pathname.slice(prefix.length)));
      if (file !== path.resolve(directory) && !file.startsWith(path.resolve(directory) + path.sep)) { res.writeHead(403); res.end(); return; }
      if ((await stat(file)).isDirectory()) {
        if (!url.pathname.endsWith('/')) { res.writeHead(302, { Location: url.pathname + '/' + url.search }); res.end(); return; }
        file = path.join(file, 'index.html');
      }
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173/english-learning/'));
}
