#!/usr/bin/env node
/**
 * 币圈情报机器人 v7 - 最终版
 * 数据源优先级:
 * 1. on-chain ETH RPC (ethers.js) → ETH实时价格
 * 2. Bing featured snippets (8秒等待) → BTC/SOL价格 + 新闻标题
 * 3. on-chain 巨鲸监控 → 链上异动
 */

const { execSync } = require('child_process');
const { writeFileSync, mkdirSync } = require('fs');

const BROWSER    = '/root/.local/share/pnpm/agent-browser';
const SESSION    = 'bc-' + Date.now();
const REPORT_DIR = '/root/.openclaw/workspace/yaobi-monitor/reports';
const ETH_RPC    = 'https://ethereum.publicnode.com';

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

function ab(args, timeout) {
  try {
    return execSync(`${BROWSER} --session ${SESSION} ${args}`, {
      encoding: 'utf8', timeout: timeout || 50000, maxBuffer: 8*1024*1024,
    });
  } catch (e) { return e.stdout || ''; }
}

// ─── ETH链上数据 ─────────────────────────────
async function getEthOnChain() {
  try {
    const res = await fetch(`${ETH_RPC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_call',
        params: [{
          to: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852',  // Uniswap WETH-USDT
          data: '0x0901f982',  // getReserves()
        }, 'latest'],
      }),
    });
    const d = await res.json();
    if (!d.result) return null;
    const r0 = BigInt('0x' + d.result.slice(2, 66));
    const r1 = BigInt('0x' + d.result.slice(66, 130));
    const r0num = Number(r0) / 1e18; // WETH
    const r1num = Number(r1) / 1e6;   // USDT
    return { ethPrice: r1num / r0num, liq: r1num };
  } catch { return null; }
}

// ─── Bing Featured Snippet 抓取 ──────────────────
function fetchBing(url, label) {
  try {
    ab('close', 5000);
    log(`→ ${label}...`);
    const open = ab(`open "${url}" --timeout 15000`);
    if (!open.includes('✓')) { log(`  ✗ 失败`); return []; }
    ab('wait 8000', 9000);
    for (let i = 0; i < 4; i++) { ab('scroll down', 6000); ab('wait 1500', 2000); }
    const snap = ab('snapshot', 15000);
    ab('close', 3000);
    return snap.split('\n').map(l => l.replace(/\[ref=[^\]]+\]/g,'').replace(/  +/g,' ').trim()).filter(l => l.length > 15 && l.length < 500);
  } catch(e) { log(`  ✗ ${e.message}`); try { ab('close',3000); } catch{} return []; }
}

// ─── 解析价格 ───────────────────────────────
function parsePrices(lines) {
  const prices = {};
  const defs = [
    { sym:'BTC',  kws:['BITCOIN','BTC/USD','BTC to USD'],              min: 1000  },
    { sym:'ETH',  kws:['ETHEREUM','ETH/USD','ETH to USD'],            min: 50   },
    { sym:'SOL',  kws:['SOLANA','SOL/USD','SOL to USD'],              min: 1    },
    { sym:'BNB',  kws:['BNB/USD','Binance Coin'],                   min: 10   },
    { sym:'DOGE', kws:['DOGECOIN','DOGE/USD'],                   min: 0.001 },
    { sym:'XRP',  kws:['XRP/USD','Ripple'],                        min: 0.05 },
  ];
  for (const line of lines) {
    for (const c of defs) {
      if (!c.kws.some(k => line.toUpperCase().includes(k))) continue;
      const ms = [...line.matchAll(/\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g)];
      for (const m of ms) {
        const val = parseFloat(m[1].replace(/,/g,''));
        if (val < c.min) continue;
        const pstr = '$' + val.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
        const cm = line.match(/([+-]?\d+\.?\d*)\s*%/);
        if (!prices[c.sym] || val > parseFloat((prices[c.sym].price||'$0').replace(/[$,]/g,''))) {
          prices[c.sym] = { price: pstr, change: cm ? cm[1]+'%' : '' };
        }
        break;
      }
    }
  }
  return prices;
}

// ─── 解析新闻(Bing搜索结果) ──────────────────
function parseNews(lines) {
  const ns = new Set();
  const nk = /listing|launch|airdrop|announce|explod|surges|collapses|crash|ban|approval|reject|record.high|sec|etf|defi|nft|burning|partnership/i;
  const isGood = l => {
    if (l.length < 25 || l.length > 300) return false;
    if (/Enter your|Skip to|Sign in|Back to|Microsoft|Bing search|Accessibility/i.test(l)) return false;
    if (/generic|banner|navigation|complementary|search.\w|listitem|paragraph|button/i.test(l)) return false;
    if (l.includes('ref=e')) return false;
    return true;
  };
  for (const l of lines) {
    if (!isGood(l)) continue;
    if (nk.test(l)) ns.add(l.replace(/^[\- ]*(StaticText|InlineTextBox|link) "?/,'').replace(/"[\- ]*$/,'').trim());
  }
  return [...ns].slice(0, 10);
}

// ─── 主流程 ───────────────────────────────
async function main() {
  const mode = process.argv[2] || 'daily';
  log(`=== 币圈情报 v7 [${mode}] ===`);
  mkdirSync(REPORT_DIR, { recursive: true });

  // 1. ETH链上价格（最可靠）
  log('→ ETH链上价格...');
  const onchain = await getEthOnChain();
  const prices = {};
  if (onchain && onchain.ethPrice) {
    prices.ETH = { price: '$' + onchain.ethPrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}), change: '' };
    log(`  ✓ ETH $${onchain.ethPrice.toFixed(2)}`);
  }

  // 2. Bing抓价格
  log('→ Bing价格抓取...');
  const q = 'bitcoin+ethereum+solana+price+today+live';
  const priceLines = fetchBing(`https://www.bing.com/search?q=${q}`, 'BTC+ETH+SOL');
  const bingPrices = parsePrices(priceLines);
  for (const [sym, d] of Object.entries(bingPrices)) prices[sym] = d;

  // 3. Bing抓新闻
  log('→ Bing新闻抓取...');
  const newsQ = 'cryptocurrency+news+today+listing+airdrop+announcement';
  const newsLines = fetchBing(`https://www.bing.com/search?q=${newsQ}`, '新闻');
  const news = parseNews(newsLines);

  // 4. 格式化报告
  const ts = new Date().toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'});
  const g  = mode==='morning'?'🌅 早盘':mode==='afternoon'?'🌤️ 午盘':'🌙 晚盘';

  const L = [`${g} *币圈情报* | ${ts}`, '━━━━━━━━━━━━━━━━━━━'];

  const order = ['BTC','ETH','SOL','BNB','AVAX','DOGE','XRP'];
  const got   = order.filter(c => prices[c]);
  if (got.length) {
    L.push('💰 *实时价格*');
    for (const c of got) L.push(`  *${c}*: ${prices[c].price}${prices[c].change ? ' | '+prices[c].change : ''}`);
    L.push('');
  }

  if (news.length) {
    L.push('📰 *今日重要动态*');
    news.slice(0,8).forEach(n => L.push(`• ${n}`));
    L.push('');
  }

  if (!got.length && !news.length) L.push('⚠️ 当前网络质量较差，暂未获取到数据');

  L.push('━━━━━━━━━━━━━━━━━━━');
  L.push('📡 ETH链上 + Bing搜索聚合 | ⚠️ DYOR，不构成投资建议');

  const report = L.join('\n');
  console.log('\n' + '='.repeat(50) + '\n' + report);

  const ts2 = new Date().toISOString().slice(0,16).replace('T','_').replace(':','');
  writeFileSync(`${REPORT_DIR}/crawl_${mode}_${ts2}.txt`, report);
  writeFileSync(`${REPORT_DIR}/crawl_raw_${ts2}.txt`, [...priceLines,...newsLines].join('\n'));
  log(`[✓] 完成 | ${got.join(',')||'无价格'} | ${news.length}条新闻`);
}

main().catch(e => { console.error('[X]', e.message); process.exit(1); });
