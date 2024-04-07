# 📸 MinifyPix

MinifyPix 是一个用于优化图像文件大小的 Node.js 模块。它既可以独立使用，也可以通过配置检测 Git 暂存区中的图像文件，在代码提交的时候提供对它们进行压缩和优化的能力。

![可配置的基于Git批量压缩图片](https://img06.zhaopin.com/2012/other/mobile/minify-pix.gif)

## 📥 安装

使用 npm 安装:

```bash
npm install minify-pix
```

## 🚀 使用

### 独立使用

您可以直接运行 `minify-pix` 命令来优化当前目录下的所有图像文件。

```bash
npx minify
```

### 与 Git 钩子集成

MinifyPix 可以与 Git 钩子集成，在每次代码提交时自动优化暂存区中的图像文件。

1. 安装 Husky 9

```bash
npm install husky@9 --save-dev
```

2. 初始化 Husky

```bash
npx husky init
```

3. 配置 pre-commit 钩子

Husky 会在 `.husky` 目录下创建 `pre-commit` 文件。编辑该文件，添加以下内容:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx minify
```

这将在每次提交代码时先执行 `minify-pix` 命令，然后将优化后的文件添加到暂存区。

4. 安装当前支持的最低版本husky，如5

```bash
npm install husky@5 --save-dev
npx husky install
npx husky add .husky/pre-commit "npx minify"
```

5. 编辑.husky/pre-commit

```bash
#!/bin/sh

npx minify

git diff --cached --name-only --diff-filter=ACMRTUXB | egrep "\.(png|gif|jpeg|jpg|svg)$" | while IFS= read -r file;do
    git add "$file"
done
```

6. 当前可基于package.json配置

```json
"minifyPix": {
    "png": {
        "quality": [0.6, 0.8]
    }
}
```
```js
const DEFAULT_PLUGIN_CONFIG = {
  jpg: { quality: 90, progressive: true, arithmetic: false },
  png: { quality: [0.8, 0.9], speed: 1 },
  gif: { optimizationLevel: 2, interlaced: false, colors: 256 }
}
```

现在，每次提交代码时，MinifyPix 都会自动优化暂存区中的图像文件。

## ⚙️ 配置（TODO）

MinifyPix 支持多种优化选项，您可以在运行时传递参数或在项目根目录下创建 `.minifypixrc` 文件进行配置。

更多详细信息，请参阅 [代码仓](https://gitlab.dev.zhaopin.com/RD/tools/minify-pix)。

## 📄 许可证

MinifyPix 基于 [MIT 许可证](https://opensource.org/licenses/MIT)开源。