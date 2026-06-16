const fs = require('fs');
const path = require('path');

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, 'media');
const DIST_DIR = path.join(__dirname, 'dist');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const SITE_PATH = path.join(__dirname, 'site.json');
const ASSETS_DIR = path.join(__dirname, 'assets');

const MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif',
  '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus'
]);

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return { ignoreDirs: [] };
  }
}

function loadSite() {
  try {
    return JSON.parse(fs.readFileSync(SITE_PATH, 'utf-8'));
  } catch {
    return { title: '相册', description: '我的相册', favicon: '' };
  }
}

function getMediaType(ext) {
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus'];
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  return 'unknown';
}

function scanDirectory(dir, basePath = '', ignoreSet) {
  const result = { name: path.basename(dir) || 'root', path: basePath, files: [], children: [] };

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (ignoreSet.has(entry.name)) continue;
        const child = scanDirectory(fullPath, relativePath, ignoreSet);
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

  const config = loadConfig();
  const site = loadSite();
  const ignoreSet = new Set(config.ignoreDirs);

  let tree = { name: 'root', path: '', files: [], children: [] };
  let allFiles = [];

  if (fs.existsSync(MEDIA_DIR)) {
    tree = scanDirectory(MEDIA_DIR, '', ignoreSet);
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

  const finalHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${faviconTag}
  ${metaDesc}
  <title>${site.title}</title>
  <style>${css}</style>
</head>
<body>
  <div id="app">
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
  <script>${staticJs}</script>
  <script>
(function() {
  const data = window.__DATA__;
  allFiles = data.allFiles;
  tree = data.tree;
  renderTree();
  renderGallery(allFiles);
  document.querySelector('.tree-item[data-view="all"]').addEventListener('click', switchToAll);
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
