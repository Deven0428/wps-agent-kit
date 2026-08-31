#!/usr/bin/env node
/**
 * 列出 WPS 新版便签 (ainote.kdocs.cn) 中的笔记
 *
 * 用法:
 *   node scripts/note-list.js              # 默认列出最近 20 条
 *   node scripts/note-list.js --limit 50  # 指定数量
 *   node scripts/note-list.js --json       # JSON 格式输出
 */
const { chromium } = require('playwright');
const os = require('os');
const path = require('path');
const fs = require('fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { limit: 20, json: false, headless: true };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) { result.limit = parseInt(args[++i]); }
    else if (args[i] === '--json') { result.json = true; }
    else if (args[i] === '--headful') { result.headless = false; }
  }
  return result;
}

const { limit, json, headless } = parseArgs();

const PROFILE_DIR = process.env.WPS_PROFILE_DIR ||
  path.join(os.homedir(), '.wps-agent-kit', 'profile');

if (!fs.existsSync(PROFILE_DIR)) {
  console.error('错误: 未找到登录会话，请先运行 node scripts/auth.js');
  process.exit(1);
}

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless, channel: 'msedge', args: ['--no-sandbox'],
  });
  const page = await context.newPage();

  try {
    await page.goto('https://ainote.kdocs.cn/', { timeout: 40000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    // 从主页提取笔记列表
    const notes = await page.evaluate(() => {
      const result = [];
      // WPS 笔记主页的笔记卡片结构：每个笔记有标题、预览、时间
      // 尝试多种选择器
      const cards = document.querySelectorAll('[class*=note-item], [class*=note-card], [class*=list-item]');
      if (cards.length > 0) {
        for (const card of cards) {
          const title = card.querySelector('[class*=title], h3, h4')?.innerText?.trim() || '';
          const preview = card.querySelector('[class*=preview], [class*=content], [class*=desc]')?.innerText?.trim() || '';
          const time = card.querySelector('[class*=time], [class*=date]')?.innerText?.trim() || '';
          if (title || preview) result.push({ title, preview, time });
        }
      }
      // fallback: 从页面文本中按日期分组提取
      if (result.length === 0) {
        const text = document.body.innerText;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        // 简单提取：找日期行后面的标题
        const datePattern = /^(今天|昨天|\d{1,2}\/\d{1,2}|\d{4}年|\d{4}-\d{2}-\d{2})/;
        for (let i = 0; i < lines.length; i++) {
          if (datePattern.test(lines[i]) && lines[i + 1]) {
            result.push({ title: lines[i + 1], preview: '', time: lines[i] });
          }
        }
      }
      return result;
    });

    const limited = notes.slice(0, limit);

    if (json) {
      console.log(JSON.stringify(limited, null, 2));
    } else {
      console.log(`共找到 ${notes.length} 条笔记，显示前 ${limited.length} 条:`);
      console.log('');
      limited.forEach((n, i) => {
        console.log(`${String(i + 1).padStart(2)}. [${n.time || '未知时间'}] ${n.title || '(无标题)'}`);
        if (n.preview) console.log(`    ${n.preview.slice(0, 60)}`);
      });
    }

    await context.close();
    process.exit(0);
  } catch (e) {
    console.error('获取笔记列表失败:', e.message);
    await context.close();
    process.exit(1);
  }
})();
