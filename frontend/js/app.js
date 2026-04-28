// ============ 神预DApp - 实时数据同步 ============

// 状态
let currentPage = 'home';
let currentSymbol = 'btcusdt';
let currentCategory = 'crypto';
let klineSocket = null;
let priceSocket = null;
let reconnectAttempts = 0;

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initCategoryTabs();
    initSymbolSelect();
    initBet();
    initInvite();
    initHomeStats();
    updateSymbolList();
});

// ============ 页面切换 ============
function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
}

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');
    
    const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (btn) btn.classList.add('active');
    
    currentPage = page;
    
    if (page === 'predict') {
        initRealTimeData(currentSymbol);
    }
}

// ============ 实时价格WebSocket ============
function initRealTimeData(symbol) {
    disconnectSockets();
    
    // 1. 价格WebSocket - 实时价格更新
    const priceStream = `${symbol}@ticker`;
    priceSocket = new WebSocket(`wss://stream.binance.com:9443/ws/${priceStream}`);
    
    priceSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.s) { // 成功收到数据
            updateRealTimePrice(data);
        }
    };
    
    priceSocket.onerror = () => {
        console.log('价格WebSocket错误，尝试REST API');
        fetchBinancePrice(symbol);
    };
    
    // 2. K线WebSocket - 实时K线数据
    const klineStream = `${symbol}@kline_1h`;
    klineSocket = new WebSocket(`wss://stream.binance.com:9443/ws/${klineStream}`);
    
    klineSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.k) {
            updateKlineUI(data.k);
        }
    };
    
    klineSocket.onerror = () => {
        console.log('K线WebSocket错误');
        fetchKlineData(symbol);
    };
}

function updateRealTimePrice(ticker) {
    const price = parseFloat(ticker.c).toFixed(2);
    const change = parseFloat(ticker.P).toFixed(2);
    const high = parseFloat(ticker.h).toFixed(2);
    const low = parseFloat(ticker.l).toFixed(2);
    const volume = parseFloat(ticker.v).toFixed(2);
    
    const isPositive = parseFloat(change) >= 0;
    const changeClass = isPositive ? '' : 'negative';
    const priceColor = isPositive ? '#00ff88' : '#ff4757';
    
    const chartEl = document.getElementById('klineChart');
    if (chartEl) {
        const priceEl = chartEl.querySelector('.symbol-price');
        const changeEl = chartEl.querySelector('.symbol-change');
        const symbolEl = chartEl.querySelector('.symbol-name');
        
        if (priceEl) {
            priceEl.textContent = parseFloat(price).toLocaleString();
            priceEl.style.color = priceColor;
        }
        if (changeEl) {
            changeEl.textContent = (isPositive ? '+' : '') + change + '%';
            changeEl.className = 'symbol-change ' + changeClass;
            changeEl.style.background = isPositive ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 71, 87, 0.2)';
        }
        if (symbolEl) {
            symbolEl.textContent = symbol.toUpperCase().replace('USDT', '/USDT');
        }
    }
}

function updateKlineUI(kline) {
    drawKlineCanvas(kline);
}

// ============ 币安REST API备用 ============
async function fetchBinancePrice(symbol) {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
        const data = await response.json();
        updateRealTimePrice({
            c: data.lastPrice,
            P: data.priceChangePercent,
            h: data.highPrice,
            l: data.lowPrice,
            v: data.volume
        });
    } catch (e) {
        console.log('REST API也失败');
    }
}

async function fetchKlineData(symbol) {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1h&limit=100`);
        const data = await response.json();
        if (data.length > 0) {
            const last = data[data.length - 1];
            updateKlineUI({
                o: last[1],
                c: last[4],
                h: last[2],
                l: last[3]
            });
        }
    } catch (e) {
        console.log('K线数据获取失败');
    }
}

// ============ 绘制K线 ============
function drawKlineCanvas(kline) {
    const canvas = document.getElementById('klineCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    const open = parseFloat(kline.o);
    const close = parseFloat(kline.c);
    const high = parseFloat(kline.h);
    const low = parseFloat(kline.l);
    
    const isGreen = close >= open;
    const color = isGreen ? '#00ff88' : '#ff4757';
    
    const candleWidth = 8;
    const x = width / 2;
    
    const range = high - low || 1;
    const highY = height - ((high - low) / range * height * 0.9);
    const lowY = height - ((high - low) / range * height * 0.1);
    const openY = height - ((open - low) / range * (height * 0.9 - height * 0.1)) - height * 0.1;
    const closeY = height - ((close - low) / range * (height * 0.9 - height * 0.1)) - height * 0.1;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();
    
    ctx.fillStyle = color;
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.abs(closeY - openY) || 2;
    ctx.fillRect(x - candleWidth, bodyTop, candleWidth * 2, bodyHeight);
    
    drawMockHistory(ctx, width, height, isGreen);
}

function drawMockHistory(ctx, width, height, isMainGreen) {
    const points = [];
    const numPoints = 30;
    const centerX = width / 2;
    const centerY = height / 2;
    
    let y = centerY;
    for (let i = 0; i < numPoints; i++) {
        y += (Math.random() - 0.5) * 8;
        y = Math.max(20, Math.min(height - 20, y));
        points.push({ x: centerX + (i - numPoints / 2) * 6, y });
    }
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// ============ 板块和币种选择 ============
function initCategoryTabs() {
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            updateSymbolList();
        });
    });
}

function initSymbolSelect() {
    document.querySelectorAll('.symbol-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.symbol-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            selectSymbol(item.dataset.symbol);
        });
    });
}

function selectSymbol(symbol) {
    currentSymbol = symbol;
    if (currentPage === 'predict') {
        initRealTimeData(symbol);
    }
}

function updateSymbolList() {
    const symbols = {
        crypto: ['BTC', 'ETH', 'BNB', 'SOL', 'TRX', 'ADA', 'DOT', 'AVAX'],
        hot: ['Fear & Greed', 'DeFi TVL', 'BTC Dominance', 'ETH Staking'],
        sports: ['NBA Finals', 'World Cup', 'Tennis Grand Slam', 'Super Bowl']
    };
    
    const list = document.getElementById('symbolList');
    if (list) {
        const syms = symbols[currentCategory] || symbols.crypto;
        list.innerHTML = syms.map((s, i) => {
            const key = currentCategory === 'crypto' ? syms[i].toLowerCase() + 'usdt' : s.toLowerCase().replace(/ /g, '-');
            return `<div class="symbol-item ${i === 0 ? 'active' : ''}" data-symbol="${key}">${s}</div>`;
        }).join('');
        
        list.querySelectorAll('.symbol-item').forEach(item => {
            item.addEventListener('click', () => {
                list.querySelectorAll('.symbol-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                selectSymbol(item.dataset.symbol);
            });
        });
    }
}

// ============ 投注 ============
function initBet() {
    const betBtnYes = document.querySelector('.btn-bet.btn-yes');
    const betBtnNo = document.querySelector('.btn-bet.btn-no');
    const amountInput = document.getElementById('betAmount');
    
    if (betBtnYes) {
        betBtnYes.addEventListener('click', () => placeBet('YES', amountInput.value));
    }
    if (betBtnNo) {
        betBtnNo.addEventListener('click', () => placeBet('NO', amountInput.value));
    }
}

function placeBet(side, amount) {
    if (!amount || amount < 10) {
        showToast('最低投注10 USDT');
        return;
    }
    if (side === 'YES') {
        betBtnYes.style.opacity = '1';
        document.querySelector('.btn-bet.btn-no').style.opacity = '0.5';
    } else {
        document.querySelector('.btn-bet.btn-yes').style.opacity = '0.5';
        betBtnNo.style.opacity = '1';
    }
    showToast(`已提交 ${side} 投注 ${amount} USDT`);
}

// ============ 首页数据 ============
function initHomeStats() {
    // 模拟数据，实际应该从合约获取
    setInterval(() => {
        if (currentPage === 'home') {
            updateHomeStats();
        }
    }, 5000);
}

function updateHomeStats() {
    // 实时更新活跃度（模拟）
    const activity = Math.floor(Math.random() * 1000) + 1234;
    const pool = (Math.random() * 10000 + 56789).toFixed(0);
    const yesterday = (Math.random() * 1000 + 1234).toFixed(0);
    
    const el = (id) => document.getElementById(id);
    if (el('homeActivity')) el('homeActivity').textContent = activity.toLocaleString();
    if (el('homePool')) el('homePool').textContent = pool + ' USDT';
    if (el('homeYesterdaySubsidy')) el('homeYesterdaySubsidy').textContent = yesterday + ' USDT';
    if (el('totalActivity')) el('totalActivity').textContent = (activity * 10).toLocaleString();
}

// ============ 邀请链接 ============
function initInvite() {
    const copyBtn = document.getElementById('copyLinkBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const link = document.getElementById('inviteLink');
            if (link && link.value) {
                navigator.clipboard.writeText(link.value);
                showToast('链接已���制');
            } else {
                showToast('请先连接钱包');
            }
        });
    }
}

// ============ 工具函数 ============
function disconnectSockets() {
    if (klineSocket) { klineSocket.close(); klineSocket = null; }
    if (priceSocket) { priceSocket.close(); priceSocket = null; }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
}
