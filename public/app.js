let allFiles = [];
let tree = null;
let currentView = 'all';
let currentCategory = '';

document.addEventListener('contextmenu', e => e.preventDefault());

// BEGIN_STATIC_REMOVE
async function loadData() {
  const res = await fetch('/api/scan');
  const data = await res.json();
  tree = data.tree;
  allFiles = data.allFiles;
  renderTree();
  renderGallery(allFiles);
}
// END_STATIC_REMOVE

function countFiles(node) {
  let count = node.files.length;
  for (const child of node.children) {
    count += countFiles(child);
  }
  return count;
}

function renderTree() {
  const root = document.getElementById('tree-root');
  root.innerHTML = '';
  document.getElementById('total-count').textContent = allFiles.length;

  function createTreeNode(node) {
    const count = countFiles(node);
    const hasChildren = node.children.length > 0;

    const item = document.createElement('div');
    item.className = 'tree-node';

    const row = document.createElement('div');
    row.className = 'tree-item';
    row.dataset.category = node.path || node.name;

    if (hasChildren) {
      const toggle = document.createElement('span');
      toggle.className = 'tree-toggle expanded';
      toggle.textContent = '▶';
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const children = item.querySelector('.tree-children');
        if (children) {
          children.classList.toggle('collapsed');
          toggle.classList.toggle('expanded');
        }
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.style.width = '16px';
      spacer.style.flexShrink = '0';
      row.appendChild(spacer);
    }

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = hasChildren ? '📂' : '📁';
    row.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name;
    row.appendChild(label);

    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'tree-count';
      badge.textContent = count;
      row.appendChild(badge);
    }

    row.addEventListener('click', () => switchCategory(node.path || node.name));
    item.appendChild(row);

    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      for (const child of node.children) {
        childrenContainer.appendChild(createTreeNode(child));
      }
      item.appendChild(childrenContainer);
    }

    return item;
  }

  for (const child of tree.children) {
    root.appendChild(createTreeNode(child));
  }
}

function switchCategory(category) {
  currentCategory = category;
  currentView = 'category';

  document.querySelectorAll('.tree-item').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.tree-item[data-category="${category}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelector('.tree-item[data-view="all"]').classList.remove('active');

  const files = allFiles.filter(f => f.category === category || f.category.startsWith(category + '/'));
  renderGallery(files);
}

function switchToAll() {
  currentView = 'all';
  currentCategory = '';
  document.querySelectorAll('.tree-item').forEach(b => b.classList.remove('active'));
  document.querySelector('.tree-item[data-view="all"]').classList.add('active');
  renderGallery(allFiles);
}

function renderGallery(files) {
  const gallery = document.getElementById('gallery');

  if (files.length === 0) {
    gallery.innerHTML = `
      <div class="empty-state">
        <h2>没有找到媒体文件</h2>
        <p>将图片、视频或音频文件放入 media 目录</p>
      </div>
    `;
    return;
  }

  gallery.innerHTML = '';

  for (const file of files) {
    const item = document.createElement('div');
    item.className = 'media-item';

    if (file.type === 'image') {
      const img = document.createElement('img');
      img.src = `/media/${file.path}`;
      img.loading = 'lazy';
      img.alt = file.name;
      item.appendChild(img);
    } else if (file.type === 'video') {
      const video = document.createElement('video');
      video.src = `/media/${file.path}`;
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      item.appendChild(video);

      video.addEventListener('mouseenter', () => video.play());
      video.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
    } else if (file.type === 'audio') {
      const thumb = document.createElement('div');
      thumb.className = 'audio-thumb';
      thumb.textContent = '🎵';
      item.appendChild(thumb);
    }

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="filename">${file.name}</div>
      ${file.category ? `<div class="category-tag">${file.category}</div>` : ''}
    `;
    item.appendChild(overlay);

    item.addEventListener('click', (e) => {
      if (e.button === 0) openLightbox(file);
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      copyLink(file);
    });

    gallery.appendChild(item);
  }
}

function openLightbox(file) {
  const lightbox = document.getElementById('lightbox');
  const mediaContainer = lightbox.querySelector('.lightbox-media');

  mediaContainer.innerHTML = '';

  if (file.type === 'image') {
    const img = document.createElement('img');
    img.src = `/media/${file.path}`;
    mediaContainer.appendChild(img);
  } else if (file.type === 'video') {
    const video = document.createElement('video');
    video.src = `/media/${file.path}`;
    video.controls = true;
    video.autoplay = true;
    mediaContainer.appendChild(video);
  } else if (file.type === 'audio') {
    const audio = document.createElement('audio');
    audio.src = `/media/${file.path}`;
    audio.controls = true;
    audio.autoplay = true;
    mediaContainer.appendChild(audio);
  }

  lightbox.classList.remove('hidden');

  lightbox.querySelector('.lightbox-backdrop').onclick = closeLightbox;
  lightbox.querySelector('.lightbox-close').onclick = closeLightbox;
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.add('hidden');
  const mediaContainer = lightbox.querySelector('.lightbox-media');
  mediaContainer.innerHTML = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

function copyLink(file) {
  const baseUrl = window.location.origin;
  const link = `${baseUrl}/media/${file.path}`;

  navigator.clipboard.writeText(link).then(() => {
    showToast('链接已复制');
  }).catch(() => {
    const input = document.createElement('input');
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast('链接已复制');
  });
}

const TOAST_MAX = 5;

function showToast(message) {
  const container = document.getElementById('toast-container');
  while (container.children.length >= TOAST_MAX) {
    container.firstChild.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.prepend(toast);
  toast.offsetHeight;
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hidden');
    setTimeout(() => toast.remove(), 400);
  }, 2000);
}

document.querySelector('.tree-item[data-view="all"]').addEventListener('click', switchToAll);

// BEGIN_STATIC_REMOVE
loadData();
// END_STATIC_REMOVE
