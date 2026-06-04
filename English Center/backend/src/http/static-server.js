const fs = require('fs');
const path = require('path');
const { FRONTEND_DIR, MIME_TYPES } = require('../config/app');

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  filePath = filePath.replace(/^\/+/, '');
  const absolutePath = path.resolve(FRONTEND_DIR, filePath);
  const relativePath = path.relative(FRONTEND_DIR, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(absolutePath, (error, stats) => {
    if (error || !stats.isFile()) {
      const notFoundPath = path.join(FRONTEND_DIR, '404.html');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(notFoundPath).pipe(res);
    }

    const type = MIME_TYPES[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(absolutePath).pipe(res);
  });
}

module.exports = {
  serveStatic
};
