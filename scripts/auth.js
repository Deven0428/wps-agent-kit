#!/usr/bin/env node
/**
 * WPS 浏览器登录 — 打开有头浏览器，用户手动登录后自动保存会话。
 * 用法: node scripts/auth.js
 * 会话保存到: ~/.wps-agent-kit/profile/  (或环境变量 WPS_PROFILE_DIR)
 */
const { chromium } = require('playwright');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ── 浏览器通道（跨平台）──────────────────────────────────
// Windows 默认 Edge；Linux/macOS 默认 Chromium；可用环境变量 WPS_BROWSER_CHANNEL 覆盖
const _browserChannel = process.env.WPS_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : null);

const PROFILE_DIR = process.env.WPS_PROFILE_DIR ||
  path.join(os.homedir(), '.wps-agent-kit', 'profile');

fs.mkdirSync(PROFILE_DIR, { recursive: true });

(async () => {
  console.log('正在启动浏览器...');
  console.log('会话目录:', PROFILE_DIR);
  console.log('');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    ...( _browserChannel ? { channel: _browserChannel } : {}),
    args: ['--no-sandbox', '--start-maximized'],
  });

  const page = context.pages()[0] || await context.newPage();

  // 先打开 WPS 笔记主页，未登录会自动跳登录页
  await page.goto('https://ainote.kdocs.cn/', { waitUntil: 'domcontentloaded' });

  console.log('========================================');
  console.log('  请在弹出的浏览器中完成 WPS 登录');
  console.log('  登录成功后，脚本会自动检测并保存会话');
  console.log('  (也可以直接关闭浏览器，会话已保存)');
  console.log('========================================');
  console.log('');

  // 轮询检测登录状态：页面出现用户名/笔记列表即视为登录成功
  let loggedIn = false;
  for (let i = 0; i < 300; i++) {  // 最多等 5 分钟
    await page.waitForTimeout(2000);
    try {
      const text = await page.evaluate(() => document.body ? document.body.innerText : '');
      // 检测登录特征：出现"新建笔记"、"全部笔记"、用户名等
      if (/新建笔记|全部笔记|主页|随心记录/.test(text)) {
        loggedIn = true;
        break;
      }
      // 检测 URL 是否已经进入应用
      const url = page.url();
      if (/kdocs\.cn\/l\/.+/.test(url) && !/login|passport|account/.test(url)) {
        // 再确认一下页面内容
        if (text.length > 100) {
          loggedIn = true;
          break;
        }
      }
    } catch (e) { /* page might be navigating */ }
  }

  if (loggedIn) {
    console.log('');
    console.log('✓ 检测到登录成功！');
    console.log('✓ 会话已保存到:', PROFILE_DIR);
    console.log('');
    console.log('现在可以使用:');
    console.log('  node scripts/note-write.js --content "你要写的内容"');
    console.log('  node scripts/note-list.js');
    // 等 2 秒让会话完全写入，然后关闭
    await page.waitForTimeout(2000);
    await context.close();
    process.exit(0);
  } else {
    console.log('');
    console.log('⚠ 超时未检测到登录成功。');
    console.log('会话可能已部分保存，你可以:');
    console.log('  1. 直接关闭浏览器，然后重新运行本脚本');
    console.log('  2. 检查网络后重试');
    await context.close();
    process.exit(1);
  }
})().catch(e => {
  console.error('登录流程出错:', e.message);
  process.exit(1);
});
