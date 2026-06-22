#!/usr/bin/env node
/**
 * 币圈情报系统 - Node.js + ethers.js 版
 * 通过 Ethereum 公开 RPC + DEX 合约读取链上价格数据
 * 同时抓 DexScreener 公开端点
 */

import { ethers } from "ethers";

// ─── 配置 ───────────────────────────────────────────
const ETH_RPC  = "https://ethereum.publicnode.com";
const TOP_N    = 8;
const MIN_LIQ  = 5000; // 最低流动性 USD
// ───────────────────────────────────────────────────

// 常用代币 WETH/USDT 池子 (Uniswap V2)
const WATCHED_POOLS = [
  // (address, 名称, 交易对符号)
];

// 小市值币关注列表 (在 BSC/ETH 上有流动性的)
const SMALL_TOKENS = [
  { address: "0x0d3b2c56b519e6a4c5b0c3c5c0f1c9a6e2d8b4f3", symbol: "PEPE",  name: "Pepe",       chain: "eth" },
  { address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", symbol: "SHIB",  name: "Shiba Inu",  chain: "eth" },
  { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC",  name: "USD Coin",   chain: "eth" },
  { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT",  name: "Tether",      chain: "eth" },
  { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH",  name: "Wrapped Ether", chain: "eth" },
];

// DEX 池子 ABI (最小子集)
const POOL_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function kLast() external view returns (uint256)",
];

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

// ─── 工具函数 ───────────────────────────────────────
function fmtUsd(v) {
  if (v >= 1e12) return `$${(v/1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v/1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3)  return `$${(v/1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// Uniswap V2 池子读取 (WETH-USDT)
async function getTokenPriceVsEth(provider, tokenAddress, poolAddress) {
  // Uniswap V2: reserve0 * 10^(18-decimals) / reserve1 = price
  // 策略: 读池子 reserve，用 ETH 价格换算 token/USD
  try {
    const pool = new ethers.Contract(poolAddress, [
      "function getReserves() view returns (uint112,uint112,uint32)",
      "function token0() view returns (address)",
      "function token1() view returns (address)"
    ], provider);
    const [r0, r1, t0] = await Promise.all([
      pool.getReserves().then(r=>r[0]),
      pool.getReserves().then(r=>r[1]),
      pool.token0()
    ]);
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
    const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7".toLowerCase();
    const addr = tokenAddress.toLowerCase();
    const isT0Weth = t0.toLowerCase() === WETH;
    const isT0Usdt = t0.toLowerCase() === USDT;

    let ethPrice = null;
    if (isT0Weth) ethPrice = Number(ethers.formatUnits(r0, 18)); // WETH in pool
    else if (isT0Usdt) ethPrice = Number(ethers.formatUnits(r0, 6)); // USDT in pool

    return ethPrice;
  } catch { return null; }
}

async function getEthPriceOnChain(provider) {
  // 读 Uniswap V2 ETH-USDT 池子
  // USDT-WETH pool: 0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852
  // token0 = WETH, reserve0 = WETH量, reserve1 = USDT量
  // ETH_price = USDT_reserve / WETH_reserve
  try {
    const pool = new ethers.Contract("0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852", [
      "function getReserves() view returns (uint112,uint112,uint32)",
      "function token0() view returns (address)"
    ], provider);
    const [r0, r1, t0] = await Promise.all([
      pool.getReserves().then(r=>r[0]),
      pool.getReserves().then(r=>r[1]),
      pool.token0()
    ]);
    const isReversed = t0.toLowerCase() === "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const r0num = Number(ethers.formatUnits(r0, 18)); // WETH (18 dec)
    const r1num = Number(ethers.formatUnits(r1, 6));   // USDT (6 dec)
    return isReversed ? r1num / r0num : r1num / r0num;
  } catch(e) {
    // 备用池 BSC BNB-USDT
    return null;
  }
}

// ─── 链上数据读取 ───────────────────────────────────
async function getEthPrice() {
  // 通过读取 ETH/USDT Uniswap V2 池子得到 ETH 价格
  // 池子: USDT-WETH: 0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  try {
    const pool = new ethers.Contract(
      "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852",
      POOL_ABI,
      provider
    );
    const [reserves, token0] = await Promise.all([
      pool.getReserves(),
      pool.token0(),
    ]);
    const isReversed = token0.toLowerCase() === "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // USDT
    const r0 = Number(ethers.formatUnits(reserves.reserve0, 6));  // USDT decimals=6
    const r1 = Number(ethers.formatUnits(reserves.reserve1, 18)); // WETH decimals=18
    const ethPrice = isReversed ? r0 / r1 : r1 / r0;
    return { price: ethPrice, reserve0: r0, reserve1: r1 };
  } catch (e) {
    // 备用: 读另一个池子
    try {
      const pool2 = new ethers.Contract(
        "0xBb2b8038a1640196FbE3e38816F3e67Cba72D940",
        POOL_ABI,
        provider
      );
      const [r, t0] = await Promise.all([pool2.getReserves(), pool2.token0()]);
      const isRev = t0.toLowerCase() === "0xdAC17F958D2ee523a2206206994597C13D831ec7";
      const rr0 = Number(ethers.formatUnits(r.reserve0, 6));
      const rr1 = Number(ethers.formatUnits(r.reserve1, 18));
      return { price: isRev ? rr0/rr1 : rr1/rr0 };
    } catch(e2) {
      return { price: null, error: e2.message };
    }
  }
}

// ─── DexScreener 扫描 ──────────────────────────────
async function scanDexScreener(chain = "solana") {
  // 用正确的搜索端点
  const r = await fetch(
    `https://api.dexscreener.com/v1/search?query=${chain}&chain=${chain}&limit=50`,
    { headers: { "Accept": "application/json" } }
  );
  if (!r.ok) return [];
  const data = await r.json();
  const pairs = (data.pairs || []).filter(p => {
    const liq = parseFloat(p.liquidity?.usd || 0);
    const vol  = parseFloat(p.volume?.h24 || 0);
    return liq >= MIN_LIQ && vol >= 2000;
  });

  return pairs.map(p => {
    const base   = p.baseToken || {};
    const change = p.priceChange || {};
    const txns   = p.txns || {};
    const m5     = txns.m5 || {};
    const h1     = txns.h1 || {};
    const buys   = parseInt(m5.buys  || 0) + parseInt(h1.buys  || 0);
    const sells  = parseInt(m5.sells || 0) + parseInt(h1.sells || 0);
    const c5m  = parseFloat(change.m5  || 0);
    const c1h  = parseFloat(change.h1  || 0);
    const c6h  = parseFloat(change.h6  || 0);
    const c24h = parseFloat(change.h24 || 0);
    const liq   = parseFloat(p.liquidity?.usd  || 0);
    const vol   = parseFloat(p.volume?.h24    || 0);

    const score = (Math.abs(c5m)*3 + Math.abs(c1h)*2.5 + c6h*1.5
                   + (buys/(buys+sells+1))*20
                   + Math.min(vol/50000,10)*2
                   + (c5m>0||c1h>0 ? 5 : 0));

    return {
      symbol:    base.symbol || "??",
      name:      base.name   || base.symbol || "",
      address:   base.address || "",
      chain,
      price:     p.priceUsd || p.priceNative || "0",
      liquidity: liq,
      volume24h: vol,
      mc:        parseFloat(p.marketCap || 0),
      c5m, c1h, c6h, c24h,
      buys, sells,
      score,
      url: `https://dexscreener.com/${chain}/${base.address}`,
    };
  });
}

// ─── 生成报告 ──────────────────────────────────────
async function buildReport() {
  console.log("[*] 开始抓取数据...");

  // 1. ETH 价格
  const ethData = await getEthPrice();
  const ethPrice = ethData.price;
  console.log(`[*] ETH 价格: $${ethPrice}`);

  // 2. 多链 DexScreener
  const chains = ["solana", "base", "ethereum", "avalanche", "bsc"];
  const allCoins = [];

  for (const chain of chains) {
    try {
      console.log(`[*] 扫描 ${chain}...`);
      const coins = await scanDexScreener(chain);
      allCoins.push(...coins);
      console.log(`    -> 找到 ${coins.length} 个候选`);
      await sleep(300);
    } catch(e) {
      console.log(`    [!] ${chain} 出错: ${e.message}`);
    }
  }

  // 排序
  allCoins.sort((a,b) => b.score - a.score);
  const top = allCoins.slice(0, TOP_N);

  // 3. 格式化报告
  const now = new Date();
  const ts  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const lines = [
    `🌙 *币圈埋伏日报* | ${ts}`,
    "━━━━━━━━━━━━━━━━━━━",
    ethPrice ? `📊 *ETH 当前价格:* $${ethPrice.toLocaleString('en-US',{minimumFractionDigits:2})}` : "",
    "",
    top.length ? "🏆 *今日埋伏候选 TOP 8*" : "⚠️ 今日暂未发现明确信号",
  ];

  const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣"];
  for (let i = 0; i < top.length; i++) {
    const c = top[i];
    const m = medals[i] || `${i+1}.`;
    lines.push(
      `${m} *${c.symbol.toUpperCase()}* /\`${c.chain}\``,
      `   📈 5m ${c.c5m>=0?'+':''}${c.c5m.toFixed(1)}% | 1h ${c.c1h>=0?'+':''}${c.c1h.toFixed(1)}% | 24h ${c.c24h>=0?'+':''}${c.c24h.toFixed(1)}%`,
      `   💧 流动性 ${fmtUsd(c.liquidity)} | 📊 24h量 ${fmtUsd(c.volume24h)}`,
      `   🛒 买/卖 5m ${c.buys}/${c.sells}`,
      `   🔗 ${c.url}`,
      ""
    );
  }

  lines.push("━━━━━━━━━━━━━━━━━━━", "⚠️ *DYOR - 以上仅为数据分析，不构成投资建议*");

  return lines.join("\n");
}

// ─── 主入口 ───────────────────────────────────────
(async () => {
  try {
    const report = await buildReport();
    console.log("\n" + "=".repeat(50));
    console.log(report);
    // 保存
    const fs = await import("fs");
    const dir = "/root/.openclaw/workspace/yaobi-monitor/reports";
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().slice(0,16).replace("T","_").replace(":","");
    fs.writeFileSync(`${dir}/${ts}.txt`, report);
    console.log(`\n[✓] 已保存到 ${dir}/${ts}.txt`);
  } catch(e) {
    console.error("[X] 错误:", e.message);
    process.exit(1);
  }
})();
