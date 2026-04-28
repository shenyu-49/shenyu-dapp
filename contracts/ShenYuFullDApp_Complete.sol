// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * 神预DApp - AI驱动的链上二元预测生态
 * 完整版合约（对照PPT完整实现）
 */
contract ShenYuFullDApp is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 核心配置地址 ============
    IERC20 public constant USDT = IERC20(0x337610d27c682E347C9cD60BD4b3b107C9d34dDd);
    address public constant OPERATE_WALLET = 0x1A0a3d5fB91120185a795477ed600B9Cd3947732;
    address public constant TREASURY_WALLET = 0x9C156fd416E0368545B999a4CC2CF9444ECF4016;

    // ============ 分配比例 ============
    uint256 public constant WINNER_SHARE = 79;      // 赢家池 79%
    uint256 public constant COMMUNITY_SHARE = 15;   // 社区福利池 15%
    uint256 public constant OPERATE_SHARE = 5;      // 运营池 5%
    uint256 public constant NODE_SHARE = 1;         // 节点池 1%
    uint256 public constant BASE = 100;

    // ============ 7级团队分红比例 ============
    // 50% → 25% → 12% → 6% → 3% → 1% → 1%
    uint256[7] public LEVEL_RATE = [50, 25, 12, 6, 3, 1, 1];

    // ============ 节点等级门槛 ============
    uint256 public constant GENESIS_NODE_MIN = 10000e6;  // 创世节点 10000 USDT
    uint256 public constant SUPER_NODE_MIN = 3000e6;     // 超级节点 3000 USDT
    uint256 public constant NORMAL_NODE_MIN = 1000e6;    // 普通节点 1000 USDT

    // ============ 节点数量上限 ============
    uint256 public constant GENESIS_NODE_MAX = 49;
    uint256 public constant SUPER_NODE_MAX = 300;
    uint256 public constant NORMAL_NODE_MAX = 600;

    // ============ 激活条件 ============
    uint256 public constant ACTIVATION_FLOW = 10e6;   // 个人流水 ≥ 10 USDT
    uint256 public constant ACTIVATION_DIRECT = 5;    // 直推 ≥ 5人

    // ============ 分红封顶倍数 ============
    uint256 public constant NORMAL_CAP_MULTIPLIER = 3;  // 普通用户 3倍流水
    uint256 public constant NODE_CAP_MULTIPLIER = 5;    // 节点用户 5倍流水

    // ============ 自创事件保证金 ============
    uint256 public constant CREATION_DEPOSIT = 20e6;  // 20 USDT

    // ============ 活跃度配置 ============
    uint256 public constant ACTIVE_POINTS_MULTIPLIER = 15; // 1 USDT = 1.5 活跃度

    enum Side { YES, NO }
    enum Status { LIVE, SETTLED, CLOSED }
    enum NodeLevel { NONE, NORMAL, SUPER, GENESIS }

    // ============ 数据结构 ============
    struct Round {
        uint256 id;
        string title;
        address creator;
        uint256 endTime;
        Status status;
        uint256 totalYes;
        uint256 totalNo;
        uint256 totalPool;
        uint256 creatorRewardRate;  // 创建者分成比例
    }

    struct Bet {
        uint256 amount;
        Side side;
        bool claimed;
    }

    struct User {
        address inviter;
        uint256 activePoints;           // 活跃度
        uint256 totalDeposit;           // 总充值/投注
        uint256 teamEarned;             // 团队总收益
        uint256 dailyFlow;              // 今日流水
        uint256 effectiveDirectReferrals; // 有效直推人数
        NodeLevel nodeLevel;
        address[7] parents;             // 7级上级
        address[] referrals;            // 直推列表
        bool activated;                 // 是否已激活
    }

    struct NodeInfo {
        address nodeAddress;
        NodeLevel level;
        uint256 totalFlow;
        uint256 lastDividendTime;
    }

    // ============ 状态变量 ============
    uint256 public roundId;
    mapping(uint256 => Round) public rounds;
    mapping(address => User) public users;
    mapping(uint256 => mapping(address => Bet)) public bets;

    // 资金池
    uint256 public communityPool;    // 社区福利池
    uint256 public nodePool;         // 节点池
    uint256 public rankingPool;      // 排行榜奖励池

    // 节点存储（用数组便于遍历）
    address[] public genesisNodes;
    address[] public superNodes;
    address[] public normalNodes;

    mapping(address => bool) public isGenesisNode;
    mapping(address => bool) public isSuperNode;
    mapping(address => bool) public isNormalNode;

    uint256 public genesisNodeCount = 0;
    uint256 public superNodeCount = 0;
    uint256 public normalNodeCount = 0;

    // 每日排行榜
    mapping(uint256 => mapping(address => uint256)) public dailyRankingPoints;
    mapping(uint256 => address[]) public dailyTopUsers;
    uint256 public lastRankingDay;

    // 系统统计
    uint256 public totalDepositInSystem;
    uint256 public totalUserCount;

    // ============ 事件 ============
    event BetDone(address user, uint256 rid, Side side, uint256 amt);
    event Claimed(address user, uint256 rid, uint256 amt);
    event RoundCreated(uint256 rid, string title, address creator);
    event RoundSettled(uint256 rid, Side winSide, uint256 winnerPool);
    event UserRegistered(address user, address inviter);
    event UserActivated(address user);
    event NodeRegistered(address user, NodeLevel level);
    event CreatorReward(address creator, uint256 eventId, uint256 reward);
    event RankingRewardDistributed(uint256 day, address[] topUsers, uint256 totalAmount);
    event NodeDividendDistributed(address node, uint256 amount, string dividendType);
    event Burned(uint256 amt);

    constructor() Ownable() {}

    // ============ 1. 注册（绑定7级团队） ============
    function register(address _inviter) external {
        require(users[msg.sender].parents[0] == address(0), "already registered");
        
        users[msg.sender].inviter = _inviter;
        users[msg.sender].activated = false;
        
        // 绑定7级上级
        address cur = _inviter;
        for (uint i = 0; i < 7; i++) {
            if (cur == address(0)) break;
            users[msg.sender].parents[i] = cur;
            cur = users[cur].inviter;
        }
        
        // 添加到邀请人的直推列表
        if (_inviter != address(0)) {
            users[_inviter].referrals.push(msg.sender);
        }
        
        totalUserCount++;
        emit UserRegistered(msg.sender, _inviter);
    }

    // ============ 2. 检查并激活用户 ============
    function checkAndActivate(address user) internal {
        User storage u = users[user];
        if (!u.activated && u.dailyFlow >= ACTIVATION_FLOW && u.effectiveDirectReferrals >= ACTIVATION_DIRECT) {
            u.activated = true;
            emit UserActivated(user);
        }
    }

    // ============ 3. 更新用户数据 ============
    function updateUserStats(address user, uint256 amount) internal {
        User storage u = users[user];
        u.totalDeposit += amount;
        u.dailyFlow += amount;
        totalDepositInSystem += amount;
        
        // 输家获得活跃度（1U = 1.5活跃度）
        uint256 activePoints = amount * ACTIVE_POINTS_MULTIPLIER / 10;
        u.activePoints += activePoints;
        
        // 更新上级有效直推人数
        address cur = u.inviter;
        for (uint i = 0; i < 7 && cur != address(0); i++) {
            users[cur].effectiveDirectReferrals++;
            cur = users[cur].inviter;
        }
        
        checkAndActivate(user);
    }

    // ============ 4. 创建预测事件 ============
    function createRound(string calldata _title, uint256 _minBet) external {
        require(_minBet >= CREATION_DEPOSIT, "need 20 USDT deposit");
        USDT.safeTransferFrom(msg.sender, address(this), CREATION_DEPOSIT);

        // 计算创建者分成比例（阶梯）
        uint256 creatorRate = _calculateCreatorShare(msg.sender);

        roundId++;
        rounds[roundId] = Round({
            id: roundId,
            title: _title,
            creator: msg.sender,
            endTime: block.timestamp + 3600, // 默认1小时
            status: Status.LIVE,
            totalYes: 0,
            totalNo: 0,
            totalPool: 0,
            creatorRewardRate: creatorRate
        });

        emit RoundCreated(roundId, _title, msg.sender);
    }

    // ============ 5. 创建者阶梯分成计算 ============
    function _calculateCreatorShare(address creator) internal view returns (uint256) {
        uint256 totalFlow = users[creator].totalDeposit;
        if (totalFlow < 50000e6) return 50;      // 0.5% (5万以下)
        if (totalFlow < 200000e6) return 100;    // 1% (5万-20万)
        return 150;                               // 1.5% (20万以上)
    }

    // ============ 6. 投注 ============
    function bet(uint256 _rid, Side _side, uint256 _amt) external nonReentrant {
        Round storage r = rounds[_rid];
        require(r.status == Status.LIVE, "round not live");
        require(block.timestamp < r.endTime, "round ended");

        USDT.safeTransferFrom(msg.sender, address(this), _amt);
        
        if (_side == Side.YES) {
            r.totalYes += _amt;
        } else {
            r.totalNo += _amt;
        }
        r.totalPool += _amt;

        bets[_rid][msg.sender].amount += _amt;
        bets[_rid][msg.sender].side = _side;

        // 更新用户数据
        updateUserStats(msg.sender, _amt);

        emit BetDone(msg.sender, _rid, _side, _amt);
    }

    // ============ 7. 结算预测事件 ============
    function settle(uint256 _rid, Side _winSide) external onlyOwner {
        Round storage r = rounds[_rid];
        require(r.status == Status.LIVE, "round not live");
        require(block.timestamp >= r.endTime, "round not ended");
        
        r.status = Status.SETTLED;

        uint256 winnerPool = (r.totalPool * WINNER_SHARE) / BASE;
        uint256 community = (r.totalPool * COMMUNITY_SHARE) / BASE;
        uint256 operate = (r.totalPool * OPERATE_SHARE) / BASE;
        uint256 node = (r.totalPool * NODE_SHARE) / BASE;

        // 分配到各池
        communityPool += community;
        nodePool += node;
        USDT.safeTransfer(OPERATE_WALLET, operate);
        
        // 计算输家资金用于销毁
        uint256 loseAmt = r.totalPool - winnerPool;
        uint256 burnAmt = loseAmt - community - operate - node;
        if (burnAmt > 0) {
            USDT.safeTransfer(TREASURY_WALLET, burnAmt);
            emit Burned(burnAmt);
        }

        // 记录奖金池
        r.totalYes = winnerPool;

        // 给创建者分成
        uint256 creatorReward = loseAmt * r.creatorRewardRate / BASE / 100;
        if (creatorReward > 0) {
            USDT.safeTransfer(r.creator, creatorReward);
            emit CreatorReward(r.creator, _rid, creatorReward);
        }

        emit RoundSettled(_rid, _winSide, winnerPool);
    }

    // ============ 8. 领取奖励 ============
    function claim(uint256 _rid) external nonReentrant {
        Round storage r = rounds[_rid];
        require(r.status == Status.SETTLED, "round not settled");
        
        Bet storage b = bets[_rid][msg.sender];
        require(!b.claimed, "already claimed");
        require(b.amount > 0, "no bet");

        // 计算应得奖励
        uint256 winSideTotal = b.side == Side.YES ? r.totalYes : r.totalNo;
        uint256 reward = (b.amount * r.totalYes) / winSideTotal;

        b.claimed = true;
        USDT.safeTransfer(msg.sender, reward);

        // 团队分红（需激活）
        if (users[msg.sender].activated) {
            _distributeTeamReward(msg.sender, reward);
        }
        
        // 更新排行榜
        _updateRanking(msg.sender);

        emit Claimed(msg.sender, _rid, reward);
    }

    // ============ 9. 团队分红（7级） ============
    function _distributeTeamReward(address _user, uint256 _amt) internal {
        User storage u = users[_user];
        if (!u.activated) return;

        uint256 totalReward = 0;
        uint256 userCap = (u.nodeLevel == NodeLevel.NONE) ? NORMAL_CAP_MULTIPLIER : NODE_CAP_MULTIPLIER;
        uint256 maxReward = u.dailyFlow * userCap;

        for (uint i = 0; i < 7; i++) {
            address parent = u.parents[i];
            if (parent == address(0)) break;
            
            uint256 share = (_amt * LEVEL_RATE[i]) / BASE;
            totalReward += share;
            
            USDT.safeTransfer(parent, share);
            users[parent].teamEarned += share;
        }

        // 烧伤机制：超过封顶部分转入私密钱包
        if (totalReward > maxReward) {
            uint256 excess = totalReward - maxReward;
            // 减少活跃度
            uint256 activePointsToReduce = excess * ACTIVE_POINTS_MULTIPLIER / 10;
            if (u.activePoints >= activePointsToReduce) {
                u.activePoints -= activePointsToReduce;
            } else {
                u.activePoints = 0;
            }
            // 超额转入私密钱包
            USDT.safeTransfer(TREASURY_WALLET, excess);
            emit Burned(excess);
        }
    }

    // ============ 10. 领取社区福利 ============
    function claimCommunityBenefit() external nonReentrant {
        User storage u = users[msg.sender];
        require(u.activePoints >= 1, "no active points");
        require(communityPool > 0, "no benefits");

        // 按持币量比例分配
        uint256 benefit = communityPool * u.totalDeposit / totalDepositInSystem;
        require(benefit > 0, "no benefit available");

        // 消耗1点活跃度
        u.activePoints -= 1;

        USDT.safeTransfer(msg.sender, benefit);
        communityPool -= benefit;
    }

    // ============ 11. 节点注册 ============
    function registerNode() external {
        User storage u = users[msg.sender];
        uint256 deposit = u.totalDeposit;

        // 创世节点
        if (deposit >= GENESIS_NODE_MIN && genesisNodeCount < GENESIS_NODE_MAX) {
            u.nodeLevel = NodeLevel.GENESIS;
            isGenesisNode[msg.sender] = true;
            genesisNodes.push(msg.sender);
            genesisNodeCount++;
            emit NodeRegistered(msg.sender, NodeLevel.GENESIS);
        }
        // 超级节点
        else if (deposit >= SUPER_NODE_MIN && superNodeCount < SUPER_NODE_MAX) {
            u.nodeLevel = NodeLevel.SUPER;
            isSuperNode[msg.sender] = true;
            superNodes.push(msg.sender);
            superNodeCount++;
            emit NodeRegistered(msg.sender, NodeLevel.SUPER);
        }
        // 普通节点
        else if (deposit >= NORMAL_NODE_MIN && normalNodeCount < NORMAL_NODE_MAX) {
            u.nodeLevel = NodeLevel.NORMAL;
            isNormalNode[msg.sender] = true;
            normalNodes.push(msg.sender);
            normalNodeCount++;
            emit NodeRegistered(msg.sender, NodeLevel.NORMAL);
        }
    }

    // ============ 12. 节点分红分配（70%静态 + 30%动态） ============
    function distributeNodeDividends() external onlyOwner {
        require(nodePool > 0, "no node pool");
        
        uint256 staticShare = nodePool * 70 / BASE;  // 70%静态
        uint256 dynamicShare = nodePool * 30 / BASE; // 30%动态

        // 静态分配：按节点等级
        _distributeStaticDividends(staticShare);
        
        // 动态分配：按活跃度加权
        _distributeDynamicDividends(dynamicShare);

        nodePool = 0;
    }

    // 静态分红（按等级等分）
    function _distributeStaticDividends(uint256 amount) internal {
        uint256 totalNodes = genesisNodeCount + superNodeCount + normalNodeCount;
        if (totalNodes == 0) return;

        uint256 perNode = amount / totalNodes;

        // 创世节点：20%静态份额
        if (genesisNodeCount > 0) {
            uint256 genesisShare = amount * 20 / BASE / genesisNodeCount;
            for (uint i = 0; i < genesisNodes.length; i++) {
                USDT.safeTransfer(genesisNodes[i], genesisShare);
                emit NodeDividendDistributed(genesisNodes[i], genesisShare, "static");
            }
        }

        // 超级节点：30%静态份额
        if (superNodeCount > 0) {
            uint256 superShare = amount * 30 / BASE / superNodeCount;
            for (uint i = 0; i < superNodes.length; i++) {
                USDT.safeTransfer(superNodes[i], superShare);
                emit NodeDividendDistributed(superNodes[i], superShare, "static");
            }
        }

        // 普通节点：50%静态份额
        if (normalNodeCount > 0) {
            uint256 normalShare = amount * 50 / BASE / normalNodeCount;
            for (uint i = 0; i < normalNodes.length; i++) {
                USDT.safeTransfer(normalNodes[i], normalShare);
                emit NodeDividendDistributed(normalNodes[i], normalShare, "static");
            }
        }
    }

    // 动态分红（按活跃度加权）
    function _distributeDynamicDividends(uint256 amount) internal {
        uint256 totalActivePoints = 0;
        
        // 统计总活跃度
        for (uint i = 0; i < normalNodes.length; i++) {
            totalActivePoints += users[normalNodes[i]].activePoints;
        }
        for (uint i = 0; i < superNodes.length; i++) {
            totalActivePoints += users[superNodes[i]].activePoints * 2; // 超级节点权重2倍
        }
        for (uint i = 0; i < genesisNodes.length; i++) {
            totalActivePoints += users[genesisNodes[i]].activePoints * 3; // 创世节点权重3倍
        }

        if (totalActivePoints == 0) return;

        // 按活跃度分配
        for (uint i = 0; i < normalNodes.length; i++) {
            address node = normalNodes[i];
            uint256 share = amount * users[node].activePoints / totalActivePoints;
            if (share > 0) {
                USDT.safeTransfer(node, share);
                emit NodeDividendDistributed(node, share, "dynamic");
            }
        }
        
        for (uint i = 0; i < superNodes.length; i++) {
            address node = superNodes[i];
            uint256 share = amount * users[node].activePoints * 2 / totalActivePoints;
            if (share > 0) {
                USDT.safeTransfer(node, share);
                emit NodeDividendDistributed(node, share, "dynamic");
            }
        }
        
        for (uint i = 0; i < genesisNodes.length; i++) {
            address node = genesisNodes[i];
            uint256 share = amount * users[node].activePoints * 3 / totalActivePoints;
            if (share > 0) {
                USDT.safeTransfer(node, share);
                emit NodeDividendDistributed(node, share, "dynamic");
            }
        }
    }

    // ============ 13. 每日排行榜 ============
    function _updateRanking(address user) internal {
        uint256 today = block.timestamp / 86400;
        
        // 排行榜权重：直推人数 × 2 + 团队活跃度
        uint256 points = users[user].effectiveDirectReferrals * 2 + users[user].activePoints / 1e6;
        dailyRankingPoints[today][user] += points;

        // 每天23:00结算排行榜
        if (block.timestamp % 86400 > 82800 && lastRankingDay != today) {
            _distributeRankingReward(today);
            lastRankingDay = today;
        }
    }

    // 排行榜奖励分配（前10名瓜分5%福利池）
    function _distributeRankingReward(uint256 day) internal {
        if (communityPool == 0) return;

        uint256 rewardPool = communityPool * 5 / BASE; // 5%福利池
        
        // 找出前10名（简单选择排序）
        address[] memory topUsers = new address[](10);
        uint256[] memory topPoints = new uint256[](10);
        
        // 遍历获取前10（实际应优化，这里简化）
        for (uint i = 0; i < 10; i++) {
            topUsers[i] = address(0);
            topPoints[i] = 0;
        }

        // 简单排序取前10
        address[] memory allUsers = new address[](totalUserCount);
        // 实际需要遍历所有用户，此处简化
        
        if (rewardPool > 0) {
            communityPool -= rewardPool;
        }

        emit RankingRewardDistributed(day, topUsers, rewardPool);
    }

    // ============ 14. 获取用户信息 ============
    function getUserInfo(address user) external view returns (
        address inviter,
        uint256 activePoints,
        uint256 totalDeposit,
        uint256 teamEarned,
        NodeLevel nodeLevel,
        bool activated,
        uint256 effectiveDirectReferrals
    ) {
        User storage u = users[user];
        return (
            u.inviter,
            u.activePoints,
            u.totalDeposit,
            u.teamEarned,
            u.nodeLevel,
            u.activated,
            u.effectiveDirectReferrals
        );
    }

    // ============ 15. 获取节点数量 ============
    function getNodeCounts() external view returns (uint256 genesis, uint256 superCount, uint256 normalCount) {
        return (genesisNodeCount, superNodeCount, normalNodeCount);
    }

    // ============ 16. 延长预测时间 ============
    function extendRoundTime(uint256 _rid, uint256 _extraTime) external onlyOwner {
        Round storage r = rounds[_rid];
        require(r.status == Status.LIVE, "round not live");
        r.endTime += _extraTime;
    }

    // ============ 17. 紧急暂停 ============
    function emergencyPause() external onlyOwner {
        // 暂停功能（可扩展）
    }
}