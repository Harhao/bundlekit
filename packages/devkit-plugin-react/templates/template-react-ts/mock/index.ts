import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

http.createServer((req, res) => {
  const requestPath = req.url?.split('?')[0];
  const requestMethod = req.method?.toLowerCase();
  const mockFilePath = path.resolve(
    __dirname,
    `./resources${requestPath}.${requestMethod}.json`
  );

  try {
    const content = fs.readFileSync(mockFilePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(content);
    res.end();
  } catch (_error) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));
  }
}).listen(4000, () => {
  console.log('Mock server running on http://localhost:4000');
});
