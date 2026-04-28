# 🔮 神预DApp - AI驱动的链上二元预测生态

> 完整的前后端代码 + 智能合约

## 📁 项目结构

```
shenyu-dapp-frontend/
├── contracts/           # 智能合约源码
│   └── ShenYuFullDApp_Complete.sol
├── frontend/            # 前端页面
│   ├── index.html       # 主页面
│   ├── css/style.css    # 样式文件
│   └── js/
│       ├── abi.js       # 合约ABI配置
│       └── app.js       # 前端逻辑
├── server/              # 后端服务
│   └── index.js
├── scripts/             # 部署脚本
│   └── deploy.js
├── hardhat.config.js    # Hardhat配置
├── package.json
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd shenyu-dapp-frontend
npm install
```

### 2. 配置环境

```bash
# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，填入你的私钥
vi .env
```

### 3. 部署智能合约

```bash
# 部署到BSC测试网
npx hardhat run scripts/deploy.js --network bscTestnet

# 部署到BSC主网
npx hardhat run scripts/deploy.js --network bsc
```

### 4. 启动前端

```bash
# 方式1: 直接用浏览器打开
# 编辑 js/abi.js 中的合约地址，然后打开 frontend/index.html

# 方式2: 启动本地服务器
npm start
# 访问 http://localhost:3000
```

## 📋 功能清单

### ✅ 智能合约功能

| 功能 | 说明 |
|------|------|
| 钱包直接支付 | 直接从钱包扣USDT，无需充值 |
| 创建预测 | 抵押20USDT创建预测事件 |
| 投注 | 支持YES/NO二元预测 |
| 自动结算 | 结算后自动分配奖金 |
| 7级团队分红 | 50%/25%/12%/6%/3%/1%/1% |
| 节点系统 | 创世/超级/普通三级节点 |
| 活跃度体系 | 1U=1.5活跃度，领福利消耗1点 |
| 每日排行榜 | 前10名瓜分5%福利池 |
| 节点分红 | 70%静态+30%动态分配 |
| 烧伤机制 | 超额分红转入私密钱包 |

### ✅ 前端功能

| 页面 | 功能 |
|------|------|
| 首页 | 统计面板/进行中预测/最近结果 |
| 参与预测 | 选择预测/投注YES或NO |
| 创建预测 | 创建新预测事件 |
| 排行榜 | 每日排名/奖励分配 |
| 节点中心 | 节点注册/分红领取 |
| 我的 | 用户信息/团队收益/邀请链接 |

## 🔧 配置说明

### 网络配置 (js/abi.js)

```javascript
const CONTRACT_CONFIG = {
    97: {  // BSC测试网
        shenyuContract: "0x你的合约地址",
        usdtContract: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"
    },
    56: {  // BSC主网
        shenyuContract: "0x你的合约地址",
        usdtContract: "0x55d398326f99059fF775485246999027B3197955"
    }
};
```

### 合约参数

| 参数 | 值 | 说明 |
|------|-----|------|
| WINNER_SHARE | 79% | 赢家池比例 |
| COMMUNITY_SHARE | 15% | 社区福利池 |
| OPERATE_SHARE | 5% | 运营池 |
| NODE_SHARE | 1% | 节点池 |
| GENESIS_NODE_MIN | 10000 USDT | 创世节点门槛 |
| SUPER_NODE_MIN | 3000 USDT | 超级节点门槛 |
| NORMAL_NODE_MIN | 1000 USDT | 普通节点门槛 |
| ACTIVATION_FLOW | 10 USDT | 激活流水要求 |
| ACTIVATION_DIRECT | 5人 | 激活直推要求 |

## 📖 使用流程

### 用户操作流程

1. **连接钱包** - 点击"连接钱包"按钮
2. **注册** - 绑定邀请人（可选）
3. **参与预测** - 选择预测事件，投注YES或NO
4. **等待结算** - 预测结束后结算
5. **领取奖励** - 赢家领取奖金
6. **团队分红** - 7级上级获得分红

### 创建预测流程

1. 进入"创建预测"页面
2. 输入预测标题
3. 设置最低投注额（默认20USDT抵押）
4. 选择预测时长
5. 确认创建（抵押20USDT）
6. 等待用户参与
7. 结算后获得创建者分成

### 节点注册流程

1. 累计投注达到门槛
2. 进入"节点中心"
3. 点击"立即注册"
4. 享受节点分红权益

## 🔐 安全注意事项

1. **私钥安全** - 不要将私钥提交到Git
2. **合约审计** - 正式部署前建议找专业审计
3. **测试网验证** - 先在测试网充分测试
4. **权限控制** - onlyOwner函数谨慎使用

## 📞 支持

如有问题，请在群里联系开发团队。

## 📄 许可证

MIT