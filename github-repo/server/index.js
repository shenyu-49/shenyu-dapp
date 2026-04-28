// 神预DApp后端服务器
const express = require('express');
const path = require('path');

const app = express();

// 设置静态文件目录
app.use(express.static(path.join(__dirname, '../')));

// API接口 - 获取合约数据
app.get('/api/contract/config', (req, res) => {
    const config = {
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
    
    res.json(config);
});

// API接口 - 获取币安实时价格
app.get('/api/binance/price/:coin', async (req, res) => {
    const coin = req.params.coin;
    
    // 模拟币安实时数据
    const mockPrices = {
        BTC: { price: 78432.18, change: 2.34 },
        ETH: { price: 4356.42, change: -1.21 },
        BNB: { price: 587.31, change: 0.87 },
        SOL: {2: 167.89, change: 3.52 },
        SOL: { price: 167.89, change: 3.52 },
        TRX: { price: 0.1257, change: -0.45 },
        ADA: { price: 0.678, change: 1.23 },
        DOT: { price: 8.45, change: -0.78 },
        MATIC: { price: 1.23, change: 0.56 },
        LINK: { price: 17.89, change: 2.15 },
        XRP: { price: 0.67, change: -0.32 }
    };
    
    const priceData = mockPrices[coin] || { price: 78432.18, change: 2.34 };
    
    res.json({
        coin: coin,
        price: priceData.price,
        change: priceData.change,
        timestamp: Date.now()
    });
});

// API接口 - 获取当前事件列表
app.get('/api/events/active', async (req, res) => {
    const mockEvents = [
        {
            id: 1,
            title: "比特币价格预测",
            description: "预测比特币价格在未来24小时内会上涨吗？",
            creator: "0x1A0a3d5fB91120185a795477ed600B9Cd3947732",
            yesTotal: "1000000",
            noTotal: "500000",
            totalBet: "1500000",
            endTime: Math.floor(Date.now() / 1000) + 86400,
            status: "active"
        },
        {
            id: 2,
            title: "以太坊价格预测",
            description: "预测以太坊价格在未来12小时内会下跌吗？",
            creator: "0x9C156fd416E0368545B999a4CC2CF9444ECF4016",
            yesTotal: "800000",
            noTotal: "900000",
            totalBet: "1700000",
            endTime: Math.floor(Date.now() / 1000) + 43200,
            status: "active"
        }
    ];
    
    res.json(mockEvents);
});

// API接口 - 获取排行榜
app.get('/api/leaderboard/top10', async (req, res) => {
    const mockLeaderboard = [
        {
            rank: 1,
            address: "0x3817E3f1cb17De35016fEf4F2CB7d197777d57f3",
            dailyFlow: "5000000",
            totalDeposit: "10000000"
        },
        {
            rank: 2,
            address: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
            dailyFlow: "3000000",
            totalDeposit: "8000000"
        },
        {
            rank: 3,
            address: "0x1A0a3d5fB91120185a795477ed600B9Cd3947732",
            dailyFlow: "2000000",
            totalDeposit: "5000000"
        }
    ];
    
    res.json(mockLeaderboard);
});

// API接口 - 获取用户信息
app.get('/api/user/:address', async (req, res) => {
    const address = req.params.address;
    
    const mockUserInfo = {
        totalDeposit: "500000",
        totalProfit: "100000",
        dailyFlow: "200000",
        activePoints: "750",
        nodeLevel: "1", // 普通节点
        referrer: "0x9C156fd416E0368545B999a4CC2CF9444ECF4016",
        referralCount: "5"
    };
    
    res.json(mockUserInfo);
});

// API接口 - 获取节点池信息
app.get('/api/pools', async (req, res) => {
    const mockPools = {
        totalPrizePool: "50000000",
        communityPool: "10000000",
        nodePool: "500000",
        operatePool: "2500000"
    };
    
    res.json(mockPools);
});

// API接口 - 获取节点数据
app.get('/api/nodes/stats', async (req, res) => {
    const mockNodesStats = {
        genesis: { count: 49, yesterdayReward: "12250" },
        super: { count: 300, yesterdayReward: "63000" },
        normal: { count: 600, yesterdayReward: "105000" }
    };
    
    res.json(mockNodesStats);
});

// API接口 - 获取活跃度数据
app.get('/api/activity/global', async (req, res) => {
    const mockActivity = {
        personalActivity: "5000000",
        teamActivity: "3500000"
    };
    
    res.json(mockActivity);
});

// API接口 - 获取昨日补贴数据
app.get('/api/rewards/daily', async (req, res) => {
    const mockRewards = {
        personalReward: "412500",
        teamReward: "300000",
        rankingReward: "37500",
        totalReward: "750000"
    };
    
    res.json(mockRewards);
});

// API接口 - 获取AI套餐
app.get('/api/ai/packages', async (req, res) => {
    const mockPackages = [
        {
            name: "基础套餐",
            price: 99,
            features: ["每日5次AI分析", "基础预测建议", "风险等级评估"]
        },
        {
            name: "专业套餐",
            price: 299,
            features: ["每日20次AI分析", "高级预测模型", "实时市场监控", "个性化参数"]
        },
        {
            name: "至尊套餐",
            price: 999,
            features: ["无限AI分析", "深度学习模型", "多维度数据源", "24小时客服", "优先节点特权"]
        }
    ];
    
    res.json(mockPackages);
});

// API接口 - 模拟投注
app.post('/api/bet/submit', async (req, res) => {
    res.json({
        success: true,
        message: "投注成功",
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    });
});

// API接口 - 激活节点
app.post('/api/node/activate', async (req, res) => {
    res.json({
        success: true,
        message: "节点激活成功",
        level: 1 // 普通节点
    });
});

// API接口 - 获取烧伤数据
app.get('/api/burn/:address', async (req, res) => {
    const mockBurnData = {
        burnStatus: "无烧伤",
        burnAmount: "0"
    };
    
    res.json(mockBurnData);
});

// API接口 - 获取推广数据
app.get('/api/referral/:address', async (req, res) => {
    const mockReferralData = {
        directReferrals: 0,
        validAddresses: 0,
        teamActivity: 0
    };
    
    res.json(mockReferralData);
});

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// 监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`神预DApp服务器运行在 http://localhost:${PORT}`);
});

// 错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误' });
});