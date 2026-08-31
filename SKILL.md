---
name: wps-agent-kit
version: "1.0.0"
description: >
  AI Agent 接入 WPS 生态工具包。支持写入 WPS 新版便签(ainote.kdocs.cn)、
  列出便签、读取 WPS 云文档(Agent API Key + V7 接口)。当用户说"帮我写进WPS便签"、
  "记到WPS笔记里"、"读取这个WPS文档"、"总结金山文档"时使用。
  前置: 需先运行 scripts/auth.js 完成浏览器登录。
language: zh-CN
---

# WPS Agent Kit

让 AI Agent 直接操作 WPS 生态：新版便签读写、云文档读取。

## 何时使用

- 用户要求把内容写入 **WPS 新版便签 / WPS 笔记**（ainote.kdocs.cn）
- 用户要求列出 / 查看 WPS 便签中的笔记
- 用户要求读取 / 总结 **WPS 云文档**（kdocs.cn 链接）
- 用户提到"记到 WPS 里"、"写进便签"、"帮我读这个金山文档"

**不适用**: 本地 .docx/.xlsx 文件操作、WPS 桌面端问题、旧版便签(note.wps.cn)。

## 前置检查

每次执行前，确认登录会话存在：

```bash
ls ~/.wps-agent-kit/profile/   # Windows: %USERPROFILE%\.wps-agent-kit\profile
```

不存在则先运行登录：

```bash
node scripts/auth.js
```

读取云文档还需要环境变量 `AGENT_API_KEY`（格式 `apik:<sk_id>.<secret_key>`）。

## 核心命令

### 1. 写入 WPS 新版便签

```bash
# 直接传内容
node scripts/note-write.js --content "要写的内容"

# 带标题
node scripts/note-write.js --title "会议纪要" --content "1. xxx\n2. yyy"

# 从 stdin / 文件
cat note.txt | node scripts/note-write.js
```

**原理**: 用已保存的浏览器会话打开 ainote.kdocs.cn → 新建笔记 → 点击编辑区 → **键盘输入**（该编辑器用虚拟输入框，DOM 注入不生效，必须用键盘）→ 等自动保存 → 回主页验证。

### 2. 列出便签

```bash
node scripts/note-list.js              # 最近 20 条
node scripts/note-list.js --limit 50  # 指定数量
node scripts/note-list.js --json       # JSON 输出
```

### 3. 读取 WPS 云文档

```bash
# 需要 AGENT_API_KEY 环境变量
node scripts/doc-read.js --url "https://www.kdocs.cn/l/xxxxx"
node scripts/doc-read.js --url "xxx" --format md --output doc.md
```

**原理**: Agent API Key 换 AccessToken → V7 接口获取 link meta(drive_id/file_id) → 内容抽取(openapi.wps.cn，失败回退 api.wps.cn)。

## 写入便签的关键坑点

1. **必须用键盘输入**: ainote.kdocs.cn 的编辑器是虚拟输入框(`virtual-input`)，直接改 `innerHTML` / `innerText` 不生效，必须 `page.keyboard.type()`。
2. **先点击编辑区再输入**: 新建笔记后需点击内容区聚焦，否则键盘输入可能丢失。
3. **等自动保存**: 输入后等 5-6 秒让云端同步，再验证。
4. **验证方式**: 重新打开主页，检查笔记列表是否出现新内容（用内容前 15 字符匹配）。
5. **空笔记会被清理**: 新建后不输入内容，刷新后空笔记可能消失。

## 复制到另一台电脑

1. 拷贝本项目目录（不含 `profile/` 和 `node_modules/`）
2. 新电脑 `npm install`
3. 运行 `node scripts/auth.js` 重新登录（会话不能跨机器拷贝）
4. 如需读云文档，设置 `AGENT_API_KEY` 环境变量

## 相关项目

- **wps-airpage**: WPS AirPage / 智能文档的创建与块级编辑（Cookie+CSRF 鉴权）
  - 仓库: 搜索 "wps-airpage" skill
  - 能力: 新建文档、插入 Markdown、查询/更新块、上传图片、评论操作
- **kdocs-summary**: 金山文档内容总结 Skill（本项目 doc-read.js 的来源）
- **wpsnote-skills**: WPS 笔记官方 MCP / CLI（需 WPS 笔记桌面端，本地 MCP 服务 127.0.0.1:18930）
  - 仓库: https://github.com/wpsnote/wpsnote-skills
