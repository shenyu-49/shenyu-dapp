#!/usr/bin/env node
/**
 * 币圈情报浏览器搜索脚本 v2
 * 可用网站: cryptopanic(部分), defillama, l2beat, coinmarketcap 等
 * 策略: 多源抓取，任一成功即可
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';

const BROWSER = '/root/.local/share/pnpm/agent-browser';
const SESSION = 'crypto-news-' + Date.now();
const REPORT_DIR = '/root/.openclaw/workspace/yaobi-monitor/reports';

function ab(args, timeout = 20000) {
  try {
    const cmd = `${BROWSER} --session ${SESSION} ${args}`;
    return execSync(cmd, { encoding: 'utf8', timeout: timeout/1000, maxBuffer: 1024*512 });
  } catch (e) { return e.stdout || ''; }
}

function abJson(args, timeout = 20000) {
  const out = ab(args, timeout);
  try { return JSON.parse(out); } catch { return null; }
}

function close() { ab('close', 5000); }

async function getPageText(scope = 'body') {
  const out = ab(`snapshot -i -s "${scope}" --json`, 15000);
  const data = abJson(`snapshot -i -s "${scope}" --json`, 15000);
  if (!data || !data.elements) return '';
  return data.elements.map(e => e.text || '').join('\n');
}

async function searchCryptoNews() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const results = { mode: 'daily', ts: new Date().toISOString(), items: [] };
  const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour:'2-digit', minute:'2-digit' });

  // 策略1: Google 新闻搜索
  const queries = [
    { q: 'cryptocurrency news today', label: '🔍 Google新闻' },
    { q: 'bitcoin ethereum solana price prediction', label: '📈 行情分析' },
    { q: 'crypto airdrop new token 2024', label: '🎁 空投机会' },
    { q: 'DeFi protocol news new listing', label: '🏦 DeFi动态' },
  ];

  for (const { q, label } of queries) {
    try {
      close();
      const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en`;
      const open = ab(`open "${url}" --timeout 12000`, 15000);
      if (!open.includes('✓') && !open.includes('https://')) continue;
      
      ab('wait 2000');
      const text = await getPageText('#search');
      const lines = text.split('\n').filter(l => l.trim().length > 20 && l.length < 300);
      
      for (const line of lines.slice(0, 5)) {
        results.items.push({ source: label, text: line.trim().slice(0, 250) });
      }
    } catch(e) {}
  }

  // 策略2: 直接访问加密新闻站
  const sites = [
    { url: 'https://cointelegraph.com', label: '📰 Cointelegraph' },
    { url: 'https://decrypt.co',        label: '📰 Decrypt' },
    { url: 'https://theblock.co',       label: '📰 The Block' },
  ];

  for (const { url, label } of sites) {
    try {
      close();
      const open = ab(`open "${url}" --timeout 10000`, 12000);
      if (!open.includes('✓')) continue;
      ab('wait 3000');
      const text = await getPageText('body');
      const lines = text.split('\n')
        .filter(l => l.length > 30 && (l.includes('$') || l.includes('%') || l.includes('+')))
        .slice(0, 3);
      for (const line of lines) {
        results.items.push({ source: label, text: line.trim().slice(0, 250) });
      }
    } catch(e) {}
  }

  // 去重+格式化
  const seen = new Set();
  const unique = results.items.filter(i => {
    const key = i.text.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  const lines = [
    `🌐 *币圈情报速报* | ${ts}`,
    "━━━━━━━━━━━━━━━━━━━",
    unique.length ? '' : '⚠️ 当前网络无法访问新闻源，以下为链上数据补充：',
  ];

  for (const item of unique.slice(0, 10)) {
    lines.push(`${item.source}: ${item.text}`);
  }

  lines.push('', '━━━━━━━━━━━━━━━━━━━', '⚠️ DYOR，不构成投资建议');

  const report = lines.join('\n');
  const ts2 = new Date().toISOString().slice(0,16).replace('T','_').replace(':','');
  writeFileSync(`${REPORT_DIR}/news_${ts2}.txt`, report);
  writeFileSync(`${REPORT_DIR}/raw_news_${ts2}.json`, JSON.stringify(results, null, 2));

  close();
  return report;
}

// 直接运行
(async () => {
  try {
    const report = await searchCryptoNews();
    console.log('\n' + '='.repeat(50));
    console.log(report);
    console.log('\n[✓] 完成');
  } catch(e) {
    console.error('[X]', e.message);
    close();
    process.exit(1);
  }
})();
