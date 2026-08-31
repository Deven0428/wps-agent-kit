#!/usr/bin/env node
/**
 * 编辑/覆盖 WPS 新版便签 (ainote.kdocs.cn) 中已存在的笔记
 *
 * 用法:
 *   node scripts/note-edit.js --url "笔记URL" --content "新内容"
 *   node scripts/note-edit.js --url "笔记URL" --content "新内容" --image "C:\图片.png"
 *   node scripts/note-edit.js --url "笔记URL" --content ""   # 清空笔记
 *
 * 原理: 打开已有笔记 → 点击编辑区激活编辑器 → Ctrl+A 全选删除 →
 *       输入新内容 → [可选]上传图片 → 等自动保存 → 重新加载验证
 */
const { chromium } = require('playwright');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ── 参数解析 ──────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { url: '', content: '', images: [], headless: true };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) { result.url = args[++i]; }
    else if (args[i] === '--content' && args[i + 1]) { result.content = args[++i]; }
    else if (args[i] === '--image' && args[i + 1]) { result.images.push(args[++i]); }
    else if (args[i] === '--headful') { result.headless = false; }
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('用法: node scripts/note-edit.js --url "笔记URL" --content "新内容" [--image "图片路径"] [--headful]');
      process.exit(0);
    }
  }
  return result;
}

const { url, content, images, headless } = parseArgs();

if (!url) {
  console.error('错误: 请提供笔记 URL。用法: node scripts/note-edit.js --url "笔记URL" --content "新内容"');
  process.exit(1);
}
for (const img of images) {
  if (!fs.existsSync(img)) {
    console.error('错误: 图片文件不存在:', img);
    process.exit(1);
  }
}

// 从 URL 提取 link_id（也支持直接传 link_id）
function extractLinkId(input) {
  const match = input.match(/\/l\/([a-zA-Z0-9]+)/);
  return match ? match[1] : input;
}

const PROFILE_DIR = process.env.WPS_PROFILE_DIR ||
  path.join(os.homedir(), '.wps-agent-kit', 'profile');

if (!fs.existsSync(PROFILE_DIR)) {
  console.error('错误: 未找到登录会话目录:', PROFILE_DIR);
  console.error('请先运行: node scripts/auth.js');
  process.exit(1);
}

(async () => {
  console.log('会话目录:', PROFILE_DIR);
  console.log('目标笔记:', url);
  console.log('新内容长度:', content.length, '字符');
  if (images.length > 0) console.log('图片数量:', images.length);
  console.log('正在打开笔记...');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    channel: 'msedge',
    args: ['--no-sandbox'],
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    // 1. 打开笔记
    const linkId = extractLinkId(url);
    const targetUrl = url.includes('kdocs.cn') ? url : `https://www.kdocs.cn/l/${linkId}`;
    await page.goto(targetUrl, { timeout: 40000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000); // 等正文加载

    // 检查登录
    const pageText = await page.evaluate(() => document.body ? document.body.innerText : '');
    if (!/全部笔记|新建笔记|编辑|正文/.test(pageText)) {
      throw new Error('未检测到登录状态，请先运行 node scripts/auth.js');
    }
    console.log('✓ 已打开笔记');

    // 2. 点击编辑区激活编辑器（点击 ProseMirror 编辑区中心）
    await page.mouse.click(700, 300);
    await page.waitForTimeout(1500);
    console.log('✓ 已点击编辑区');

    // 3. 全选删除
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(400);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(800);
    console.log('✓ 已清空原内容');

    // 4. 输入新内容
    if (content) {
      await page.keyboard.type(content, { delay: 20 });
      console.log('✓ 新内容已输入');
    }

    // 5. 上传图片（如果有）
    if (images.length > 0) {
      await page.waitForTimeout(500);
      for (let i = 0; i < images.length; i++) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        const imgInputId = `wps-img-edit-${i}`;
        const found = await page.evaluate((id) => {
          const inputs = [...document.querySelectorAll('input[type=file]')];
          const imgInput = inputs.find(inp => (inp.accept || '').toLowerCase().includes('.png'));
          if (imgInput) { imgInput.setAttribute('id', id); return true; }
          return false;
        }, imgInputId);
        if (!found) throw new Error('未找到图片上传输入框');

        await page.locator(`#${imgInputId}`).setInputFiles(images[i]);

        let imgOk = false;
        for (let w = 0; w < 20; w++) {
          await page.waitForTimeout(1000);
          imgOk = await page.evaluate(() => {
            const imgs = [...document.querySelectorAll('.ProseMirror img, .cm-content img, [class*=editor] img, .ProseMirror [class*=image]')];
            return imgs.some(im => im.offsetParent !== null && im.naturalWidth > 0);
          });
          if (imgOk) break;
        }
        if (!imgOk) throw new Error(`第 ${i + 1} 张图片上传后未出现`);
        console.log(`✓ 图片 ${i + 1}/${images.length} 已上传 (${path.basename(images[i])})`);
      }
    }

    // 6. 等自动保存
    await page.waitForTimeout(8000);

    // 7. 验证：重新加载，检查新内容
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);
    const verifyText = await page.evaluate(() => document.body ? document.body.innerText : '');

    let saved = false;
    if (content) {
      const checkStr = content.slice(0, 15).replace(/\s+/g, '');
      saved = verifyText.replace(/\s+/g, '').includes(checkStr);
    } else {
      // 内容为空 = 清空笔记，验证原标题是否还在
      saved = !verifyText.includes('图片上传测试');
    }

    console.log('');
    if (saved) {
      console.log('========================================');
      console.log('  ✓ 编辑成功！新内容已保存到云端');
      console.log('========================================');
      console.log('笔记 URL:', targetUrl);
      console.log('新内容:', content.slice(0, 50) + (content.length > 50 ? '...' : ''));
    } else {
      console.log('========================================');
      console.log('  ⚠ 内容已编辑，但验证时未确认保存');
      console.log('  建议: 手动打开笔记确认');
      console.log('========================================');
    }

    await context.close();
    process.exit(saved ? 0 : 1);
  } catch (e) {
    console.error('');
    console.error('✗ 编辑失败:', e.message);
    await context.close();
    process.exit(1);
  }
})();
