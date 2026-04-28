# 神预DApp - AI驱动的链上二元预测生态

一个基于Binance Smart Chain的链上二元预测平台，结合AI分析功能。

## 功能特点

- **智能合约预测**: 基于BSC链上的智能合约进行预测
- **AI预测助手**: 提供AI分析和建议
- **节点分红机制**: 创世、超级、普通三档节点
- **活跃度补贴**: 亏损用户获得活跃度补贴
- **社区分红**: 7级无限代团队分红体系
- **实时K线**: 对接币安实时数据

## 部署方式

### 本地运行

```bash
npm install
npm start
```

访问：http://localhost:3000

### Vercel部署

自动部署到Vercel平台，生成https://shenyu-dapp.vercel.app

## 技术架构

### 前端
- HTML/CSS/JavaScript
- Web3.js钱包连接
- 实时数据展示

### 后端
- Express服务器
- API接口
- 模拟数据服务

### 智能合约
- BSC测试网合约地址：0x3817E3f1cb17De35016fEf4F2CB7d197777d57f3
- BSC主网USDT地址：0x55d398326f99059ff775485246999027b3197955

## 经济模型

### 资金分配
- 79% - 赢家池
- 15% - 社区福利池
- 5% - 平台运营
- 1% - 节点池

### 活跃度体系
- 亏损用户获得活跃度补贴（1 USDT = 1.5活跃度）
- 活跃度用于领取福利池分红

### 团队分红
- 7级无限代分红
- 激活条件：个人流水≥10 USDT + 直推5个有效会员

### 节点治理
- 创世节点：10,000 USDT（49个名额）
- 超级节点：3,000 USDT（300个名额）
- 普通节点：1,000 USDT（600个名额）

## API接口

### 配置接口
`GET /api/contract/config`

### 价格接口
`GET /api/binance/price/:coin`

### 事件接口
`GET /api/events/active`

### 排行榜接口
`GET /api/leaderboard/top10`

### 用户接口
`GET /api/user/:address`

### 池接口
`GET /api/pools`

### 节点数据接口
`GET /api/nodes/stats`

### 活跃度接口
`GET /api/activity/global`

### 补贴接口
`GET /api/rewards/daily`

## 使用说明

1. 连接钱包（支持MetaMask）
2. 选择预测板块和币种
3. 查看实时K线数据
4. 输入金额选择YES/NO投注
5. 查看投注历史和收益

## 联系方式

如有问题，请联系技术支持。