# English Learning · 五板块英语学习网站

发布地址保持不变：https://boomboomlemonloop.github.io/english-learning/

轻量静态网站，无数据库、服务器或付费 API。五板块独立收录内容，没有每日更新要求。默认暗黑模式，可切换浅色；支持手机、全文搜索和日期排序。

## 日常上传：只需添加文件

| 内容 | 上传位置 |
| --- | --- |
| 情景口语 | `content/scenario-speaking/` |
| 单词、词组和卡片 | `content/vocabulary-expressions/` |
| DK1000 图像英语 | `content/dk1000-visual-english/` |
| 学术报告与演讲 | `content/seminars-presentations/` |
| 阅读与思考 | `content/reading-reflections/` |

### 独立 HTML

在 GitHub 打开对应目录，点击 **Add file → Upload files**，拖入 HTML，提交到 `main`（或通过 PR 合并）。例如 `content/scenario-speaking/2026-11-17-speaking.html`。

无需修改首页、JSON 索引或运行命令。Actions 自动扫描、校验、生成目录并发布。`upload-demo.html` 仅验证上传，不包含你的实际回答。正式 18 场景文件准备好后上传即可，演示可以删除。

### 完整静态项目

将完整文件夹拖入对应目录，保留内部结构：

```text
content/dk1000-visual-english/dk1000/
├── index.html
├── lessons/kitchen.html
├── css/style.css
├── js/app.js
└── images/kitchen.jpg
```

整个文件夹只生成一张入口卡片。内部 HTML、CSS、JS、图片原样发布；内部 HTML 正文也参与搜索。DK1000 ZIP 请先在电脑解压，再上传项目文件夹，不要直接上传 ZIP 作为网页。尚未接入时显示空状态。

默认入口为文件夹根部 `index.html`；整个项目只有一个 HTML 时也能自动识别。多个 HTML 且无 `index.html` 时会报错，不猜测入口。可重命名入口或使用下文可选配置。每个板块下的直接子文件夹视为一个项目，不要混装多个独立项目。

资源使用相对路径，如 `images/cup.jpg`、`../css/style.css`，大小写必须匹配。`/images/cup.jpg` 指向域名根部，不兼容项目站点。构建遇到站内根路径、缺失静态资源、错误大小写或锚点会停止发布，保留上一次成功部署。

资源也可放在独立 HTML 旁边；无 HTML 的资源目录不生成卡片。HTML 内嵌样式、TTS 和交互脚本保持原样，不注入网站样式。学习页如需返回板块，从 `content/<板块>/lesson.html` 使用 `../../<板块>/`。

React/Vite 等应上传静态构建产物，base 使用相对路径（如 `./`）；源码和后端程序无法直接托管。动态 JS 拼接的资源 URL、外部服务需另行确认，静态校验无法证明所有运行时行为。

## 自动识别

- 标题：可选项目配置 → HTML `<title>` → 文件名。
- 描述：可选配置 → `meta description` / `og:description` → 页面文字摘要。
- 日期：可选配置 → `meta date` / `article:published_time` → 文件或项目名中的 `YYYY-MM-DD` → 入口文件最近 Git 提交日期。
- 本地未提交且无日期的内容显示 `Undated`，日期排序始终放最后。不使用临时文件时间。
- 首页搜索全站，板块搜索本板块。匹配标题、描述、正文、标签和日期；多关键词需同时匹配。

普通用户无需额外元数据。想明确日期和摘要，可在 HTML 的 `<head>` 添加：

```html
<meta name="date" content="2026-11-17">
<meta name="description" content="18 everyday speaking situations">
```

复杂项目可选放置 `learning.json`，不用另行维护全站索引：

```json
{
  "entry": "start.html",
  "title": "My visual English project",
  "date": "2026-11-17",
  "description": "Everyday objects and expressions",
  "tags": ["visual", "daily life"]
}
```

## 首次启用 GitHub Pages（只做一次）

1. 开发分支推送并建立 PR，确认 Actions build 通过。
2. 合并前在仓库 **Settings → Pages → Build and deployment → Source → GitHub Actions** 切换发布源。看不到设置需要仓库管理员权限。
3. 合并 PR 到 `main`，工作流生成 `_site/` 并通过官方 Pages Actions 发布到原地址。
4. 在 **Actions → Build and deploy English Learning** 看结果；重试用 **Run workflow → main → Run workflow**。
5. 若 `github-pages` 环境要求审批，在任务中点击 **Review deployments → Approve and deploy**。

无需个人访问令牌，使用 GitHub 自动提供的 `GITHUB_TOKEN` 和 OIDC。如组织禁用 Actions，管理员需在 **Settings → Actions → General** 允许本工作流使用的 GitHub 官方 Actions。

推送 main、合并内容 PR 自动发布；普通 PR 只测试、构建，不部署。其他分支手动运行也不部署。失败构建不进入发布任务。同一分支的新运行会取消旧运行。

## 开发与验证（仅开发者需要）

Node.js 22 或以上，无需安装 npm 包：

```sh
node --test
node scripts/build.mjs
node scripts/preview.mjs
```

打开 http://127.0.0.1:4173/english-learning/ 。预览模拟真实项目路径前缀。`_site/` 是生成目录，不提交、不手工修改。首页和板块页面由 `scripts/build.mjs` 生成，视觉样式在 `assets/`。

测试覆盖独立 HTML、多文件项目、资源逐字节保留、项目内全文索引、可选入口、日期排序、特殊字符、安全转义、链接大小写、空板块和 HTTP 加载。构建校验静态链接、锚点、CSS URL 和 JS 模块引用。朗读声音由设备及浏览器提供。

## 旧版本恢复

改造前提交：`461db5655cd0c1f6e09d4ca0487d1cb1a159c062`，仍在 Git 历史中。旧学习资料移出新版本，不提供旧文章路径兼容；网站根地址不变。

查看旧文件：`git show 461db56:文件路径`。恢复单个文件：`git restore --source=461db56 -- 文件路径`，再放入对应内容目录。整次改造用 `git revert` 产生新提交，不重写历史、不强制推送。旧版本恢复部署还需匹配旧 Pages 发布源设置。
