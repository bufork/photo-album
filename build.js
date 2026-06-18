const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, 'media');
const DIST_DIR = path.join(__dirname, 'dist');
const SITE_PATH = path.join(__dirname, 'site.json');
const ASSETS_DIR = path.join(__dirname, 'assets');

const MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif',
  '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus'
]);

function loadSite() {
  try {
    return JSON.parse(fs.readFileSync(SITE_PATH, 'utf-8'));
  } catch {
    return { title: '相册', description: '我的相册', favicon: '', password: '', salt: '' };
  }
}

function hashPassword(password, salt) {
  const salted = salt ? salt + password : password;
  return crypto.createHash('sha256').update(salted).digest('hex');
}

function getMediaType(ext) {
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'].includes(ext)) return 'image';
  if (['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus'].includes(ext)) return 'audio';
  return 'unknown';
}

function scanDirectory(dir, basePath = '') {
  const result = { name: path.basename(dir) || 'root', path: basePath, files: [], children: [] };

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
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

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function build() {
  console.log('Building static site...');

  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const site = loadSite();

  let tree = { name: 'root', path: '', files: [], children: [] };
  let allFiles = [];

  if (fs.existsSync(MEDIA_DIR)) {
    tree = scanDirectory(MEDIA_DIR, '');
    allFiles = getAllFiles(tree);
  }

  console.log(`Found ${allFiles.length} media files`);

  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
  const css = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf-8');
  const js = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf-8');

  const staticJs = js
    .replace(/\/\/ BEGIN_STATIC_REMOVE[\s\S]*?\/\/ END_STATIC_REMOVE/g, '')
    .replace(/loadData\(\);?/g, '');

  const dataScript = `
<script>
window.__DATA__ = ${JSON.stringify({ tree, allFiles })};
window.__STATIC__ = true;
</script>`;

  const faviconTag = site.favicon ? `<link rel="icon" href="${site.favicon}">` : '';
  const metaDesc = site.description ? `<meta name="description" content="${site.description}">` : '';
  const passwordHash = site.password ? hashPassword(site.password, site.salt) : '';

  const finalHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${faviconTag}
  ${metaDesc}
  <title>${site.title}</title>
  <style>${css}
.login-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;z-index:9999}
.login-box{text-align:center;padding:40px;background:#2a2a2a;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.5)}
.login-box h2{color:#fff;margin-bottom:20px;font-size:24px}
.login-box input{width:250px;padding:12px 16px;border:1px solid #444;border-radius:6px;background:#3a3a3a;color:#fff;font-size:16px;outline:none}
.login-box input:focus{border-color:#666}
.login-box button{margin-top:15px;padding:12px 30px;border:none;border-radius:6px;background:#4a9eff;color:#fff;font-size:16px;cursor:pointer}
.login-box button:hover{background:#3a8eef}
.login-error{color:#ff6b6b;margin-top:10px;font-size:14px;display:none}
  </style>
</head>
<body>
  <div id="login-overlay" class="login-overlay"${passwordHash ? '' : ' style="display:none"'}>
    <div class="login-box">
      <h2>${site.title}</h2>
      <input type="password" id="password-input" placeholder="请输入密码" autofocus>
      <br>
      <button onclick="checkPassword()">进入</button>
      <div id="login-error" class="login-error">密码错误</div>
    </div>
  </div>

  <div id="app" style="display:none">
    <aside id="sidebar">
      <div class="sidebar-header">
        <h1>${site.title}</h1>
      </div>
      <div class="tree-container">
        <div class="tree-item active" data-view="all">
          <span class="tree-icon">📁</span>
          <span class="tree-label">全部</span>
          <span class="tree-count" id="total-count"></span>
        </div>
        <div id="tree-root"></div>
      </div>
    </aside>

    <main id="content">
      <div id="gallery" class="masonry"></div>
    </main>

    <div id="lightbox" class="lightbox hidden">
      <div class="lightbox-backdrop"></div>
      <div class="lightbox-content">
        <button class="lightbox-close">&times;</button>
        <div class="lightbox-media"></div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  ${dataScript}
  <script>
window.__HASH__ = '${passwordHash}';
window.__SALT__ = '${site.salt || ''}';
  </script>
  <script>${staticJs}</script>
  <script>
async function sha256(message) {
  const salted = window.__SALT__ + message;
  const msgBuffer = new TextEncoder().encode(salted);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkPassword() {
  const input = document.getElementById('password-input').value;
  const hash = await sha256(input);
  if (hash === window.__HASH__) {
    localStorage.setItem('album_auth', '1');
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').style.display = '';
    initApp();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

document.getElementById('password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkPassword();
});

function initApp() {
  const data = window.__DATA__;
  allFiles = data.allFiles;
  tree = data.tree;
  renderTree();
  renderGallery(allFiles);
  document.querySelector('.tree-item[data-view="all"]').addEventListener('click', switchToAll);
}

(function() {
  if (!window.__HASH__) {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').style.display = '';
    initApp();
  } else if (localStorage.getItem('album_auth') === '1') {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').style.display = '';
    initApp();
  }
})();
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), finalHtml);

  if (fs.existsSync(MEDIA_DIR)) {
    console.log('Copying media files...');
    copyDirSync(MEDIA_DIR, path.join(DIST_DIR, 'media'));
  }

  if (fs.existsSync(ASSETS_DIR)) {
    console.log('Copying assets...');
    copyDirSync(ASSETS_DIR, path.join(DIST_DIR, 'assets'));
  }

  console.log(`Build complete! Output: ${DIST_DIR}`);
  console.log(`Total files: ${allFiles.length}`);
}

build();
