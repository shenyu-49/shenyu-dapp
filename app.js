// 神预DApp前端逻辑
// 合约配置
const contractConfig = {
    testnet: {
        ShenYu: "0xc642107B0efa9013c8B12C880C6163a7c0566c2D",
        USDT: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
        operateWallet: "0x1A0a3d5fB91120185a795477ed600B9Cd3947732",
        secretWallet: "0x9C156fd416E0368545B999a4CC2CF9444ECF4016",
        rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
        chainId: 97
    },
    mainnet: {
        ShenYu: "",
        USDT: "0x55d398326f99059ff775485246999027b3197955",
        operateWallet: "0x1A0a3d5fB91120185a795477ed600B9Cd3947732",
        secretWallet: "0x9C156fd416E0368545B999a4CC2CF9444ECF4016",
        rpcUrl: "https://bsc-dataseed.binance.org/",
        chainId: 56
    }
};

// 全局变量
let currentNetwork = 'testnet';
let web3;
let shenYuContract;
let usdtContract;
let userAddress = '';
let connected = false;

// 资金池数据
let poolData = {
    welfarePool: 1000000,      // 福利池
    nodePool: 500000,         // 节点福利池
    totalBets: 0,            // 总投注
    yesBets: 0,              // YES投注总额
    noBets: 0,               // NO投注总额
    todayBets: 0,           // 今日投注次数
    userBets: {},            // 用户投注记录
    settlements: []           // 结算记录
};

// 初始化
function initApp() {
    loadPoolData();
    updatePoolDisplay();
    
    // 设置默认选择
    selectCategory('crypto');
    selectCoin('BTC');
    setPeriod('1m');
    selectBetType('YES');
    
    // 检查是否已连接钱包
    if (window.ethereum && window.ethereum.selectedAddress) {
        userAddress = window.ethereum.selectedAddress;
        connected = true;
        document.querySelector('.connect-btn').textContent = '已连接钱包';
        fetchWalletBalance();
    }
    
    // 模拟实时更新资金池
    setInterval(() => {
        simulatePoolChanges();
    }, 30000);
}

// 加载资金池数据
function loadPoolData() {
    const saved = localStorage.getItem('shenyuPoolData');
    if (saved) {
        poolData = JSON.parse(saved);
    }
}

// 保存资金池数据
function savePoolData() {
    localStorage.setItem('shenyuPoolData', JSON.stringify(poolData));
}

// 更新资金池显示
function updatePoolDisplay() {
    const elements = {
        'homePool': poolData.welfarePool.toLocaleString(),
        'homeNodePool': poolData.nodePool.toLocaleString(),
        'homeTodayBets': poolData.todayBets.toString(),
        'totalBets': poolData.totalBets.toLocaleString(),
        'yesBets': poolData.yesBets.toLocaleString(),
        'noBets': poolData.noBets.toLocaleString()
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}

// 模拟资金池变化
function simulatePoolChanges() {
    // 随机增加一些投注模拟活跃度
    if (Math.random() > 0.7) {
        const bet = Math.floor(Math.random() * 100) + 10;
        poolData.todayBets += 1;
        poolData.totalBets += bet;
        
        if (Math.random() > 0.5) {
            poolData.yesBets += bet;
        } else {
            poolData.noBets += bet;
        }
        
        // 福利池滚动增长
        poolData.welfarePool += bet * 0.05;
        poolData.nodePool += bet * 0.02;
        
        savePoolData();
        updatePoolDisplay();
    }
}

// 页面切换
function switchSection(section) {
    // 隐藏所有section
    document.getElementById('home-section').classList.remove('active');
    document.getElementById('predict-section').classList.remove('active');
    document.getElementById('ai-section').classList.remove('active');
    document.getElementById('my-section').classList.remove('active');
    
    // 显示当前section
    document.getElementById(`${section}-section`).classList.add('active');
    
    // 更新底部导航 - 使用更可靠的方式
    const sectionIndex = { home: 0, predict: 1, ai: 2, my: 3 };
    const index = sectionIndex[section];
    if (index !== undefined) {
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach((btn, i) => {
            if (i === index) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

// 板块选择
function selectCategory(category) {
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(btn => {
        btn.setAttribute('data-active', btn.textContent.includes(category));
        btn.style.backgroundColor = btn.getAttribute('data-active') === 'true' ? '#667eea' : 'rgba(0,0,0,0.5)';
    });
}

// 币种选择
function selectCoin(coin) {
    const buttons = document.querySelectorAll('.coin-btn');
    buttons.forEach(btn => {
        btn.setAttribute('data-active', btn.textContent === coin);
        btn.style.backgroundColor = btn.getAttribute('data-active') === 'true' ? '#667eea' : 'rgba(0,0,0,0.5)';
    });
    
    // 更新K线图标题
    document.querySelector('.coin-info h3').textContent = `${coin}/USDT`;
    
    // 获取实时价格数据
    updatePriceInfo(coin);
}

// 时间周期切换
function setPeriod(period) {
    const buttons = document.querySelectorAll('.period-btn');
    buttons.forEach(btn => {
        btn.setAttribute('data-active', btn.textContent.includes(period));
        btn.style.backgroundColor = btn.getAttribute('data-active') === 'true' ? '#667eea' : 'rgba(255,255,255,0.1)';
    });
    
    // 更新K线图
    updateChart(period);
}

// 投注类型选择
function selectBetType(type) {
    const yesBtn = document.querySelector('.bet-btn-yes');
    const noBtn = document.querySelector('.bet-btn-no');
    
    if (type === 'YES') {
        yesBtn.style.backgroundColor = '#00c853';
        yesBtn.style.color = '#fff';
        noBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
        noBtn.style.color = 'rgba(255,255,255,0.8)';
    } else {
        noBtn.style.backgroundColor = '#ff5252';
        noBtn.style.color = '#fff';
        yesBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
        yesBtn.style.color = 'rgba(255,255,255,0.8)';
    }
}

// 提交投注
function submitBet() {
    const amount = parseFloat(document.querySelector('.bet-input').value);
    const type = document.querySelector('.bet-btn-yes').style.backgroundColor === '#00c853' ? 'YES' : 'NO';
    
    if (!connected) {
        alert('请先连接钱包！');
        return;
    }
    
    if (!amount || amount < 10) {
        alert('最低投注10 USDT！');
        return;
    }
    
    if (amount > 10000) {
        alert('单次最高投注10000 USDT！');
        return;
    }
    
    // 投注逻辑
    const betRecord = {
        id: Date.now(),
        coin: document.querySelector('.coin-info h3')?.textContent || 'BTC/USDT',
        amount: amount,
        type: type,
        time: new Date().toLocaleString(),
        status: '进行中',
        result: null,
        payout: 0
    };
    
    // 更新奖池
    poolData.totalBets += amount;
    poolData.todayBets += 1;
    
    if (type === 'YES') {
        poolData.yesBets += amount;
    } else {
        poolData.noBets += amount;
    }
    
    // 资金分配
    const platformFee = amount * 0.03;    // 3% 平台费
    const welfarePool = amount * 0.05;      // 5% 福利池
    const nodePool = amount * 0.02;         // 2% 节点池
    const prizePool = amount * 0.90;       // 90% 奖金池
    
    poolData.welfarePool += welfarePool;
    poolData.nodePool += nodePool;
    
    // 保存用户投注
    if (!poolData.userBets[userAddress]) {
        poolData.userBets[userAddress] = [];
    }
    poolData.userBets[userAddress].push(betRecord);
    
    savePoolData();
    updatePoolDisplay();
    
    // 显示投注结果
    alert(`✅ 投注成功！
    
币种: ${betRecord.coin}
金额: ${amount} USDT
类型: ${type === 'YES' ? '📈 上涨' : '📉 下跌'}

💰 资金分配：
平台费: ${platformFee.toFixed(2)} USDT
福利池: ${welfarePool.toFixed(2)} USDT
节点池: ${nodePool.toFixed(2)} USDT
奖金池: ${prizePool.toFixed(2)} USDT

⏰ 等待结算...`);
    
    // 添加到历史记录
    addPersonalHistory(betRecord);
    
    // 模拟结算（1-5分钟后自动结算）
    scheduleSettlement(betRecord, type);
}

// 模拟结算
function scheduleSettlement(betRecord, type) {
    const delay = Math.random() * 240000 + 60000; // 1-5分钟
    
    setTimeout(() => {
        // 模拟价格波动结果
        const priceChange = (Math.random() - 0.5) * 0.1; // -5% 到 +5%
        const isWin = (type === 'YES' && priceChange > 0) || (type === 'NO' && priceChange < 0);
        
        betRecord.status = isWin ? '已中奖' : '未中奖';
        betRecord.result = (priceChange * 100).toFixed(2) + '%';
        
        if (isWin) {
            // 获胜赔付 1.95倍（赔率）
            betRecord.payout = betRecord.amount * 1.95;
            poolData.welfarePool -= betRecord.payout - betRecord.amount;
        } else {
            // 投注金额进入奖金池
        }
        
        savePoolData();
        updatePoolDisplay();
        
        // 通知用户
        if (userAddress && poolData.userBets[userAddress]) {
            const latestBet = poolData.userBets[userAddress].find(b => b.id === betRecord.id);
            if (latestBet) {
                alert(`🎉 结算通知！

${betRecord.coin} 走势: ${betRecord.result}
你的投注: ${type}
结果: ${isWin ? '✅ 中奖' : '❌ 未中'}
${isWin ? `💰 获得赔付: ${betRecord.payout.toFixed(2)} USDT` : ''}`);
            }
        }
    }, delay);
}

// 添加到个人历史
function addPersonalHistory(betRecord) {
    const historySection = document.querySelector('.personal-history-list');
    if (!historySection) return;
    
    const recordHtml = `
        <div class="history-item">
            <div class="history-coin">${betRecord.coin}</div>
            <div class="history-amount">${betRecord.amount} USDT</div>
            <div class="history-type ${betRecord.type}">${betRecord.type}</div>
            <div class="history-result">${betRecord.status}</div>
        </div>
    `;
    
    historySection.insertAdjacentHTML('afterbegin', recordHtml);
}

// 连接钱包
async function connectWallet() {
    // 检查可用的钱包提供商
    const walletProviders = [
        { name: 'MetaMask', id: 'metamask', check: () => window.ethereum?.isMetaMask },
        { name: 'Binance Wallet', id: 'binance', check: () => window.BinanceChain },
        { name: 'Trust Wallet', id: 'trust', check: () => window.ethereum?.isTrust },
        { name: 'Coinbase Wallet', id: 'coinbase', check: () => window.ethereum?.isCoinbaseWallet },
        { name: 'OKX Wallet', id: 'okx', check: () => window.ethereum?.isOKXWallet }
    ];
    
    // 优先使用已连接的钱包
    if (window.ethereum && window.ethereum.selectedAddress) {
        await connectToProvider(window.ethereum);
        return;
    }
    
    // 尝试找到可用的钱包
    for (const wallet of walletProviders) {
        if (wallet.check()) {
            await connectToProvider(window.ethereum);
            return;
        }
    }
    
    // 如果没有安装任何钱包，显示钱包选择提示
    showWalletOptions();
}

async function connectToProvider(ethereum) {
    try {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        connected = true;
        
        // 更新UI
        document.querySelector('.connect-btn').textContent = '已连接钱包';
        document.querySelector('.wallet-amount').textContent = '获取余额...';
        
        fetchWalletBalance();
        
        // 监听账户变化
        ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else {
                userAddress = accounts[0];
                fetchWalletBalance();
            }
        });
        
    } catch (error) {
        alert('钱包连接失败：' + error.message);
    }
}

function showWalletOptions() {
    const walletList = `
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;">
            <div style="background:#1a1e2d;padding:30px;border-radius:15px;max-width:320px;width:90%;">
                <h3 style="margin:0 0 20px;color:#fff;text-align:center;">选择钱包连接</h3>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <a href="https://metamask.io/download/" target="_blank" style="background:#f6851b;color:#fff;padding:15px;border-radius:10px;text-decoration:none;text-align:center;font-weight:bold;">🦊 MetaMask</a>
                    <a href="https://www.binance.com/en/web3/wallet" target="_blank" style="background:#f0b90b;color:#000;padding:15px;border-radius:10px;text-decoration:none;text-align:center;font-weight:bold;">🔶 Binance Wallet</a>
                    <a href="https://trustwallet.com/download/" target="_blank" style="background:#3375bb;color:#fff;padding:15px;border-radius:10px;text-decoration:none;text-align:center;font-weight:bold;">🔷 Trust Wallet</a>
                    <a href="https://www.coinbase.com/wallet" target="_blank" style="background:#0052ff;color:#fff;padding:15px;border-radius:10px;text-decoration:none;text-align:center;font-weight:bold;">💰 Coinbase Wallet</a>
                    <a href="https://www.okx.com/web3" target="_blank" style="background:#000;color:#fff;padding:15px;border-radius:10px;text-decoration:none;text-align:center;font-weight:bold;">🟢 OKX Wallet</a>
                    <button onclick="this.closest('div').remove()" style="background:#666;color:#fff;padding:15px;border-radius:10px;border:none;cursor:pointer;margin-top:10px;">关闭</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', walletList);
}

function disconnectWallet() {
    userAddress = '';
    connected = false;
    document.querySelector('.connect-btn').textContent = '连接钱包';
    document.querySelector('.wallet-amount').textContent = '0 USDT';
}

// 获取钱包余额
async function fetchWalletBalance() {
    try {
        // 获取USDT余额
        const config = contractConfig[currentNetwork];
        const balance = await getUSDTBalance(userAddress);
        
        document.querySelector('.wallet-amount').textContent = `${balance} USDT`;
    } catch (error) {
        console.error('获取余额失败:', error);
        document.querySelector('.wallet-amount').textContent = '0 USDT';
    }
}

// 刷新余额
function refreshWallet() {
    if (!connected) {
        alert('请先连接钱包！');
        return;
    }
    
    fetchWalletBalance();
}

// 更新价格信息
function updatePriceInfo(coin) {
    // 模拟实时价格数据
    const prices = {
        BTC: { price: '78,432.18', change: '+2.34%' },
        ETH: { price: '4,356.42', change: '-1.21%' },
        BNB: { price: '587.31', change: '+0.87%' },
        SOL: { price: '167.89', change: '+3.52%' },
        TRX: { price: '0.1257', change: '-0.45%' },
        ADA: { price: '0.678', change: '+1.23%' },
        DOT: { price: '8.45', change: '-0.78%' },
        MATIC: { price: '1.23', change: '+0.56%' },
        LINK: { price: '17.89', change: '+2.15%' },
        XRP: { price: '0.67', change: '-0.32%' }
    };
    
    const priceInfo = prices[coin] || { price: '78,432.18', change: '+2.34%' };
    document.querySelector('.current-price').textContent = `$${priceInfo.price}`;
    document.querySelector('.price-change').textContent = priceInfo.change;
}

// 更新K线图
function updateChart(period) {
    const chartContainer = document.querySelector('.chart-placeholder');
    chartContainer.textContent = `K线图 - ${period} 周期`;
}

// 添加个人参与记录
function addPersonalHistory(name, amount, type) {
    const personalHistoryList = document.querySelector('.personal-history-list');
    
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
    
    const historyItem = document.createElement('div');
    historyItem.className = 'personal-history-item';
    
    historyItem.innerHTML = `
        <div class="personal-history-info">
            <div class="personal-history-name">${name}</div>
            <div class="personal-history-result pending">PENDING</div>
        </div>
        <div class="personal-history-details">
            <div class="personal-history-time">${timeStr}</div>
            <div class="personal-history-amount">${amount} USDT</div>
        </div>
    `;
    
    personalHistoryList.appendChild(historyItem);
}

// 购买套餐
function buyPackage(type) {
    if (!connected) {
        alert('请先连接钱包！');
        return;
    }
    
    const prices = {
        basic: 99,
        pro: 299,
        premium: 999
    };
    
    alert(`购买${type}套餐：${prices[type]} USDT`);
}

// 保存AI设置
function saveAiSettings() {
    const target = document.getElementById('ai-target').value;
    const coins = document.getElementById('ai-coins').value;
    const maxInvest = document.getElementById('ai-max-invest').value;
    const maxLoss = document.getElementById('ai-max-loss').value;
    const searchFreq = document.getElementById('ai-search-freq').value;
    
    alert(`AI设置已保存：\n预测目标：${target}\n币种选择：${coins}\n投资上限：${maxInvest} USDT\n亏损上限：${maxLoss} USDT\n搜索频率：${searchFreq}`);
}

// 查看节点记录
function viewNodeRecords() {
    alert('节点记录查看');
}

// 激活节点
function activateNode() {
    if (!connected) {
        alert('请先连接钱包！');
        return;
    }
    
    alert('激活节点功能');
}

// 复制邀请链接
function copyInviteLink() {
    const link = document.querySelector('.invite-link').textContent;
    
    // 模拟复制
    navigator.clipboard.writeText(link).then(() => {
        alert('链接已复制到剪贴板');
    }).catch(() => {
        // 备用方法
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('链接已复制');
    });
}

// 模拟获取USDT余额
async function getUSDTBalance(address) {
    return Math.floor(Math.random() * 1000);
}

// 初始化
function initApp() {
    // 设置默认选择
    selectCategory('crypto');
    selectCoin('BTC');
    setPeriod('1h');
    selectBetType('YES');
    
    // 检查是否已连接钱包
    if (window.ethereum && window.ethereum.selectedAddress) {
        userAddress = window.ethereum.selectedAddress;
        connected = true;
        document.querySelector('.connect-btn').textContent = '已连接钱包';
        fetchWalletBalance();
    }
}

// 页面加载完成后初始化
window.addEventListener('load', initApp);

// MetaMask检测
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            userAddress = '';
            connected = false;
            document.querySelector('.connect-btn').textContent = '连接钱包';
            document.querySelector('.wallet-amount').textContent = '0 USDT';
        } else {
            userAddress = accounts[0];
            connected = true;
            document.querySelector('.connect-btn').textContent = '已连接钱包';
            fetchWalletBalance();
        }
    });
    
    window.ethereum.on('chainChanged', () => {
        fetchWalletBalance();
    });
}