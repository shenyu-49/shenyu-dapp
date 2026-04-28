// ============ 神预DApp - 带模拟数据的实时价格 ============

let currentPage = 'home';
let currentSymbol = 'btcusdt';
let currentCategory = 'crypto';
let klineSocket = null;
let priceSocket = null;

document.addEventListener('DOMContentLoaded', () => {
    // 立即显示模拟数据
    showMockData();
    tryConnectRealTime();
    
    initNav();
    initCategoryTabs();
    initSymbolSelect();
    initBet();
    initInvite();
    updateSymbolList();
    
    // 页面切换到预测时尝试连接真实数据
    setTimeout(() => {
        if (currentPage === 'predict') tryConnectRealTime();
    }, 3000);
});

function showMockData() {
    const mockData = {
        'btcusdt': { price: 67543.21, change: 2.34, high: 68100, low: 66200 },
        'ethusdt': { price: 3456.78, change: 1.56, high: 3510, low: 3380 },
        'bnbusdt': { price: 567.89, change: -0.89, high: 580, low: 550 },
        'solusdt': { price: 145.67, change: 5.23, high: 152, low: 138 },
        'trxusdt': { price: 0.1123, change: 0.45, high: 0.115, low: 0.108 }
    };
    const data = mockData[currentSymbol] || mockData.btcusdt;
    const isPositive = data.change >= 0;
    
    const chartEl = document.getElementById('klineChart');
    if (chartEl) {
        const priceEl = chartEl.querySelector('.symbol-price');
        const changeEl = chartEl.querySelector('.symbol-change');
        const symbolEl = chartEl.querySelector('.symbol-name');
        
        if (priceEl) {
            priceEl.textContent = data.price.toLocaleString();
            priceEl.style.color = isPositive ? '#00ff88' : '#ff4757';
        }
        if (changeEl) {
            changeEl.textContent = (isPositive ? '+' : '') + data.change + '%';
            changeEl.className = 'symbol-change ' + (isPositive ? '' : 'negative');
            changeEl.style.background = isPositive ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 71, 87, 0.2)';
        }
        if (symbolEl) {
            symbolEl.textContent = currentSymbol.toUpperCase().replace('USDT', '/USDT');
        }
    }
    
    // 绘制K线
    drawKlineCanvas();
}

function drawKlineCanvas() {
    const canvas = document.getElementById('klineCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    if (!container) return;
    
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 180;
    
    canvas.width = width;
    canvas.height = height;
    
    // 清空
    ctx.clearRect(0, 0, width, height);
    
    // 背景网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 20; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // 模拟K线走势
    const centerY = height * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    
    let y = centerY;
    for (let x = 0; x < width; x += 4) {
        y += (Math.random() - 0.48) * 8;
        y = Math.max(30, Math.min(height - 30, y));
        ctx.lineTo(x, y);
    }
    
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 渐变填充
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
}

// 尝试连接真实数据
function tryConnectRealTime() {
    try {
        priceSocket = new WebSocket(`wss://stream.binance.com:9443/ws/${currentSymbol}@ticker`);
        
        priceSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.c) {
                const price = parseFloat(data.c).toFixed(2);
                const change = parseFloat(data.P).toFixed(2);
                updatePriceUI(price, change);
            }
        };
        
        priceSocket.onerror = () => console.log('WebSocket error');
    } catch (e) {
        console.log('WebSocket连接失败，使用模拟数据');
    }
}

function updatePriceUI(price, change) {
    const isPositive = parseFloat(change) >= 0;
    const chartEl = document.getElementById('klineChart');
    if (chartEl) {
        const priceEl = chartEl.querySelector('.symbol-price');
        const changeEl = chartEl.querySelector('.symbol-change');
        
        if (priceEl) {
            priceEl.textContent = parseFloat(price).toLocaleString();
            priceEl.style.color = isPositive ? '#00ff88' : '#ff4757';
        }
        if (changeEl) {
            changeEl.textContent = (isPositive ? '+' : '') + change + '%';
            changeEl.className = 'symbol-change ' + (isPositive ? '' : 'negative');
        }
    }
}

// ============ 导航 ============
function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('page-' + page).classList.add('active');
            btn.classList.add('active');
            currentPage = page;
            
            if (page === 'predict') {
                showMockData();
    tryConnectRealTime();
                setTimeout(() => tryConnectRealTime(), 1000);
            }
        });
    });
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

function initSymbolSelect() {
    document.querySelectorAll('.symbol-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.symbol-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentSymbol = item.dataset.symbol;
            showMockData();
    tryConnectRealTime();
        });
    });
}

function updateSymbolList() {
    const symbols = {
        crypto: ['BTC', 'ETH', 'BNB', 'SOL', 'TRX', 'ADA', 'DOT', 'AVAX'],
        hot: ['BTC生态', 'DeFi', 'NFT', 'RWA'],
        sports: ['NBA', '世界杯', '网球', '超级碗']
    };
    
    const list = document.getElementById('symbolList');
    if (list) {
        const syms = symbols[currentCategory] || symbols.crypto;
        list.innerHTML = syms.map((s, i) => {
            const key = currentCategory === 'crypto' ? syms[i].toLowerCase() + 'usdt' : s.toLowerCase();
            return `<div class="symbol-item ${i === 0 ? 'active' : ''}" data-symbol="${key}">${s}</div>`;
        }).join('');
        
        list.querySelectorAll('.symbol-item').forEach(item => {
            item.addEventListener('click', () => {
                list.querySelectorAll('.symbol-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                currentSymbol = item.dataset.symbol;
                showMockData();
    tryConnectRealTime();
            });
        });
    }
}

// ============ 投注 ============
function initBet() {
    const amountInput = document.getElementById('betAmount');
    document.querySelectorAll('.btn-bet').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = amountInput?.value;
            if (!amount || amount < 10) {
                showToast('最低投注10 USDT');
                return;
            }
            showToast(`已提交 ${btn.dataset.side} 投注 ${amount} USDT`);
        });
    });
}

// ============ 邀请 ============
function initInvite() {
    document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
        showToast('链接已复制');
    });
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
