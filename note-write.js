#!/usr/bin/env node
/**
 * 写入 WPS 新版便签 (ainote.kdocs.cn)
 *
 * 用法:
 *   node scripts/note-write.js --content "要写的内容"
 *   echo "内容" | node scripts/note-write.js
 *   node scripts/note-write.js --content "内容" --title "标题"
 *   node scripts/note-write.js --content "内容" --image "C:\图片1.png" --image "C:\图片2.jpg"
 *
 * 原理: 用已保存的浏览器会话打开 ainote.kdocs.cn → 新建笔记 →
 *       点击编辑区 → 键盘输入(虚拟输入框编辑器必须用键盘) →
 *       [可选] 通过隐藏的 <input type=file> 上传图片 → 等自动保存 → 验证
 */
const { chromium } = require('playwright');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ── 参数解析 ──────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { content: '', title: '', images: [], headless: true };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--content' && args[i + 1]) { result.content = args[++i]; }
    else if (args[i] === '--title' && args[i + 1]) { result.title = args[++i]; }
    else if (args[i] === '--image' && args[i + 1]) { result.images.push(args[++i]); }
    else if (args[i] === '--headful') { result.headless = false; }
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('用法: node scripts/note-write.js --content "内容" [--title "标题"] [--image "图片路径"] [--headful]');
      process.exit(0);
    }
  }
  // 如果没传 --content，尝试从 stdin 读
  if (!result.content && !process.stdin.isTTY) {
    // 同步读 stdin
    try {
      result.content = fs.readFileSync(0, 'utf-8').trim();
    } catch (e) { /* no stdin */ }
  }
  return result;
}

const { content, title, images, headless } = parseArgs();

if (!content && images.length === 0) {
  console.error('错误: 请提供内容或图片。用法: node scripts/note-write.js --content "要写的内容" [--image "图片路径"]');
  process.exit(1);
}

// 检查图片文件是否存在
for (const img of images) {
  if (!fs.existsSync(img)) {
    console.error('错误: 图片文件不存在:', img);
    process.exit(1);
  }
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
  console.log('内容长度:', content.length, '字符');
  if (images.length > 0) console.log('图片数量:', images.length);
  console.log('正在打开 WPS 笔记...');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    channel: 'msedge',
    args: ['--no-sandbox'],
  });
  const page = await context.newPage();

  try {
    // 1. 打开 WPS 笔记主页
    await page.goto('https://ainote.kdocs.cn/', { timeout: 40000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    // 检查是否登录
    const pageText = await page.evaluate(() => document.body ? document.body.innerText : '');
    if (!/新建笔记|全部笔记|随心记录/.test(pageText)) {
      throw new Error('未检测到登录状态，请先运行 node scripts/auth.js');
    }
    console.log('✓ 已登录，进入主页');

    // 2. 点击"新建笔记"
    const clickedNew = await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, [role=button], div, span, a')];
      const el = els.find(e => (e.textContent || '').trim() === '新建笔记' && e.offsetParent !== null);
      if (el) { el.click(); return true; }
      return false;
    });
    if (!clickedNew) throw new Error('未找到"新建笔记"按钮');
    console.log('✓ 点击新建笔记');
    await page.waitForTimeout(4000);

    const noteUrl = page.url();
    console.log('  新笔记 URL:', noteUrl);

    // 3. 定位编辑区并点击聚焦
    const editorPos = await page.evaluate(() => {
      const vi = document.querySelector('[class*=virtual-input], [class*=editor-wrap]');
      if (!vi) return null;
      let el = vi;
      for (let i = 0; i < 6; i++) {
        el = el.parentElement;
        if (!el) break;
        if (el.offsetParent !== null && el.getBoundingClientRect().height > 100) {
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + 80 };
        }
      }
      return null;
    });

    if (editorPos) {
      await page.mouse.click(editorPos.x, editorPos.y);
    } else {
      await page.mouse.click(600, 350); // fallback
    }
    await page.waitForTimeout(800);
    console.log('✓ 编辑区已聚焦');

    // 4. 如果指定了标题，先写标题（按 Tab 跳到正文）
    if (title) {
      await page.keyboard.type(title, { delay: 30 });
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }

    // 5. 键盘输入正文（虚拟输入框编辑器必须用键盘，DOM 注入不生效）
    if (content) {
      await page.keyboard.type(content, { delay: 20 });
      console.log('✓ 内容已输入');
    }

    // 5.5 上传图片（如果有）
    if (images.length > 0) {
      await page.waitForTimeout(500);
      for (let i = 0; i < images.length; i++) {
        // 回车换行，让图片在下一行
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        // 定位图片 file input（accept 含 .png 的那个）
        const imgInputId = `wps-img-upload-${i}`;
        const found = await page.evaluate((id) => {
          const inputs = [...document.querySelectorAll('input[type=file]')];
          const imgInput = inputs.find(inp => (inp.accept || '').toLowerCase().includes('.png'));
          if (imgInput) { imgInput.setAttribute('id', id); return true; }
          return false;
        }, imgInputId);
        if (!found) throw new Error('未找到图片上传输入框');

        await page.locator(`#${imgInputId}`).setInputFiles(images[i]);

        // 轮询等待图片出现
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
    await page.waitForTimeout(6000);

    // 7. 验证：回到主页检查笔记列表
    await page.goto('https://ainote.kdocs.cn/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    const verifyText = await page.evaluate(() => document.body ? document.body.innerText : '');

    // 用内容前 20 字符做匹配（中文可能被截断显示）
    const checkStr = (title || content).slice(0, 15).replace(/\s+/g, '');
    const verifyClean = verifyText.replace(/\s+/g, '');
    const saved = verifyClean.includes(checkStr);

    console.log('');
    if (saved) {
      console.log('========================================');
      console.log('  ✓ 写入成功！已验证保存到云端');
      console.log('========================================');
      console.log('笔记标题:', title || '(未命名，取正文前若干字)');
      console.log('内容预览:', content.slice(0, 50) + (content.length > 50 ? '...' : ''));
      console.log('笔记 URL:', noteUrl);
    } else {
      console.log('========================================');
      console.log('  ⚠ 内容已输入，但验证时未在列表中找到');
      console.log('  可能原因: 保存延迟、内容过长被截断显示、或登录态异常');
      console.log('  建议: 手动打开 ainote.kdocs.cn 确认');
      console.log('========================================');
    }

    await context.close();
    process.exit(saved ? 0 : 1);
  } catch (e) {
    console.error('');
    console.error('✗ 写入失败:', e.message);
    await context.close();
    process.exit(1);
  }
})();
