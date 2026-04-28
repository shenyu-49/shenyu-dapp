// 神预DApp 后端服务
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 合约配置
const CONTRACT_ADDRESSES = {
    97: {  // BSC测试网
        shenyu: "0x3817E3f1cb17De35016fEf4F2CB7d197777d57f3",
        usdt: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"
    },
    56: {  // BSC主网
        shenyu: "0x0000000000000000000000000000000000000000",
        usdt: "0x55d398326f99059fF775485246999027B3197955"
    }
};

// 内存缓存（生产环境应用Redis）
let cache = {
    rounds: [],
    stats: {
        totalPool: 0,
        totalUsers: 0,
        activeRounds: 0,
        communityPool: 0
    },
    lastUpdate: 0
};

// API: 获取合约地址
app.get('/api/config/:chainId', (req, res) => {
    const chainId = parseInt(req.params.chainId);
    const config = CONTRACT_ADDRESSES[chainId];
    
    if (!config) {
        return res.status(400).json({ error: '不支持的网络' });
    }
    
    res.json(config);
});

// API: 获取统计数据
app.get('/api/stats', (req, res) => {
    res.json(cache.stats);
});

// API: 获取预测列表
app.get('/api/rounds', (req, res) => {
    const { status } = req.query;
    let rounds = cache.rounds;
    
    if (status !== undefined) {
        rounds = rounds.filter(r => r.status === parseInt(status));
    }
    
    res.json(rounds);
});

// API: 获取单个预测详情
app.get('/api/rounds/:id', (req, res) => {
    const round = cache.rounds.find(r => r.id === parseInt(req.params.id));
    
    if (!round) {
        return res.status(404).json({ error: '预测不存在' });
    }
    
    res.json(round);
});

// API: 获取用户信息
app.get('/api/users/:address', (req, res) => {
    const { address } = req.params;
    
    // 这里应该查询区块链
    // 简化版本返回空数据
    res.json({
        address,
        activePoints: 0,
        totalDeposit: 0,
        teamEarned: 0,
        nodeLevel: 0,
        activated: false
    });
});

// API: 获取节点信息
app.get('/api/nodes', (req, res) => {
    res.json({
        genesis: { count: 0, max: 49 },
        super: { count: 0, max: 300 },
        normal: { count: 0, max: 600 }
    });
});

// API: 获取排行榜
app.get('/api/ranking', (req, res) => {
    const { day } = req.query;
    
    // 返回模拟数据
    res.json({
        day: day || Math.floor(Date.now() / 86400000),
        topUsers: [],
        totalReward: 0
    });
});

// API: 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// 前端路由
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔮 神预DApp 后端服务已启动                              ║
║                                                           ║
║   本地: http://localhost:${PORT}                            ║
║   前端: http://localhost:${PORT}/index.html                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;