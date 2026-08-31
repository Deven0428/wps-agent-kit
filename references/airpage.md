# WPS AirPage 文档操作参考

> 本项目 (wps-agent-kit) 聚焦新版便签读写和云文档读取。
> 如需**创建 / 编辑 WPS AirPage 智能文档**（块级操作、表格、图片、评论），
> 请使用独立的 **wps-airpage** skill。

## wps-airpage 能力清单

| 能力 | 命令 |
|------|------|
| 检查 / 刷新凭据 | `node scripts/cli.js auth` / `auth --browser` |
| 搜索文档 | `node scripts/cli.js search <关键词>` |
| 新建文档 | `node scripts/cli.js new-doc --name <名称>` |
| 插入 Markdown | `node scripts/cli.js insert-markdown <file_id> --content "..." --pos end` |
| 查询块结构 | `node scripts/cli.js query <file_id> [block_id]` |
| 查看目录 | `node scripts/cli.js outline <file_id>` |
| 更新块 | `node scripts/cli.js update <file_id> --body '[{...}]'` |
| 插入块 | `node scripts/cli.js insert <file_id> --block-id <id> --index <n> --content <json>` |
| 上传图片 | `node scripts/cli.js upload-image <file_id> <path>` |
| 评论操作 | `node scripts/cli.js comments <file_id>` / `comment-add` |

## 鉴权方式

wps-airpage 使用 **Cookie + CSRF Token** 鉴权：
- 凭据存储: `~/.claude/secrets/wps365.json`
- 浏览器会话: `~/.claude/secrets/wps-airpage-profile/`
- `wps_sid` 是 HttpOnly cookie，需从网络请求头读取
- CSRF token 在 AirPage 编辑页的 `window.__WPSENV__.csrf_token` 中
- 凭据超过 8 小时建议刷新

## 关键坑点

1. **`outline` 对新建文档有索引延迟**: 验证写入结果用 `query`，不用 `outline`。
2. **`update --body` 必须是数组**: 即使只更新一个块，也要用 `'[{...}]'`。
3. **inline 文本字段是 `content` 不是 `text`**: `{ "content": [...] }`。
4. **`rangeMarkBegin` / `rangeMarkEnd` 不是真实块**: 计算 insert index 时跳过。
5. **`insert --index` 必须 >= 1**: title 固定在 index 0。

## 获取 wps-airpage

在 Claude Code / Cursor / Doubao Work 中搜索安装 "wps-airpage" skill，
或从其官方仓库克隆。
