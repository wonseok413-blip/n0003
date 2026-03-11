const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8889;
const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const fp = path.join(__dirname, 'public', url);
  const ext = path.extname(fp);
  const ct = TYPES[ext] || 'application/octet-stream';
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': ct });
      res.end(data);
    }
  });
}).listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
