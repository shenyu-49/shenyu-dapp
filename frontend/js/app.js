// ============ 神预DApp 前端逻辑 ============

// 状态
let currentPage = 'home';
let currentSymbol = 'btcusdt';
let currentCategory = 'crypto';

// ============ 页面切换 ============
function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            switchPage(page);
        });
    });
}

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById('page-' + page).classList.add('active');
    btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (btn) btn.classList.add('active');
    
    currentPage = page;
    
    if (page === 'predict') {
        initKline(currentSymbol);
    }
}

// ============ 板块选择 ============
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

function updateSymbolList() {
    const symbols = {
        crypto: ['btcusdt', 'ethusdt', 'bnbusdt', 'solusdt', 'trxusdt', 'adausdt', 'dotusdt', 'avaxusdt'],
        hot: ['hot-btc', 'hot-eth', 'hot-defi', 'hot-nft'],
        sports: ['sports-nba', 'sports-worldcup', 'sports-tennis']
    };
    
    const list = document.getElementById('symbolList');
    if (list) {
        list.innerHTML = (symbols[currentCategory] || []).map((s, i) => 
            `<div class="symbol-item ${i === 0 ? 'active' : ''}" data-symbol="${s}">${s.toUpperCase()}</div>`
        ).join('');
        
        list.querySelectorAll('.symbol-item').forEach(item => {
            item.addEventListener('click', () => {
                list.querySelectorAll('.symbol-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                selectSymbol(item.dataset.symbol);
            });
        });
    }
}

// ============ 币安K线 ============
let klineSocket = null;

function initKline(symbol) {
    currentSymbol = symbol;
    
    if (klineSocket) {
        klineSocket.close();
    }
    
    const streamName = `${symbol}@kline_1h`;
    klineSocket = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);
    
    klineSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.k) {
            updateKlineUI(data.k, symbol);
        }
    };
    
    klineSocket.onerror = () => {
        showMockKline(symbol);
    };
}

function updateKlineUI(kline, symbol) {
    const price = parseFloat(kline.c).toFixed(2);
    const change = ((parseFloat(kline.c) - parseFloat(kline.o)) / parseFloat(kline.o) * 100).toFixed(2);
    const changeClass = parseFloat(change) >= 0 ? '' : 'negative';
    
    const chartEl = document.getElementById('klineChart');
    if (chartEl) {
        const priceEl = chartEl.querySelector('.symbol-price');
        const changeEl = chartEl.querySelector('.symbol-change');
        const symbolEl = chartEl.querySelector('.symbol-name');
        
        if (priceEl) {
            priceEl.textContent = parseFloat(price).toLocaleString();
            priceEl.style.color = changeClass ? '#ff4757' : '#00ff88';
        }
        if (changeEl) {
            changeEl.textContent = (parseFloat(change) >= 0 ? '+' : '') + change + '%';
            changeEl.className = 'symbol-change ' + changeClass;
        }
        if (symbolEl) {
            symbolEl.textContent = symbol.toUpperCase().replace('USDT', '/USDT');
        }
    }
    
    drawKline(kline);
}

function showMockKline(symbol) {
    const prices = { btcusdt: 67543.21, ethusdt: 3456.78, bnbusdt: 567.89 };
    const price = prices[symbol] || 1000;
    
    const chartEl = document.getElementById('klineChart');
    if (chartEl) {
        const priceEl = chartEl.querySelector('.symbol-price');
        const changeEl = chartEl.querySelector('.symbol-change');
        
        if (priceEl) priceEl.textContent = price.toLocaleString();
        if (changeEl) {
            changeEl.textContent = '+2.34%';
            changeEl.className = 'symbol-change';
        }
    }
}

function drawKline(kline) {
    const canvas = document.getElementById('klineCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth;
    const height = canvas.parentElement.clientHeight - 20;
    
    canvas.width = width;
    canvas.height = height;
    
    const open = parseFloat(kline.o);
    const close = parseFloat(kline.c);
    const high = parseFloat(kline.h);
    const low = parseFloat(kline.l);
    
    const isGreen = close >= open;
    const color = isGreen ? '#00ff88' : '#ff4757';
    
    const range = high - low || 1;
    const openY = height - ((open - low) / range * height);
    const closeY = height - ((close - low) / range * height);
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, height - ((high - low) / range * height));
    ctx.lineTo(width / 2, 0);
    ctx.moveTo(width / 2, openY);
    ctx.lineTo(width / 2, closeY);
    ctx.stroke();
    
    ctx.fillStyle = color;
    ctx.fillRect(width / 2 - 15, openY < closeY ? openY : closeY, 30, Math.abs(closeY - openY));
}

// ============ 投注 ============
function initBet() {
    const betBtnYes = document.querySelector('.btn-bet.btn-yes');
    const betBtnNo = document.querySelector('.btn-bet.btn-no');
    const amountInput = document.getElementById('betAmount');
    let selectedSide = null;
    
    if (betBtnYes) {
        betBtnYes.addEventListener('click', () => {
            if (amountInput.value >= 10) {
                selectedSide = 'YES';
                betBtnYes.style.opacity = '1';
                betBtnNo.style.opacity = '0.5';
                showToast(`已选择 YES，投注 ${amountInput.value} USDT`);
            } else {
                showToast('最低投注10 USDT');
            }
        });
    }
    
    if (betBtnNo) {
        betBtnNo.addEventListener('click', () => {
            if (amountInput.value >= 10) {
                selectedSide = 'NO';
                betBtnNo.style.opacity = '1';
                betBtnYes.style.opacity = '0.5';
                showToast(`已选择 NO，投注 ${amountInput.value} USDT`);
            } else {
                showToast('最低投注10 USDT');
            }
        });
    }
}

// ============ 复制邀请链接 ============
function initInvite() {
    const copyBtn = document.getElementById('copyLinkBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const link = document.getElementById('inviteLink');
            if (link && link.value) {
                navigator.clipboard.writeText(link.value);
                showToast('链接已复制');
            }
        });
    }
}

// ============ Toast ============
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
}

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initCategoryTabs();
    initBet();
    initInvite();
    updateSymbolList();
    
    // 模拟数据
    document.getElementById('homeActivity').textContent = '1,234';
    document.getElementById('homePool').textContent = '56,789 USDT';
    document.getElementById('homeNodePool').textContent = '12,345 USDT';
    document.getElementById('homeYesterdaySubsidy').textContent = '1,234 USDT';
});
