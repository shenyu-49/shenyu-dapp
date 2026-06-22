#!/usr/bin/env node
/**
 * 以太坊链上监控系统 - Node.js + ethers.js
 * 服务器唯一能访问的外部API：ethereum.publicnode.com
 * 功能：读取 DEX 池子 + 追踪巨鲸钱包 + 链上Gas + Mempool
 */

import { ethers } from 'ethers';

// ─── 配置 ───────────────────────────────────────────
const ETH_RPC    = 'https://ethereum.publicnode.com';
const provider   = new ethers.JsonRpcProvider(ETH_RPC);

// Uniswap V2 经典池子
const POOLS = {
  'WETH-USDT':  '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852',
  'WETH-USDC':  '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
  'WETH-DAI':   '0xA478c2975Ab1Ea89e8196811F51A7B7Ad1334BAB',
  'WBTC-ETH':   '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940',
  'SHIB-USDT':  '0x55d398326f99059fF775485246999027B3197955', // BSC USDT (BEP20)
};

// 巨鲸地址列表 (ENS + 地址)
const WHALES = [
  { addr: '0x28C6c06298d514Db089934071355E5743bf21d60', label: 'Binance热钱包' },
  { addr: '0x21a31Ee1afC51d94C2efCCa2092aD1028285549D', label: 'Binance 2' },
  { addr: '0x56EDDB7aa8758c7E4C5F4e6E8eF82888979E47D5', label: 'Alameda相关' },
  { addr: '0x21a31Ee1afC51d94C2efCCa2092aD1028285549D', label: 'Binance 3' },
  { addr: '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE', label: 'Gemini' },
  { addr: '0x0A869d79a7052C7F1b55a8ebabBea3420f0d1e13', label: 'Kraken' },
  { addr: '0x267be1C1D684F78cb4F6a176c4911b741E4ffDC0', label: 'Bitfinex' },
  { addr: '0xbf79376d5D0492D2D89B2c7942B11dE3F6686fED', label: 'SushiSwap部署' },
];

// 高流动性质押池 (Convex, Lido 相关)
const PROTOCOLS = {
  'Lido':       '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  'Curve-DUO':  '0xE8b298C4De8a4Ae2507A4BB1b34Cb59C40344387',
  'Uniswap-DAO':'0x5f4eC3Df9cbd43714FE2740f5E3617235d988429',
};

// ─── 工具 ───────────────────────────────────────────
function fmt(v, dec = 2) {
  if (v === null || v === undefined || isNaN(v)) return 'N/A';
  if (Math.abs(v) >= 1e9)  return `$${(v/1e9).toFixed(dec)}B`;
  if (Math.abs(v) >= 1e6)  return `$${(v/1e6).toFixed(dec)}M`;
  if (Math.abs(v) >= 1e3)  return `$${(v/1e3).toFixed(dec)}K`;
  return `$${v.toFixed(dec)}`;
}
function fmtNum(v, dec = 2) {
  if (v === null || v === undefined || isNaN(v)) return 'N/A';
  if (Math.abs(v) >= 1e9)  return `${(v/1e9).toFixed(dec)}B`;
  if (Math.abs(v) >= 1e6)  return `${(v/1e6).toFixed(dec)}M`;
  if (Math.abs(v) >= 1e3)  return `${(v/1e3).toFixed(dec)}K`;
  return `${v.toFixed(dec)}`;
}

async function getBlockNumber() {
  return await provider.getBlockNumber();
}

// ─── 1. ETH 实时价格（读 Uniswap V2 池子）────────────
async function getEthPrice() {
  try {
    const pool = new ethers.Contract(POOLS['WETH-USDT'], [
      'function getReserves() view returns (uint112,uint112,uint32)',
      'function token0() view returns (address)'
    ], provider);
    const [r0, r1, t0] = await Promise.all([
      pool.getReserves().then(r=>r[0]),
      pool.getReserves().then(r=>r[1]),
      pool.token0()
    ]);
    // token0 = WETH, USDT reserve = r1 (6 dec)
    const ethPrice = Number(ethers.formatUnits(r1, 6)) / Number(ethers.formatUnits(r0, 18));
    return { price: ethPrice, r0: Number(ethers.formatUnits(r0,18)), r1: Number(ethers.formatUnits(r1,6)) };
  } catch(e) {
    return { price: null, error: e.message };
  }
}

// ─── 2. 流动性池子状态 ──────────────────────────────
async function getPoolData(label, addr) {
  try {
    const pool = new ethers.Contract(addr, [
      'function getReserves() view returns (uint112,uint112,uint32)',
      'function token0() view returns (address)',
      'function token1() view returns (address)',
      'function totalSupply() view returns (uint256)',
    ], provider);
    const [r0, r1, ts, t0, t1] = await Promise.all([
      pool.getReserves().then(r=>r[0]),
      pool.getReserves().then(r=>r[1]),
      pool.totalSupply(),
      pool.token0(),
      pool.token1()
    ]);
    const supply = Number(ethers.formatUnits(ts, 18));
    return {
      label,
      token0: t0, token1: t1,
      reserve0: Number(ethers.formatUnits(r0, 18)),
      reserve1: Number(ethers.formatUnits(r1, 18)),
      totalSupply: supply,
    };
  } catch(e) {
    return { label, error: e.message };
  }
}

// ─── 3. 巨鲸钱包追踪 ────────────────────────────────
async function getWhaleBalances() {
  const ERC20_BALANCE = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
  ];
  const ETH_BALANCE  = 'function getBalance(address) view returns (uint256)';
  
  // WETH, USDT, USDC, WBTC
  const TOKENS = {
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  };
  
  const results = [];
  for (const whale of WHALES) {
    try {
      const ethBal = await provider.getBalance(whale.addr);
      const ethVal = Number(ethers.formatEther(ethBal));
      
      const tokenBals = {};
      for (const [sym, addr] of Object.entries(TOKENS)) {
        try {
          const tok = new ethers.Contract(addr, ERC20_BALANCE, provider);
          const [bal, dec] = await Promise.all([
            tok.balanceOf(whale.addr),
            tok.decimals()
          ]);
          tokenBals[sym] = Number(ethers.formatUnits(bal, dec));
        } catch {}
      }
      
      if (ethVal > 0.1 || Object.values(tokenBals).some(v => v > 100)) {
        results.push({ ...whale, ethBal: ethVal, tokens: tokenBals });
      }
    } catch(e) {}
  }
  return results;
}

// ─── 4. 区块 + Gas 状态 ─────────────────────────────
async function getChainStatus() {
  try {
    const blockNum = await provider.getBlockNumber();
    const block    = await provider.getBlock(blockNum);
    const feeData  = await provider.getFeeData();
    
    const gasPrice = Number(ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'));
    return {
      blockNumber: blockNum,
      blockTime:   block ? new Date(block.timestamp * 1000).toISOString() : null,
      gasPrice:    gasPrice,
      txCount:     block ? block.transactions.length : 0,
    };
  } catch(e) {
    return { error: e.message };
  }
}

// ─── 5. USDT 转移监测 (最近区块大额转账) ─────────────
async function getRecentLargeTransfers(ethPrice) {
  try {
    const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const usdt = new ethers.Contract(USDT, [
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'function balanceOf(address) view returns (uint256)',
    ], provider);
    
    // USDT Transfer 事件过滤 (fromBlock-10 to latest)
    const fromBlock = await provider.getBlockNumber() - 10;
    const logs = await provider.getLogs({
      address: USDT,
      fromBlock,
      toBlock: 'latest',
      topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
    });
    
    const threshold = 100_000 * 1e6; // 10万美元 (USDT 6 dec)
    const large = [];
    
    for (const log of logs.slice(-50)) {
      try {
        const parsed = usdt.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        const value = parsed.args[2];
        if (value >= threshold) {
          const from = '0x' + log.topics[1].slice(26);
          const to   = '0x' + log.topics[2].slice(26);
          const usdVal = Number(ethers.formatUnits(value, 6));
          large.push({ from, to, usd: usdVal, usdFmt: fmt(usdVal) });
        }
      } catch {}
    }
    return large;
  } catch(e) {
    return [];
  }
}

// ─── 生成完整报告 ──────────────────────────────────
async function buildReport() {
  console.log('[*] 开始抓取链上数据...');
  const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const lines = [
    `⛓️ *ETH 链上快讯* | ${ts}`,
    '━━━━━━━━━━━━━━━━━━━',
  ];

  // 1. ETH 价格
  const ethData = await getEthPrice();
  if (ethData.price) {
    const change = ethData.price - ethData.price; // 暂无昨日对比
    lines.push(`📊 *ETH 价格:* $${ethData.price.toLocaleString('en-US',{minimumFractionDigits:2})}`);
    lines.push(`   💧 池子深度: ${fmtNum(ethData.r1)} USDT / ${fmtNum(ethData.r0)} ETH`);
    lines.push('');
  }

  // 2. 链上状态
  const chain = await getChainStatus();
  if (!chain.error) {
    const gasEmoji = chain.gasPrice < 20 ? '🟢' : chain.gasPrice < 50 ? '🟡' : '🔴';
    lines.push('⛽ *链上状态*');
    lines.push(`   区块: #${chain.blockNumber} | ${chain.blockTime}`);
    lines.push(`   ${gasEmoji} Gas价格: ${chain.gasPrice.toFixed(1)} Gwei`);
    lines.push(`   最新区块打包: ${chain.txCount} 笔交易`);
    lines.push('');
  }

  // 3. 巨鲸钱包
  const whales = await getWhaleBalances();
  if (whales.length) {
    lines.push('🐋 *巨鲸动向* (持仓概览)');
    for (const w of whales.slice(0, 4)) {
      const lines2 = [`  🐋 ${w.label}:`];
      if (w.ethBal > 0.01) lines2.push(`ETH ${fmtNum(w.ethBal)}`);
      for (const [sym, bal] of Object.entries(w.tokens)) {
        if (bal > 1) lines2.push(`${sym} ${fmtNum(bal)}`);
      }
      if (lines2.length > 1) lines.push(lines2.join(' | '));
    }
    lines.push('');
  }

  // 4. 大额 USDT 转账
  const largeTxs = await getRecentLargeTransfers(ethData.price);
  if (largeTxs.length) {
    lines.push('💸 *最近大额USDT转账* (近10区块)');
    for (const tx of largeTxs.slice(0, 5)) {
      lines.push(`  → ${tx.usdFmt} 从 ${tx.from.slice(0,8)}... 到 ${tx.to.slice(0,8)}...`);
    }
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━');
  lines.push('📡 数据来源：以太坊公开 RPC (publicnode.com)');
  lines.push('⚠️ 链上数据仅供参考，不构成投资建议');

  return lines.join('\n');
}

// ─── 主入口 ───────────────────────────────────────
(async () => {
  try {
    const report = await buildReport();
    console.log('\n' + '='.repeat(50));
    console.log(report);

    // 保存
    const { writeFileSync, mkdirSync } = await import('fs');
    const dir = '/root/.openclaw/workspace/yaobi-monitor/reports';
    mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().slice(0,16).replace('T','_').replace(':','');
    writeFileSync(`${dir}/onchain_${ts}.txt`, report);
    console.log(`\n[✓] 已保存`);
  } catch(e) {
    console.error('[X]', e.message);
    process.exit(1);
  }
})();
