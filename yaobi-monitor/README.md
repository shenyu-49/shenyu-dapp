# 币圈情报监控系统

## 系统状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 爬虫 crawler.js | ✅ 运行中 | BTC/ETH价格 + 新闻 |
| ETH链上监控 | ✅ 运行中 | ETH价格/巨鲸/Gas/大额转账 |
| 早盘推送 08:00 | ✅ 已设置 | 自动推送 |
| 午盘推送 14:00 | ✅ 已设置 | 自动推送 |
| 晚盘推送 20:00 | ✅ 已设置 | 自动推送 |
| 每6h链上监控 | ✅ 已设置 | 自动推送 |

## 文件说明

```
crypto_crawler.js      ← 主力爬虫(Bing featured snippets + ETH链上)
onchain_monitor.js     ← ETH链上监控(etherereum.publicnode.com)
crypto_monitor.py      ← Python版(需外部API,本服务器无法使用)
reports/               ← 报告输出目录
proxy-worker/          ← Cloudflare Worker代理(备用)
```

## 核心技术细节

### 爬虫策略
- **BTC/ETH 价格**: Bing 搜索 featured snippet (需8秒JS渲染等待)
- **ETH 链上价格**: Uniswap V2 WETH-USDT 池子直接读链
- **SOL 价格**: Bing featured snippet (不稳定，尝试 fallback query)
- **新闻**: Bing 搜索聚合(质量有限，因为 Bing 返回的大多是 Wikipedia/项目介绍)

### 关键发现
服务器网络环境（腾讯云内网）：
- ✅ ethereum.publicnode.com (ETH RPC) - 完全可用
- ✅ Bing 搜索 (cn.bing.com) - 可抓 featured snippets
- ✅ example.com - 可访问
- ❌ CoinGecko/Binance/DexScreener 等所有币圈 API - 不可访问
- ❌ CoinMarketCap/CoinGecko 官网 - connection reset

### BTC/ETH 价格抓取原理
1. Bing 搜索 `bitcoin+ethereum+solana+price+today+live`
2. 等待 8 秒让 JS 渲染 featured snippet（关键！）
3. 滚动触发懒加载
4. 解析 `The live Bitcoin price today is $XX,XXX USD` 格式
5. 正则匹配：BITCOIN/ETH/SOL 关键词 + 价格 + 涨跌幅

## 使用方法

```bash
# 手动运行爬虫
cd /root/.openclaw/workspace/yaobi-monitor
node crypto_crawler.js morning    # 早盘
node crypto_crawler.js afternoon  # 午盘
node crypto_crawler.js evening    # 晚盘

# 运行链上监控
node onchain_monitor.js
```

## Cron 任务

```
openclaw cron list
```

| 任务 | 时间 | 功能 |
|------|------|------|
| 早盘币圈情报v2 | 08:00 | 爬虫 + 推送 |
| 午盘币圈情报v2 | 14:00 | 爬虫 + 推送 |
| 晚盘币圈情报v2 | 20:00 | 爬虫 + 推送 |
| ETH链上监控6h | 每6小时 | 链上数据推送 |

## 改进方向

1. **CoinGecko API Key** → 解锁完整行情数据
2. **Cloudflare Worker** → 绕过网络限制，访问所有币圈 API
3. **新闻质量提升** → Bing featured snippets 新闻不可靠，考虑其他源
4. **SOL 价格** → 目前最不稳定，考虑 on-chain 估算

## 作者

王昱辰 / OpenClaw Agent | 2026-06-23
