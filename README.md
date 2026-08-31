# WPS Agent Kit

> 让 AI Agent 直接操作 WPS 生态：**新版便签读写**、**云文档读取**。
> 无需 WPS 桌面端、无需官方 MCP，纯浏览器会话 + API 即可运行。

## 这是什么

一套可复制到任意电脑的工具包 + Skill，让 AI（Claude Code / Cursor / Doubao Work 等）能够：

| 能力 | 脚本 | 鉴权方式 | 说明 |
|------|------|---------|------|
| ✅ 写入 WPS 新版便签 | `note-write.js` | 浏览器会话 | ainote.kdocs.cn，新建笔记并输入内容 |
| ✅ 列出 WPS 便签 | `note-list.js` | 浏览器会话 | 查看最近笔记 |
| ✅ 读取 WPS 云文档 | `doc-read.js` | Agent API Key | kdocs.cn 文档内容抽取（V7 接口） |
| ➕ 创建/编辑 AirPage 文档 | （外部 skill） | Cookie+CSRF | 见 [references/airpage.md](references/airpage.md) |

**与官方方案的区别**: WPS 笔记官方提供桌面端 MCP（`127.0.0.1:18930`）和 wpsnote-cli，但需要安装 WPS 笔记桌面端并保持运行。本项目**不需要桌面端**，直接用浏览器会话驱动网页版，更轻量、跨平台。

## 环境要求

- **Node.js >= 16**（推荐 18+）
- **Microsoft Edge** 浏览器（Playwright 用 channel: msedge）
  - 也支持 Chrome，改 `scripts/*.js` 中的 `channel: 'msedge'` 为 `'chrome'` 或去掉 channel
- 网络能访问 `ainote.kdocs.cn`、`account.wps.cn`、`openapi.wps.cn`
- 一个 WPS 账号（用于登录）

## 快速开始（5 步）

### 1. 克隆项目并安装依赖

```bash
git clone <你的仓库地址> wps-agent-kit
cd wps-agent-kit
npm install
```

> 首次安装会下载 Playwright 浏览器（约 100+MB），如果已有 Edge 可跳过：
> `npm install` 后不需要额外 `playwright install`，因为脚本用系统 Edge。

### 2. 登录 WPS（保存浏览器会话）

```bash
node scripts/auth.js
```

会弹出一个 Edge 浏览器窗口，**手动完成 WPS 登录**（扫码或账号密码）。
登录成功后脚本自动检测并保存会话，然后关闭浏览器。

会话保存在:
- Windows: `%USERPROFILE%\.wps-agent-kit\profile\`
- macOS/Linux: `~/.wps-agent-kit/profile/`

> 也可以用环境变量 `WPS_PROFILE_DIR` 自定义会话目录。

### 3. 写入一条便签测试

```bash
node scripts/note-write.js --content "Hello from WPS Agent Kit!"
```

成功后会输出笔记 URL，打开 [ainote.kdocs.cn](https://ainote.kdocs.cn) 即可看到。

### 4. （可选）配置云文档读取

如需读取 WPS 云文档，设置 Agent API Key：

```powershell
# Windows PowerShell（用户级持久化）
[Environment]::SetEnvironmentVariable("AGENT_API_KEY", "apik:<sk_id>.<secret_key>", "User")
# 重启终端
```

```bash
# macOS/Linux
echo 'export AGENT_API_KEY="apik:<sk_id>.<secret_key>"' >> ~/.zshrc
source ~/.zshrc
```

API Key 在 [WPS 开放平台](https://open.wps.cn/) 申请，格式 `apik:<sk_id>.<secret_key>`。

### 5. （可选）读取云文档测试

```bash
node scripts/doc-read.js --url "https://www.kdocs.cn/l/你的文档ID"
```

## 详细用法

### 写入便签

```bash
# 基础用法
node scripts/note-write.js --content "要写的内容"

# 带标题
node scripts/note-write.js --title "2026-08-31 会议纪要" --content "1. 讨论了XXX\n2. 决定了YYY"

# 从文件读取内容
cat my-note.txt | node scripts/note-write.js

# 有头模式（调试用，能看到浏览器操作过程）
node scripts/note-write.js --content "test" --headful
```

**输出示例**:
```
✓ 已登录，进入主页
✓ 点击新建笔记
✓ 编辑区已聚焦
✓ 内容已输入
========================================
  ✓ 写入成功！已验证保存到云端
========================================
笔记标题: (未命名，取正文前若干字)
内容预览: Hello from WPS Agent Kit!
笔记 URL: https://www.kdocs.cn/l/xxxxxxxx
```

### 列出便签

```bash
node scripts/note-list.js --limit 10
node scripts/note-list.js --json
```

### 读取云文档

```bash
# 输出到终端（Markdown 格式）
node scripts/doc-read.js --url "https://www.kdocs.cn/l/xxxxx"

# 保存到文件
node scripts/doc-read.js --url "xxx" --output doc.md

# JSON 格式
node scripts/doc-read.js --url "xxx" --format json
```

## 如何复制到另一台电脑

这是本项目的核心设计目标。步骤：

### 方法一：Git 克隆（推荐）

```bash
# 新电脑上
git clone <你的GitHub仓库地址> wps-agent-kit
cd wps-agent-kit
npm install
node scripts/auth.js    # 重新登录（会话不能跨机器拷贝）
```

### 方法二：直接拷贝文件

```bash
# 旧电脑上，打包项目（排除 node_modules 和 profile）
tar -czf wps-agent-kit.tar.gz --exclude=node_modules --exclude=profile wps-agent-kit/

# 新电脑上
tar -xzf wps-agent-kit.tar.gz
cd wps-agent-kit
npm install
node scripts/auth.js
```

### 注意事项

1. **会话不能拷贝**: `profile/` 目录包含登录态，**不要提交到 Git，也不要跨机器拷贝**。每台电脑必须重新运行 `auth.js` 登录。
2. **AGENT_API_KEY 需要重新设置**: 云文档读取用的 API Key 是环境变量，新电脑需重新配置。
3. **Edge 浏览器**: 新电脑需安装 Microsoft Edge（或修改脚本用 Chrome）。
4. **WPS 账号**: 可以用同一个 WPS 账号在多台电脑登录，便签数据云端同步。

## 作为 Skill 安装

本项目自带 `SKILL.md`，可直接作为 Skill 安装到支持 Skill 的 AI 客户端：

### Doubao Work

将本项目目录复制到 Doubao Work 的 user_skills 目录：
- Windows: `%USERPROFILE%\AppData\Local\DoubaoWork\User Data\Profile 1\.doubaowork\agent_mode\workspace\.user_skills\`
- 然后重启 Doubao Work，Skill 自动加载。

### Claude Code / Cursor

将项目目录放入 Claude Code 的 skills 目录，或在 `~/.claude/skills/` 下创建符号链接。

安装后，AI 会自动识别 `SKILL.md` 中的触发词（"写进WPS便签"、"读取金山文档"等）并调用对应脚本。

## 架构说明

### 为什么用浏览器自动化写便签？

WPS 新版便签（ainote.kdocs.cn）目前**没有公开的写入 API**。官方 MCP 需要桌面端运行。
浏览器自动化是唯一不依赖桌面端的写入方式：

1. 用 Playwright 持久化浏览器上下文（保存登录 Cookie）
2. 打开 ainote.kdocs.cn（自动跳转到应用页）
3. 点击"新建笔记"
4. 点击编辑区聚焦
5. **用 `page.keyboard.type()` 输入**（关键！见下）
6. 等自动保存（5-6秒）
7. 回主页验证

### 为什么必须用键盘输入？

ainote.kdocs.cn 的编辑器使用**虚拟输入框**（`virtual-input`，隐藏的 contenteditable）。
直接修改 DOM（`innerHTML` / `innerText`）不会触发编辑器的内部状态更新，内容不会保存。
必须通过真实键盘事件输入，虚拟输入框捕获后同步到编辑器内部模型。

### 云文档读取为什么用 API？

WPS 云文档有公开的 **V7 内容抽取接口**（openapi.wps.cn），通过 Agent API Key 鉴权：
1. `account.wps.cn` 用 API Key 换 AccessToken（JWT，12h有效）
2. `v7/links/{link_id}/meta` 获取 drive_id + file_id
3. `v7/drives/{drive_id}/files/{file_id}/content?format=markdown` 抽取内容
4. openapi 网关未放通时自动回退 `api.wps.cn`

## 常见问题

### Q: 登录后会话能维持多久？
A: WPS 的登录 Cookie 通常维持数天到数周。过期后重新运行 `node scripts/auth.js` 即可。脚本会自动检测登录状态。

### Q: 写入便签失败怎么办？
A: 
1. 加 `--headful` 参数看浏览器实际操作过程
2. 确认已登录：`node scripts/note-list.js` 能列出笔记说明登录正常
3. 检查网络是否能访问 ainote.kdocs.cn
4. WPS 页面结构可能更新，如选择器失效需调整脚本

### Q: 能写富文本（加粗、列表、图片）吗？
A: 当前脚本只支持纯文本输入。富文本需要模拟键盘快捷键（Ctrl+B 等）或通过编辑器的格式按钮点击。图片插入需要用 WPS 笔记的 insert_image API（官方 MCP 才支持）。

### Q: 能读取便签内容吗？
A: `note-list.js` 可以列出笔记标题和预览。读取单篇笔记全文需要打开笔记 URL 并抓取编辑器内容，可基于 `note-write.js` 的框架扩展。

### Q: 和官方 wpsnote-cli / MCP 有什么区别？
A: 
- **官方方案**: 需要安装 WPS 笔记桌面端，开启 MCP（本地 127.0.0.1:18930），功能完整（23+ 原子接口，支持图片、标签、批量编辑）
- **本项目**: 不需要桌面端，纯网页驱动，功能较简单（新建+写入纯文本、列表、读文档），但更轻量、跨平台、无需保持桌面端运行
- 两者可以共存：本项目写便签，官方 MCP 做复杂编辑

### Q: 支持旧版便签（note.wps.cn）吗？
A: 不支持。旧版便签已停止云服务（2027-12-31 后），数据已迁移到新版 WPS 笔记。请使用新版。

## 项目结构

```
wps-agent-kit/
├── SKILL.md              # Skill 定义（AI 客户端自动识别）
├── README.md             # 本文件 — 完整教程
├── package.json          # 依赖和命令
├── .gitignore            # 排除 node_modules / profile / 密钥
├── scripts/
│   ├── auth.js           # WPS 浏览器登录，保存会话
│   ├── note-write.js     # 写入 WPS 新版便签
│   ├── note-list.js      # 列出便签
│   └── doc-read.js       # 读取 WPS 云文档（Agent API Key）
└── references/
    └── airpage.md        # WPS AirPage 文档操作参考（外部 skill）
```

## 相关链接

- WPS 笔记网页版: https://ainote.kdocs.cn
- WPS 开放平台: https://open.wps.cn
- WPS 笔记官方 MCP / CLI: https://github.com/wpsnote/wpsnote-skills
- WPS AirPage skill: 搜索 "wps-airpage"

## License

MIT
