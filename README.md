# WPS 便签自动写入工具

> 让 AI 帮你自动把内容写进 WPS 新版便签（WPS 笔记），不用手动打开浏览器操作。

---

## 一、这玩意儿解决了什么问题？

**痛点**：WPS 新版便签（ainote.kdocs.cn）没有公开的写入 API。你想让 AI（Claude Code、Cursor、Codex、豆包等）帮你自动记点东西到便签里，AI 做不到——只能你自己打开浏览器、新建笔记、打字、保存。

**解决方案**：这个工具在你电脑上跑一个无头浏览器（你看不到窗口），AI 只要执行一条命令，就能自动：
1. 打开 WPS 笔记网页版
2. 新建一条便签
3. 把内容写进去
4. 等保存完成
5. 验证确实写成功了

全程约 10-15 秒，你什么都不用做。

**适合谁用**：
- 经常用 AI 写代码/查资料，想让 AI 自动把结果存到便签里
- 用 WPS 笔记做日常记录，不想每次手动复制粘贴
- 有多台电脑、多个 AI 工具，想统一用 WPS 笔记做收集

---

## 二、装好后怎么用？

### 最简单：让 AI 帮你写

装好之后，直接对你的 AI 说：

> "帮我把今天下午3点开会，记得带笔记本 写进 WPS 便签"

AI 会自动执行命令，写完告诉你"好了"。

### 手动用（命令行）

```bash
# 写一条便签
node scripts/note-write.js --content "今天下午3点开会"

# 带标题
node scripts/note-write.js --title "会议提醒" --content "今天下午3点开会，记得带笔记本"

# 查看最近的便签
node scripts/note-list.js
```

写好的内容在 https://ainote.kdocs.cn 或手机 WPS 笔记 App 里都能看到。

---

## 三、别的电脑 / 别的 AI 怎么配置？

### 3 步装好（任何电脑都一样）

**第 1 步：拿到代码**

```bash
git clone https://github.com/Deven0428/wps-agent-kit.git
cd wps-agent-kit
```

> 没有 git？在 GitHub 页面点绿色 "Code" 按钮 → "Download ZIP"，解压后进入文件夹。

**第 2 步：装依赖**

```bash
npm install
```

> 前提：电脑上装了 Node.js（去 https://nodejs.org 下载 LTS 版，一路下一步）。
> 第一次会下载 Playwright 浏览器组件，约 100MB，等它装完。

**第 3 步：登录 WPS（每台电脑都要做一次）**

```bash
node scripts/auth.js
```

会弹出一个浏览器窗口，**手动登录你的 WPS 账号**（扫码或账号密码）。登录成功后浏览器自动关闭，登录态就保存在这台电脑上了。

> ⚠️ **登录态不能拷贝到别的电脑**。WPS 会检测异地登录，所以每台电脑都要各自跑一次 `auth.js` 登录。

### 不同 AI 怎么调用

| AI 工具 | 怎么用 |
|---------|--------|
| **豆包（Doubao Work）** | 已装成 Skill，直接说"帮我把 XXX 写进 WPS 便签"就行 |
| **Claude Code** | 把项目放到工作目录，说"用 wps-agent-kit 帮我写 XXX 到便签"；或放到 `~/.claude/skills/` 自动识别 |
| **Cursor** | 打开项目文件夹，在终端里让 AI 执行 `node scripts/note-write.js --content "XXX"` |
| **Codex / Gemini CLI** | 在项目目录下启动，说"Run note-write.js with content 'XXX'" |
| **其他能跑命令行的 AI** | 告诉 AI 项目路径，让它执行 `node scripts/note-write.js --content "内容"` |

**核心原理**：这个工具就是几个 Node.js 脚本，任何能在你电脑上敲命令行的 AI 都能调用。AI 不需要懂原理，只要执行那条命令就行。

---

## 四、注意事项

### 能用的
- ✅ 写纯文本便签（中文、英文、代码片段都行）
- ✅ 查看最近的便签列表
- ✅ Windows / macOS / Linux 都能用
- ✅ 写好的便签手机端也能看到（云端同步）

### 不能用的
- ❌ **不支持图片、富文本（加粗、列表、颜色）**——只能写纯文本
- ❌ **不能编辑已有便签**——每次都是新建一条
- ❌ **不能删除便签**
- ❌ **手机端 AI 用不了**——脚本跑在电脑上，手机 App 调不到

### 常见问题

**Q: 提示"未检测到登录会话"怎么办？**
A: 跑一次 `node scripts/auth.js` 重新登录。

**Q: 登录后多久会过期？**
A: 一般几周。过期了重新跑 `auth.js` 就行，1 分钟的事。

**Q: macOS / Linux 上报错找不到 Edge 浏览器？**
A: 用文本编辑器打开 `scripts/note-write.js`，把 `channel: 'msedge'` 改成 `channel: 'chrome'`（需要装了 Chrome），或者直接删掉这一行用默认浏览器。`auth.js` 也一样改。

**Q: 这个跟 WPS 笔记官方 MCP 有啥区别？**
A: 官方 MCP 功能更强（支持图片、标签、批量编辑），但必须装 WPS 笔记桌面客户端并保持运行。这个工具不用装桌面端，轻量，只做"写纯文本便签"这一件事，够大多数人用了。

**Q: 安全吗？WPS 账号会不会泄露？**
A: 登录态只存在你本地电脑的浏览器 profile 里，不会上传到任何地方。代码全开源，可以自己审查。没有任何遥测或数据收集。

---

## 五、项目里有什么

```
wps-agent-kit/
├── 快速上手.md          ← 大白话教程（推荐先看这个）
├── README.md            ← 你正在看的这个
├── SKILL.md             ← AI 自动识别用的说明（Claude Code / 豆包等）
├── package.json         ← 项目配置
├── scripts/
│   ├── auth.js          ← 登录 WPS（只需跑一次）
│   ├── note-write.js    ← 写便签（最常用）
│   ├── note-list.js     ← 查看便签列表
│   └── doc-read.js      ← 读 WPS 云文档（需要额外配 API Key，可选）
└── references/
    └── airpage.md       ← AirPage 相关参考（可选阅读）
```

---

## 一句话总结

**clone 下来 → npm install → node scripts/auth.js 登录 → 以后让 AI 跑 node scripts/note-write.js --content "内容" 就行。**

有问题提 Issue，或者直接改代码自己用。
