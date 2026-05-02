// 神预DApp前端逻辑
// 合约配置
const contractConfig = {
    testnet: {
        ShenYu: "0x3817E3f1cb17De35016fEf4F2CB7d197777d57f3",
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

// 页面切换
function switchSection(section) {
    // 隐藏所有section
    document.getElementById('home-section').classList.remove('active');
    document.getElementById('predict-section').classList.remove('active');
    document.getElementById('ai-section').classList.remove('active');
    document.getElementById('my-section').classList.remove('active');
    
    // 显示当前section
    document.getElementById(`${section}-section`).classList.add('active');
    
    // 更新底部导航
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 激活当前按钮
    document.querySelector(`.nav-btn[onclick="switchSection('${section}')"]`).classList.add('active');
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
    const amount = document.querySelector('.bet-input').value;
    const type = document.querySelector('.bet-btn-yes').style.backgroundColor === '#00c853' ? 'YES' : 'NO';
    
    if (!connected) {
        alert('请先连接钱包！');
        return;
    }
    
    if (!amount || amount < 10) {
        alert('请输入大于等于10 USDT的金额！');
        return;
    }
    
    // 模拟投注逻辑
    alert(`已提交投注：${amount} USDT，类型：${type}`);
    
    // 添加到个人记录
    addPersonalHistory('BTC/USDT', amount, type);
}

// 连接钱包
async function connectWallet() {
    // 检测钱包提供商
    let walletProvider = null;
    
    // 检查MetaMask
    if (window.ethereum) {
        walletProvider = window.ethereum;
    }
    // 检查币安钱包（Binance Wallet）
    else if (window.BinanceChain) {
        walletProvider = window.BinanceChain;
    }
    // 检查TP钱包（TokenPocket）
    else if (window.tp) {
        walletProvider = window.tp;
    }
    // 检查Trust Wallet
    else if (window.trustwallet) {
        walletProvider = window.trustwallet;
    }
    // 检查Coinbase Wallet
    else if (window.coinbaseWalletExtension) {
        walletProvider = window.coinbaseWalletExtension;
    }
    // 检查OKX Wallet
    else if (window.okxwallet) {
        walletProvider = window.okxwallet;
    }
    
    if (!walletProvider) {
        // 如果没有钱包，显示选择界面
        showWalletSelector();
        return;
    }
    
    try {
        // 请求连接账户
        const accounts = await walletProvider.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        connected = true;
        
        // 更新UI
        document.querySelector('.connect-btn').textContent = '已连接钱包';
        document.querySelector('.wallet-amount').textContent = '获取余额...';
        
        // 获取余额
        fetchWalletBalance();
        
        // 显示成功消息
        alert('钱包连接成功！');
    } catch (error) {
        alert('钱包连接失败：' + error.message);
    }
}

// 显示钱包选择界面
function showWalletSelector() {
    const walletSelector = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
                <h2>选择钱包</h2>
                <p>您需要安装钱包插件来连接区块链网络</p>
                <div style="margin-top: 20px;">
                    <button onclick="installWallet('MetaMask')" style="background: #f6851b; color: white; padding: 15px; margin: 10px; border-radius: 5px; cursor: pointer;">安装 MetaMask</button>
                    <button onclick="installWallet('Binance')" style="background: #f0b90b; color: white; padding: 15px; margin: 10px; border-radius: 5px; cursor: pointer;">安装 Binance Wallet</button>
                    <button onclick="installWallet('TokenPocket')" style="background: #3cb371; color: white; padding: 15px; margin: 10px; border-radius: 5px; cursor: pointer;">安装 TP Wallet</button>
                    <button onclick="installWallet('TrustWallet')" style="background: #667eea; color: white; padding: 15px; margin: 10px; border-radius: 5px; cursor: pointer;">安装 Trust Wallet</button>
                    <button onclick="installWallet('Coinbase')" style="background: #0052ff; color: white; padding: 15px; margin: 10px; border-radius: 5px; cursor: pointer;">安装 Coinbase Wallet</button>
                    <button onclick="installWallet('OKX')" style="background: #00b8ff; color: white; padding: 15px; margin: 10px; border-radius: 5px; cursor: pointer;">安装 OKX Wallet</button>
                </div>
                <button onclick="hideWalletSelector()" style="background: #ff5252; color: white; padding: 10px; margin-top: 20px; border-radius: 5px; cursor: pointer;">关闭</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', walletSelector);
}

// 隐藏钱包选择界面
function hideWalletSelector() {
    const selector = document.querySelector('[style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; align-items: center; justify-content: center;"]');
    if (selector) selector.remove();
}

// 引导用户安装钱包
function installWallet(walletType) {
    const walletUrls = {
        'MetaMask': 'https://metamask.io/download/',
        'Binance': 'https://www.binance.org/wallet',
        'TokenPocket': 'https://www.tokenpocket.pro/',
    'TrustWallet': 'https://trustwallet.com/download/',
        'Coinbase': 'https://www.coinbase.com/wallet',
        'OKX': 'https://www.okx.com/web3'
    };
    
    window.open(walletUrls[walletType], '_blank');
    alert(`请安装${walletType}钱包，然后重新刷新页面连接`);
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
    let walletProvider = null;
    if (window.ethereum) {
        walletProvider = window.ethereum;
    } else if (window.BinanceChain) {
        walletProvider = window.BinanceChain;
    } else if (window.tp) {
        walletProvider = window.tp;
    } else if (window.trustwallet) {
        walletProvider = window.trustwallet;
    } else if (window.coinbaseWalletExtension) {
        walletProvider = window.coinbaseWalletExtension;
    } else if (window.okxwallet) {
        walletProvider = window.okxwallet;
    }
    
    if (walletProvider && walletProvider.selectedAddress) {
        userAddress = walletProvider.selectedAddress;
        connected = true;
        document.querySelector('.connect-btn').textContent = '已连接钱包';
        fetchWalletBalance();
    }
}

// 页面加载完成后初始化
window.addEventListener('load', initApp);

// 钱包检测
let walletProvider = null;
if (window.ethereum) {
    walletProvider = window.ethereum;
} else if (window.BinanceChain) {
    walletProvider = window.BinanceChain;
} else if (window.tp) {
    walletProvider = window.tp;
} else if (window.trustwallet) {
    walletProvider = window.trustwallet;
} else if (window.coinbaseWalletExtension) {
    walletProvider = window.coinbaseWalletExtension;
} else if (window.okxwallet) {
    walletProvider = window.okxwallet;
}

if (walletProvider) {
    walletProvider.on('accountsChanged', (accounts) => {
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
    
    walletProvider.on('chainChanged', () => {
        fetchWalletBalance();
    });
}