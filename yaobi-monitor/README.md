# 币圈情报监控系统

## 系统状态

| 模块 | 状态 | 说明 |
|------|------|------|
| ETH链上监控 | ✅ 运行中 | ETH价格/巨鲸钱包/Gas/大额转账 |
| 早盘情报 (08:00) | ✅ 已设置 | 每日08:00自动推送 |
| 午盘情报 (14:00) | ✅ 已设置 | 每日14:00自动推送 |
| 晚盘情报 (20:00) | ✅ 已设置 | 每日20:00自动推送 |
| 链上监控 (每6h) | ✅ 已设置 | ETH链上数据自动推送 |

## 文件说明

```
crypto_monitor.py   - Python版监控 (需外部API，本服务器无法访问)
crypto_scan.js      - Node.js版 (依赖DexScreener API，本服务器无法访问)
onchain_monitor.js  - ⭐ ETH链上监控 (唯一可用的方案!)
                      读取 Uniswap V2 池子 → ETH实时价格
                      追踪巨鲸钱包余额
                      监测大额USDT转账
                      实时Gas价格
crypto_news_search.js - 浏览器版新闻搜索 (需要能访问外网的节点)
reports/            - 报告输出目录
proxy-worker/      - Cloudflare Worker代理 (备用方案)
```

## 关键限制

**本服务器网络环境（腾讯云内网）：**
- ✅ 可访问: `ethereum.publicnode.com` (ETH RPC)
- ✅ 可访问: `example.com` (browser)
- ❌ 无法访问: Binance, CoinGecko, DexScreener, 币安API 等所有币圈API

**因此核心数据来源：ETH 链上实时数据（onchain_monitor.js）**

## onchain_monitor.js 使用

```bash
node onchain_monitor.js
```

输出示例：
```
⛓️ ETH 链上快讯 | 2026/6/23 08:00
📊 ETH 价格: $1,722.64
   💧 池子深度: 7.05M USDT / 4.09K ETH
⛽ Gas价格: 0.2 Gwei (🟢 低)
🐋 Binance热钱包: ETH 300.60K | USDT 1.14B | WBTC 467.11
💸 大额USDT转账: $2.50M 从 0x6859da... 到 0x316f94...
```

## 数据来源

- ETH价格 → Uniswap V2 WETH-USDT 池子 (0x0d4a11d5...)
- 巨鲸钱包 → ETH主网实时余额查询
- 大额转账 → USDT Transfer 事件 (近10区块)
- Gas价格 → ETH RPC eth_gasPrice

## Cron 任务

```bash
openclaw cron list
```

- `早盘币圈情报`  - 08:00 Asia/Shanghai
- `午盘币圈情报`  - 14:00 Asia/Shanghai
- `晚盘币圈情报`  - 20:00 Asia/Shanghai
- `ETH链上监控6h` - 每6小时

## 改进方向

1. **获取 CoinGecko API Key** → 解锁完整行情数据
2. **部署 Cloudflare Worker** → 作为 API 代理中转
3. **接入更多链** → BSC RPC / Solana RPC (需要找到可访问的节点)
4. **巨鲸预警** → 当监测到异常大额转账时立即推送

## 作者

王昱辰 / OpenClaw Agent
