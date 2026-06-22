#!/usr/bin/env python3
"""
币圈情报监控系统 - 被动推送版
数据来源：通过 Cloudflare Worker 代理访问 DEX Screener + CoinGecko
定时：每天 08:00 / 14:00 / 20:00 各跑一次，结果推送到 Webhook
"""

import json
import os
import time
import requests
from datetime import datetime

# ─── 配置 ───────────────────────────────────────────
CF_WORKER_URL = os.environ.get("CF_WORKER_URL", "")  # 留空则使用直接API（网络通时）
WEBHOOK_URL   = os.environ.get("WEBHOOK_URL", "")    # 推送目标

CHAINS = ["solana", "base", "ethereum", "avalanche", "bsc"]
MIN_LIQUIDITY = 3000   # 最低流动性 $
MIN_VOLUME_24H = 5000  # 最低24h成交量 $
TOP_N = 8              # 每链取 TOP N
# ────────────────────────────────────────────────────

def fetch_dexscreener(chain: str) -> list:
    """通过 DexScreener 搜索端点获取热门交易对"""
    try:
        # 搜索该链的热门币
        url = f"https://api.dexscreener.com/v1/search?query={chain}&chain={chain}&limit=50"
        resp = requests.get(url, timeout=15)
        if resp.status_code != 200:
            return []

        data = resp.json()
        pairs = data.get("pairs", []) or []

        results = []
        for p in pairs:
            try:
                base  = p.get("baseToken", {}) or {}
                quote = p.get("quoteToken", {}) or {}
                liquidity = float(p.get("liquidity", {}).get("usd", 0) or 0)
                volume24h = float(p.get("volume", {}).get("h24", 0) or 0)
                mc = float(p.get("marketCap", 0) or 0)

                if liquidity < MIN_LIQUIDITY or volume24h < MIN_VOLUME_24H:
                    continue

                # 取价、涨跌幅
                price     = p.get("priceUsd") or p.get("priceNative", "0")
                change5m  = float(p.get("priceChange", {}).get("m5", 0) or 0)
                change1h  = float(p.get("priceChange", {}).get("h1", 0) or 0)
                change6h  = float(p.get("priceChange", {}).get("h6", 0) or 0)
                change24h = float(p.get("priceChange", {}).get("h24", 0) or 0)

                txns = p.get("txns", {}) or {}
                buys5m  = int(txns.get("m5", {}).get("buys", 0) or 0)
                sells5m = int(txns.get("m5", {}).get("sells", 0) or 0)
                buys1h  = int(txns.get("h1", {}).get("buys", 0) or 0)
                sells1h = int(txns.get("h1", {}).get("sells", 0) or 0)

                # 妖气评分
                buy_ratio  = buys5m / max(buys5m + sells5m, 1)
                momentum   = change5m * 3 + change1h * 2.5 + change6h * 1.5
                volume_score = min(volume24h / 50_000, 10) * 2
                score = momentum + buy_ratio * 20 + volume_score

                results.append({
                    "symbol":      base.get("symbol", "??"),
                    "name":        base.get("name", ""),
                    "address":     base.get("address", ""),
                    "chain":       chain,
                    "price":       price,
                    "liquidity":   round(liquidity, 0),
                    "volume24h":   round(volume24h, 0),
                    "marketCap":   round(mc, 0),
                    "change5m":    round(change5m, 2),
                    "change1h":    round(change1h, 2),
                    "change6h":    round(change6h, 2),
                    "change24h":   round(change24h, 2),
                    "buys5m":      buys5m,
                    "sells5m":     sells5m,
                    "buys1h":      buys1h,
                    "sells1h":     sells1h,
                    "score":       round(score, 2),
                    "url":         f"https://dexscreener.com/{chain}/{base.get('address','')}",
                    "logo":        base.get("logoURI", ""),
                })
            except Exception:
                continue

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:TOP_N]

    except Exception as e:
        print(f"  [!] {chain} 出错: {e}")
        return []


def fetch_market_overview() -> dict:
    """获取主流币行情概览"""
    symbols = ["bitcoin","ethereum","solana","bnb","avalanche-2","base","dogecoin","shiba-inu","pepe","bonk"]
    try:
        ids = ",".join(symbols)
        url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={ids}&order=market_cap_desc&sparkline=false&price_change_percentage=1h,24h,7d"
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            return {}
        data = r.json()
        return {c["id"]: {
            "price":   c.get("current_price"),
            "change1h":  c.get("price_change_percentage_1h_in_currency"),
            "change24h": c.get("price_change_percentage_24h"),
            "change7d":  c.get("price_change_percentage_7d_in_currency"),
            "mc":         c.get("market_cap"),
            "volume":     c.get("total_volume"),
        } for c in data}
    except Exception:
        return {}


def fetch_trending_searches() -> list:
    """CoinGecko 搜索趋势"""
    try:
        url = "https://api.coingecko.com/api/v3/search/trending"
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            return []
        data = r.json()
        coins = data.get("coins", [])
        return [
            {
                "symbol": c["item"]["symbol"],
                "name":    c["item"]["name"],
                "mc_rank": c["item"].get("market_cap_rank", "?"),
                "score":   c["item"].get("score", 0),
                "thumb":   c["item"].get("thumb", ""),
            }
            for c in coins[:7]
        ]
    except Exception:
        return []


def format_usd(val: float) -> str:
    if val is None: return "N/A"
    if val >= 1e12: return f"${val/1e12:.2f}T"
    if val >= 1e9:  return f"${val/1e9:.2f}B"
    if val >= 1e6:  return f"${val/1e6:.2f}M"
    if val >= 1e3:  return f"${val/1e3:.1f}K"
    return f"${val:.2f}"


def build_report() -> str:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [f"🌙 *币圈埋伏日报* | {ts}", "━━━━━━━━━━━━━━━━━━━", ""]

    # 1. 主流币概览
    overview = fetch_market_overview()
    if overview:
        lines.append("📊 *主流币行情*")
        emoji = lambda c: "🟢" if (c or 0) > 0 else "🔴"
        for sym, name in [("bitcoin","BTC"),("ethereum","ETH"),("solana","SOL"),
                           ("bnb","BNB"),("avalanche-2","AVAX"),("dogecoin","DOGE")]:
            d = overview.get(sym, {})
            c1 = d.get("change1h"); c24 = d.get("change24h")
            lines.append(f"  {emoji(c1)} {name}: ${d.get('price','?')} | 1h {c1:+.2f}% | 24h {c24:+.2f}%")
        lines.append("")

    # 2. DexScreener 妖币候选
    all_coins = []
    for chain in CHAINS:
        print(f"→ 扫描 {chain.upper()}...")
        coins = fetch_dexscreener(chain)
        all_coins.extend(coins)
        print(f"  找到 {len(coins)} 个候选")
        time.sleep(0.3)

    all_coins.sort(key=lambda x: x["score"], reverse=True)
    top = all_coins[:8]

    if top:
        lines.append("🏆 *今日埋伏候选 TOP 8*")
        medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣"]
        for i, c in enumerate(top):
            m = medals[i] if i < 8 else f"{i+1}."
            lines.append(
                f"{m} *{c['symbol'].upper()}*`/{c['chain']}`\n"
                f"   📈 5m {c['change5m']:+.1f}% | 1h {c['change1h']:+.1f}% | 24h {c['change24h']:+.1f}%\n"
                f"   💧 {format_usd(c['liquidity'])} | 📊 24h量 {format_usd(c['volume24h'])}\n"
                f"   🛒 5m买/卖 {c['buys5m']}/{c['sells5m']} | 1h {c['buys1h']}/{c['sells1h']}\n"
                f"   🔗 dexscreener.com/{c['chain']}/{c['address'][:8]}..."
            )
    else:
        lines.append("⚠️ 今日暂未发现明确信号，请关注后续更新")

    lines.extend(["", "━━━━━━━━━━━━━━━━━━━", "⚠️ _以上仅为数据分析，DYOR！_"])

    return "\n".join(lines)


def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 币圈监控开始...")
    report = build_report()
    print("\n" + report)

    # 推送
    if WEBHOOK_URL:
        try:
            r = requests.post(WEBHOOK_URL, json={"text": report}, timeout=10)
            print(f"[→] 推送结果: {r.status_code}")
        except Exception as e:
            print(f"[!] 推送失败: {e}")

    # 保存
    out = f"/root/.openclaw/workspace/yaobi-monitor/reports/{datetime.now().strftime('%Y-%m-%d_%H%M')}.txt"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        f.write(report)
    print(f"[✓] 报告已保存: {out}")


if __name__ == "__main__":
    main()
