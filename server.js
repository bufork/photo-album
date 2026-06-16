const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, 'media');
const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return { ignoreDirs: [] };
  }
}

const MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif',
  '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus'
]);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getMediaType(ext) {
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus'];
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  return 'unknown';
}

function scanDirectory(dir, basePath = '') {
  const config = loadConfig();
  const ignoreSet = new Set(config.ignoreDirs);
  const result = { name: path.basename(dir) || 'root', path: basePath, files: [], children: [] };

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (ignoreSet.has(entry.name)) continue;
        const child = scanDirectory(fullPath, relativePath);
        if (child.files.length > 0 || child.children.length > 0) {
          result.children.push(child);
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (MEDIA_EXTS.has(ext)) {
          const stat = fs.statSync(fullPath);
          result.files.push({
            name: entry.name,
            path: relativePath,
            ext,
            type: getMediaType(ext),
            size: stat.size,
          });
        }
      }
    }
  } catch (e) {
    console.error(`Error reading directory ${dir}:`, e.message);
  }

  result.children.sort((a, b) => a.name.localeCompare(b.name));
  result.files.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function getAllFiles(node, category = '') {
  let files = [];
  for (const file of node.files) {
    files.push({ ...file, category });
  }
  for (const child of node.children) {
    const childCategory = category ? `${category}/${child.name}` : child.name;
    files = files.concat(getAllFiles(child, childCategory));
  }
  return files;
}

function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function serveMedia(req, res, mediaPath) {
  const fullPath = path.join(MEDIA_DIR, mediaPath);
  if (!fullPath.startsWith(MEDIA_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      fs.createReadStream(fullPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      fs.createReadStream(fullPath).pipe(res);
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/api/scan') {
    if (!fs.existsSync(MEDIA_DIR)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }
    const tree = scanDirectory(MEDIA_DIR);
    const allFiles = getAllFiles(tree);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ tree, allFiles }));
    return;
  }

  if (pathname.startsWith('/media/')) {
    const mediaPath = pathname.slice(7);
    serveMedia(req, res, mediaPath);
    return;
  }

  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = path.join(__dirname, 'public', 'index.html');
  } else {
    filePath = path.join(__dirname, 'public', pathname);
  }

  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  serveStatic(req, res, filePath);
});

server.listen(PORT, () => {
  console.log(`Photo Album running at http://localhost:${PORT}`);
  console.log(`Media directory: ${MEDIA_DIR}`);
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    console.log(`Created media directory: ${MEDIA_DIR}`);
  }
});
