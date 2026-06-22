/**
 * 币圈API代理 - Cloudflare Worker
 * 解决服务器无法访问外部API的问题
 * 部署: wrangler deploy
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 只允许本 Worker 内部调用
    if (url.pathname === "/favicon.ico") {
      return new Response("", { status: 204 });
    }

    // ── CoinGecko 行情 ──
    if (url.pathname.startsWith("/coingecko")) {
      const path = url.searchParams.get("path") || "";
      const target = `https://api.coingecko.com/api/v3/${path}`;
      return fetch(target, {
        headers: { "Accept": "application/json", "User-Agent": "crypto-monitor/1.0" },
      });
    }

    // ── DEX Screener 搜索 ──
    if (url.pathname.startsWith("/dexscreener")) {
      const q    = url.searchParams.get("q")    || "";
      const chain = url.searchParams.get("chain") || "";
      const limit = url.searchParams.get("limit") || "30";
      let target = `https://api.dexscreener.com/v1/search?query=${encodeURIComponent(q)}`;
      if (chain) target += `&chain=${chain}`;
      target += `&limit=${limit}`;
      return fetch(target, {
        headers: { "Accept": "application/json", "User-Agent": "crypto-monitor/1.0" },
      });
    }

    // ── DEX Screener Pairs (指定链) ──
    if (url.pathname.startsWith("/dexpairs")) {
      const chain = url.searchParams.get("chain") || "solana";
      const limit = url.searchParams.get("limit") || "20";
      const target = `https://api.dexscreener.com/latest/dex/pairs/${chain}?limit=${limit}`;
      return fetch(target, {
        headers: { "Accept": "application/json", "User-Agent": "crypto-monitor/1.0" },
      });
    }

    // ── Binance Ticker ──
    if (url.pathname.startsWith("/binance")) {
      const symbol = url.searchParams.get("symbol") || "BTCUSDT";
      const target = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
      return fetch(target, {
        headers: { "Accept": "application/json", "User-Agent": "crypto-monitor/1.0" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown endpoint" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  },
};
