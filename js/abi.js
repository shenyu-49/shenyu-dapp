// 神预DApp ABI - 完整版合约接口
const SHENYU_ABI = [
    // 基础函数
    "function register(address _inviter) external",
    "function createRound(string calldata _title, uint256 _minBet) external",
    "function bet(uint256 _rid, uint8 _side, uint256 _amt) external",
    "function settle(uint256 _rid, uint8 _winSide) external",
    "function claim(uint256 _rid) external",
    "function claimCommunityBenefit() external",
    "function registerNode() external",
    "function distributeNodeDividends() external",
    
    // 读取函数
    "function rounds(uint256) view returns (id, title, creator, endTime, status, totalYes, totalNo, totalPool, creatorRewardRate)",
    "function users(address) view returns (inviter, activePoints, totalDeposit, teamEarned, dailyFlow, effectiveDirectReferrals, nodeLevel, activated)",
    "function bets(uint256, address) view returns (amount, side, claimed)",
    "function roundId() view returns (uint256)",
    "function communityPool() view returns (uint256)",
    "function nodePool() view returns (uint256)",
    "function genesisNodeCount() view returns (uint256)",
    "function superNodeCount() view returns (uint256)",
    "function normalNodeCount() view returns (uint256)",
    "function totalUserCount() view returns (uint256)",
    "function totalDepositInSystem() view returns (uint256)",
    "function genesisNodes(uint256) view returns (address)",
    "function superNodes(uint256) view returns (address)",
    "function normalNodes(uint256) view returns (address)",
    "function isGenesisNode(address) view returns (bool)",
    "function isSuperNode(address) view returns (bool)",
    "function isNormalNode(address) view returns (bool)",
    "function dailyRankingPoints(uint256, address) view returns (uint256)",
    
    // 常量
    "function GENESIS_NODE_MIN() view returns (uint256)",
    "function SUPER_NODE_MIN() view returns (uint256)",
    "function NORMAL_NODE_MIN() view returns (uint256)",
    "function GENESIS_NODE_MAX() view returns (uint256)",
    "function SUPER_NODE_MAX() view returns (uint256)",
    "function NORMAL_NODE_MAX() view returns (uint256)",
    "function ACTIVATION_FLOW() view returns (uint256)",
    "function ACTIVATION_DIRECT() view returns (uint256)",
    
    // 事件
    "event BetDone(address indexed user, uint256 indexed rid, uint8 side, uint256 amt)",
    "event Claimed(address indexed user, uint256 indexed rid, uint256 amt)",
    "event RoundCreated(uint256 rid, string title, address creator)",
    "event RoundSettled(uint256 indexed rid, uint8 winSide, uint256 winnerPool)",
    "event UserRegistered(address indexed user, address indexed inviter)",
    "event UserActivated(address indexed user)",
    "event NodeRegistered(address indexed user, uint8 level)",
    "event CreatorReward(address indexed creator, uint256 eventId, uint256 reward)",
    "event RankingRewardDistributed(uint256 day, address[] topUsers, uint256 totalAmount)",
    "event NodeDividendDistributed(address indexed node, uint256 amount, string dividendType)",
    "event Burned(uint256 amt)"
];

// USDT ABI (ERC20)
const USDT_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

// 合约配置
const CONTRACT_CONFIG = {
    // BSC测试网
    97: {
        shenyuContract: "0x575FE036561B56658484663f6927984f3C6a3704",
        usdtContract: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
        chainName: "BSC Testnet",
        chainId: "0x61"
    },
    // BSC主网 (需要替换为实际部署地址)
    56: {
        shenyuContract: "0x0000000000000000000000000000000000000000",
        usdtContract: "0x55d398326f99059fF775485246999027B3197955",
        chainName: "BSC Mainnet",
        chainId: "0x38"
    }
};

// 导出
window.SHENYU_ABI = SHENYU_ABI;
window.USDT_ABI = USDT_ABI;
window.CONTRACT_CONFIG = CONTRACT_CONFIG;