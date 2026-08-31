#!/usr/bin/env node
/**
 * 读取 WPS 云文档内容 (通过 Agent API Key + V7 内容抽取接口)
 *
 * 前置: 设置环境变量 AGENT_API_KEY (格式: apik:<sk_id>.<secret_key>)
 *
 * 用法:
 *   node scripts/doc-read.js --url "https://www.kdocs.cn/l/xxxxx"
 *   node scripts/doc-read.js --url "https://www.kdocs.cn/l/xxxxx" --format md
 *   node scripts/doc-read.js --url "xxx" --output doc.md
 *
 * 参考: kdocs-summary Skill (WPS V7 内容抽取接口)
 */
const https = require('https');
const fs = require('fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { url: '', format: 'md', output: '', contentFormat: 'markdown' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) { result.url = args[++i]; }
    else if (args[i] === '--format' && args[i + 1]) { result.format = args[++i]; }
    else if (args[i] === '--output' && args[i + 1]) { result.output = args[++i]; }
    else if (args[i] === '--content-format' && args[i + 1]) { result.contentFormat = args[++i]; }
  }
  return result;
}

const { url, format, output, contentFormat } = parseArgs();

if (!url) {
  console.error('用法: node scripts/doc-read.js --url "文档链接" [--format md|txt|json] [--output 文件]');
  process.exit(1);
}

const API_KEY = process.env.AGENT_API_KEY;
if (!API_KEY) {
  console.error('错误: 未设置环境变量 AGENT_API_KEY');
  console.error('');
  console.error('设置方法 (Windows PowerShell):');
  console.error('  [Environment]::SetEnvironmentVariable("AGENT_API_KEY", "apik:xxx.yyy", "User")');
  console.error('  然后重启终端');
  console.error('');
  console.error('设置方法 (macOS/Linux):');
  console.error('  echo \'export AGENT_API_KEY="apik:xxx.yyy"\' >> ~/.zshrc && source ~/.zshrc');
  process.exit(1);
}

// ── HTTP 请求封装 ─────────────────────────────────────────
function request(method, urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      method, hostname: u.hostname, port: u.port || 443,
      path: u.pathname + u.search,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── 提取 link_id ──────────────────────────────────────────
function extractLinkId(u) {
  const clean = u.split('?')[0].split('#')[0].replace(/\/$/, '');
  const m = clean.match(/\/l\/([a-zA-Z0-9]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9]+$/.test(u.trim())) return u.trim();
  throw new Error('无法从 URL 提取 link_id: ' + u);
}

(async () => {
  try {
    // 1. 用 API Key 换 AccessToken
    console.log('正在获取 AccessToken...');
    const tokenResp = await request('POST', 'https://account.wps.cn/api/authorization/agent/v1/token', {
      grant_type: 'api_key', api_key: API_KEY,
    });
    if (tokenResp.body.result !== 'ok') {
      throw new Error('换取 Token 失败: ' + JSON.stringify(tokenResp.body));
    }
    const accessToken = tokenResp.body.data.access_token;
    console.log('✓ Token 获取成功');

    const headers = { Authorization: `Bearer ${accessToken}` };
    const linkId = extractLinkId(url);

    // 2. 获取链接元信息 (drive_id + file_id)
    console.log('正在获取文档信息...');
    const metaResp = await request('GET', `https://openapi.wps.cn/v7/links/${linkId}/meta`, null, headers);
    if (metaResp.body.code !== 0) {
      // openapi 可能未放通，回退 api.wps.cn
      const fallback = await request('GET', `https://api.wps.cn/v7/links/${linkId}/meta`, null, headers);
      if (fallback.body.code !== 0) throw new Error('获取链接信息失败: ' + JSON.stringify(fallback.body));
      var meta = fallback.body.data;
    } else {
      var meta = metaResp.body.data;
    }
    const { drive_id, file_id } = meta;
    const creator = meta.creator?.name || '';
    console.log('✓ drive_id:', drive_id, 'file_id:', file_id);

    // 3. 内容抽取
    console.log('正在抽取文档内容...');
    let contentData = null;
    for (const base of ['https://openapi.wps.cn', 'https://api.wps.cn']) {
      const resp = await request('GET', `${base}/v7/drives/${drive_id}/files/${file_id}/content?format=${contentFormat}`, null, headers);
      if (resp.status < 400 && resp.body.code === 0) {
        contentData = resp.body.data;
        if (base !== 'https://openapi.wps.cn') console.log('  (通过 api.wps.cn 回退获取)');
        break;
      }
    }
    if (!contentData) throw new Error('内容抽取失败');

    const fileName = contentData.file_info?.name || '未命名文档';
    const content = contentData[contentFormat] || contentData.markdown || contentData.plain || '';
    console.log('✓ 文档:', fileName, '内容长度:', content.length, '字符');

    // 4. 输出
    let outputText;
    if (format === 'json') {
      outputText = JSON.stringify({ file_name: fileName, creator, drive_id, file_id, content }, null, 2);
    } else if (format === 'txt') {
      outputText = `文件名: ${fileName}\n创建者: ${creator}\n${'='.repeat(60)}\n\n${content}`;
    } else {
      outputText = `---\n文件名: ${fileName}\n创建者: ${creator}\n---\n\n${content}`;
    }

    if (output) {
      fs.writeFileSync(output, outputText, 'utf-8');
      console.log('✓ 已保存到:', output);
    } else {
      console.log('');
      console.log(outputText);
    }
    process.exit(0);
  } catch (e) {
    console.error('');
    console.error('✗ 读取失败:', e.message);
    process.exit(1);
  }
})();
