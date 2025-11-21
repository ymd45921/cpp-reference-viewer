<div align="center">
  <img src="web/src/cpp.svg" width="120" height="120" alt="C++ Reference Viewer">
  <h1>C++ Reference Viewer</h1>
  <p>C++ Reference 离线文档</p>
</div>

方便自用的 C++ Reference 中文版离线文档阅读器。

## 🚀 快速开始

本项目是一个标准的 Next.js 项目。

```bash
cd web
npm install
npm run dev
```

访问 `http://localhost:3000/viewer` 即可使用。

## 📦 项目结构

目前，本仓库已经包含了 20250404 版本的离线 C++ 中文文档。

```
cpp-reference-viewer/
├── web/                   # Web 应用
│   ├── src/
└── wiki/                  # 离线文档
```

如果有后续更新，也可以手动替换 `wiki/` 目录下的文件，并且配置合适的环境变量。

## ⚙️ 配置

本项目的功能都可以使用环境变量进行控制，可以参考 `.env.example`：

```bash
WIKI_DIR=../wiki                    # 静态网页的文件目录
WIKI_EXCLUDE=common                 # 静态网页的共享资源，不应该在文件侧边栏索引
NEXT_PUBLIC_WIKI_HOME=zh/首页.html   # 访问时打开的第一个页面
NEXT_PUBLIC_ENABLE_SEARCH=true      # 开启搜索功能；搜索功能会消耗服务器资源
```

建议使用 Vercel 部署或者直接在本地运行。

## 📄 附录

- MIT License
- 基于 [Next.js](https://nextjs.org/) 构建
- 文档来自 [cppreference.com](https://en.cppreference.com/)
