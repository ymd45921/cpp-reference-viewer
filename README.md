<div align="center">
  <img src="web/src/cpp.svg" width="120" height="120" alt="C++ Reference Viewer">
  <h1>C++ Reference Viewer</h1>
  <p>C++ Reference 离线文档阅读器</p>
</div>

方便自用的 C++ Reference 中文版离线文档阅读器。

## 🚀 快速开始

本项目是一个标准的 Next.js 项目。

```bash
cd web
npm install
npm run build
npm run dev
```

在启动开发服务器之前，需要先运行一次构建生成所需要的静态资源。之后访问 `http://localhost:3000/viewer` 即可使用。

## 📦 项目结构

目前，本仓库已经包含了 20250404 版本的离线 C++ 中文文档。

```
cpp-reference-viewer/
├── web/                   # Web 应用
│   └── src/
└── wiki/                  # 离线文档
```

如果有后续更新，也可以手动替换 `wiki/` 目录下的文件，并且配置合适的环境变量。

## ⚙️ 配置

本项目的功能都可以使用环境变量进行控制，参考 `.env.example`（在 `web/` 目录下复制为 `.env.local` 生效）：

```bash
# ===== 服务器端（构建阶段）=====
WIKI_DIR=../wiki                    # 文档根目录（绝对路径或相对 web/）
WIKI_EXCLUDE=common                 # 目录树中需排除的目录，逗号分隔
WIKI_BLOCK_ANALYTICS=false          # 构建时移除 GA 等统计脚本
WIKI_OUT_DIR=public/wiki            # 静态 wiki 输出目录（相对 web/）

# ===== 客户端（必须以 NEXT_PUBLIC_ 开头）=====
NEXT_PUBLIC_WIKI_HOME=zh/首页.html   # 首页路径（相对 wiki 根）
NEXT_PUBLIC_ENABLE_SEARCH=true      # 是否启用全文检索（占用一定资源）
NEXT_PUBLIC_MOBILE_BOTTOM_BAR=true  # 移动端底部地址栏（Safari 风格）
```

可以使用 Vercel 或任意支持静态资源 CDN 的平台部署；但是更建议本地预览以获得最好的速度和表现。

## 📄 附录

- MIT License
- 基于 [Next.js](https://nextjs.org/) 构建
- 文档来自 [cppreference.com](https://en.cppreference.com/)
