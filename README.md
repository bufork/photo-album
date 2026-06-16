# 相册

基于 Node.js 的本地相册应用，自动扫描目录下的图片、视频、音频文件，以瀑布流方式展示。

## 功能

- **自动扫描**：识别 `media/` 目录下所有图片、视频、音频文件
- **树状分类**：左侧栏显示目录树结构，支持折叠/展开，清晰展示层级关系
- **瀑布流布局**：响应式列数，自适应屏幕宽度
- **媒体预览**：左键点击查看大图/播放视频，鼠标悬停视频自动预览
- **直链复制**：右键复制媒体文件直链（基于当前访问域名）
- **忽略目录**：通过 `config.json` 配置需要忽略的目录，dev 和 build 模式均生效
- **Range 请求**：支持视频/音频流式传输和断点续传

## 支持的文件格式

| 类型 | 格式 |
|------|------|
| 图片 | jpg, jpeg, png, gif, bmp, webp, svg, ico, tiff, tif |
| 视频 | mp4, webm, ogg, mov, avi, mkv, flv, wmv, m4v |
| 音频 | mp3, wav, ogg, flac, aac, wma, m4a, opus |

## 快速开始

```bash
pnpm dev
```

打开 http://localhost:3000

## 命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建静态网站到 dist 目录 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `MEDIA_DIR` | `./media` | 媒体文件目录路径 |

```bash
# 示例：使用自定义端口和目录
PORT=8080 MEDIA_DIR=D:\Photos pnpm dev
```

## 配置

### 站点配置

编辑 `site.json` 自定义浏览器标签标题、图标等：

```json
{
  "title": "我的相册",
  "description": "家庭相册",
  "favicon": "assets/favicon.png"
}
```

| 字段 | 说明 |
|------|------|
| `title` | 浏览器标签标题 |
| `description` | 页面描述（SEO） |
| `favicon` | 浏览器标签图标（支持本地路径或 URL） |

将 favicon 文件放入 `assets/` 目录。

### 忽略目录

编辑 `config.json` 配置需要忽略的目录：

```json
{
  "ignoreDirs": ["backup", "temp", "private"]
}
```

## 项目结构

```
相册/
├── server.js          # Node.js 开发服务器
├── build.js           # 静态构建脚本
├── config.json        # 忽略目录配置
├── site.json          # 站点配置（标题、图标等）
├── package.json       # 项目配置
├── media/             # 媒体文件目录（图片/视频/音频）
├── assets/            # 站点资源目录（favicon）
├── dist/              # 构建输出目录（静态网站，pnpm build 生成）
└── public/
    ├── index.html     # 相册主页
    ├── style.css      # 样式
    └── app.js         # 前端逻辑
```

## 部署

### 开发模式

```bash
pnpm dev
```

访问 http://localhost:3000

### 静态部署

```bash
pnpm build
```

构建完成后，`dist/` 目录包含完整的静态网站，可直接部署到任意静态托管服务：

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- Nginx / Apache

```bash
# 本地预览静态版本
npx serve dist
```

## API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/scan` | GET | 扫描媒体目录，返回文件树和文件列表 |
| `/media/<path>` | GET | 获取媒体文件（支持 Range 请求） |

## 浏览器兼容

- 禁用鼠标右键（防止默认菜单）
- 左键点击：查看图片/播放视频
- 右键点击：复制媒体直链
- ESC 键：关闭预览
