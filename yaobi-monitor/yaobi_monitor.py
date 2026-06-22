#!/usr/bin/env python3
"""
妖币监控脚本 - 每日埋伏候选币
数据来源：DEX Screener (Solana链 + 全链热门币)
"""

import json
import requests
import time
from datetime import datetime

# ─── 配置 ───────────────────────────────────────────
CHAIN = "solana"          # 主攻链 (solana / base / ethereum / avalanche)
HOT_CHAINS = ["solana", "base", "ethereum", "avalanche"]  # 多链扫描
MIN_VOLUME_USD = 10_000   # 最低24h交易量 ($)
MIN_LIQUIDITY = 5_000     # 最低流动性 ($)
MAX_RESULTS = 20          # 每链最多取多少
TOP_N = 5                 # 最终输出前N名妖币
# ────────────────────────────────────────────────────

DEX_SCREENER_API = "https://api.dexscreener.com/latest/dex/tokens"

def fetch_chain_hot(chain: str) -> list:
    """获取某链热门交易对"""
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{chain}"
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        pairs = data.get("pairs", [])
        
        scored = []
        for p in pairs:
            try:
                liquidity = float(p.get("liquidity", {}).get("usd", 0) or 0)
                volume24h = float(p.get("volume", {}).get("h24", 0) or 0)
                price_change_1h = float(p.get("priceChange", {}).get("h1", 0) or 0)
                price_change_5m = float(p.get("priceChange", {}).get("m5", 0) or 0)
                txns_30m = p.get("txns", {}).get("m30", {}) or {}
                buys = int(txns_30m.get("buys", 0) or 0)
                sells = int(txns_30m.get("sells", 0) or 0)
                base_token = p.get("baseToken", {}) or {}
                quote_token = p.get("quoteToken", {}) or {}
                
                symbol = base_token.get("symbol", "???")
                address = base_token.get("address", "")
                name = base_token.get("name", symbol)
                
                # 过滤：太低流动性不玩
                if liquidity < MIN_LIQUIDITY:
                    continue
                    
                # ── 妖气评分算法 ──
                # 权重：5min涨跌(30%) + 1h涨跌(25%) + 30min买入力度(25%) + 24h量(20%)
                pump_score = (
                    abs(price_change_5m) * 3.0 +
                    abs(price_change_1h) * 2.5 +
                    (buys / (buys + sells + 1)) * 25 +
                    min(volume24h / 100_000, 10) * 2
                )
                
                # 偏向有上涨动力的（正涨幅优先，负涨幅太大也要注意）
                if price_change_5m > 0 or price_change_1h > 0:
                    pump_score *= 1.2
                    
                scored.append({
                    "symbol": symbol,
                    "name": name,
                    "chain": chain,
                    "address": address,
                    "price_change_5m": price_change_5m,
                    "price_change_1h": price_change_1h,
                    "volume_24h": volume24h,
                    "liquidity": liquidity,
                    "buys_30m": buys,
                    "sells_30m": sells,
                    "score": round(pump_score, 2),
                    "url": f"https://dexscreener.com/{chain}/{address}"
                })
            except Exception:
                continue
        
        # 按妖气评分排序
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:MAX_RESULTS]
        
    except Exception as e:
        return []

def format_currency(val):
    """格式化美元金额"""
    if val >= 1_000_000:
        return f"${val/1_000_000:.1f}M"
    elif val >= 1_000:
        return f"${val/1_000:.0f}K"
    return f"${val:.0f}"

def make_report() -> str:
    """生成妖币埋伏日报"""
    all_candidates = []
    
    print(f"[妖币监控] {datetime.now().strftime('%Y-%m-%d %H:%M')} 开始扫描...")
    
    for chain in HOT_CHAINS:
        print(f"  → 扫描 {chain.upper()}...")
        results = fetch_chain_hot(chain)
        all_candidates.extend(results)
        print(f"    找到 {len(results)} 个候选币")
        time.sleep(0.5)
    
    # 全局排序，取 TOP
    all_candidates.sort(key=lambda x: x["score"], reverse=True)
    top_yaobis = all_candidates[:TOP_N]
    
    if not top_yaobis:
        return f"""
🌙 *妖币埋伏日报* | {datetime.now().strftime('%Y-%m-%d')}
━━━━━━━━━━━━━━━
今日扫描：{len(HOT_CHAINS)} 条链，暂无明确信号
💡 建议：关注 DEX Screener Hot Pairs 板块，等信号出现再埋伏
"""
    
    # 构造报告
    lines = [
        f"🌙 *妖币埋伏日报* | {datetime.now().strftime('%Y-%m-%d')}",
        f"━━━━━━━━━━━━━━━",
        f"📡 扫描范围：{' / '.join(c.upper() for c in HOT_CHAINS)}",
        f"🏆 今日埋伏候选 TOP{len(top_yaobis)}：",
        ""
    ]
    
    medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
    for i, coin in enumerate(top_yaobis):
        m = medals[i] if i < 5 else f"{i+1}️⃣"
        change_5m = f"{coin['price_change_5m']:+.1f}%" if coin['price_change_5m'] else "N/A"
        change_1h = f"{coin['price_change_1h']:+.1f}%" if coin['price_change_1h'] else "N/A"
        
        lines.append(
            f"{m} *{coin['symbol']}* ({coin['chain'].upper()})\n"
            f"   📦 {coin['name']}\n"
            f"   📈 5min: {change_5m} | 1h: {change_1h}\n"
            f"   💧 流动性: {format_currency(coin['liquidity'])}\n"
            f"   📊 24h量: {format_currency(coin['volume_24h'])}\n"
            f"   🛒 30min买卖: {coin['buys_30m']}/{coin['sells_30m']}\n"
            f"   🔗 {coin['url']}"
        )
        lines.append("")
    
    lines.extend([
        "━━━━━━━━━━━━━━━",
        "⚠️ *风险提示*：以上仅为数据分析结果，不构成投资建议！",
        "🔍 建议结合 Twitter 热度、合约审计、K线形态综合判断。",
        "🚫 DYOR (Do Your Own Research)"
    ])
    
    return "\n".join(lines)


if __name__ == "__main__":
    report = make_report()
    print("\n" + "="*50)
    print(report)
