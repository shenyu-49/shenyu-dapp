// 神预DApp 前端应用 - 完整版
(function() {
    'use strict';

    // ============ 配置 ============
    const CONFIG = {
        // 当前使用BSC测试网
        chainId: 97,
        // 最小投注金额
        minBetAmount: 10,
        // 节点等级名称
        nodeLevelNames: ['无', '普通节点', '超级节点', '创世节点'],
        // 状态名称
        statusNames: ['进行中', '已结算', '已关闭'],
        // 方向名称
        sideNames: ['YES', 'NO']
    };

    // ============ 状态 ============
    let state = {
        walletAddress: null,
        contract: null,
        usdtContract: null,
        rounds: [],
        userInfo: null,
        selectedRound: null,
        selectedSide: null
    };

    // ============ DOM元素 ============
    const elements = {
        connectBtn: document.getElementById('connectBtn'),
        walletAddress: document.getElementById('walletAddress'),
        pages: document.querySelectorAll('.page'),
        navBtns: document.querySelectorAll('.nav-btn'),
        toast: document.getElementById('toast')
    };

    // ============ 初始化 ============
    async function init() {
        // 检查是否有邀请码
        const urlParams = new URLSearchParams(window.location.search);
        const inviteCode = urlParams.get('ref');
        
        // 检查钱包
        if (typeof window.ethereum !== 'undefined') {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
            
            // 检查是否已连接
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } else {
            showToast('请安装MetaMask钱包', 'error');
        }

        // 绑定事件
        bindEvents();
        
        // 如果有邀请码，等待钱包连接后处理
        if (inviteCode) {
            state.pendingInviteCode = inviteCode;
            showToast('请连接钱包完成注册', 'warning');
        }
    }

    // ============ 签名验证 ============
    async function signMessage() {
        if (!state.walletAddress) {
            showToast('请先连接钱包', 'warning');
            return false;
        }
        
        try {
            const message = "欢迎加入神预DApp！\n签名验证登录\n时间: " + Date.now();
            
            // 使用MetaMask签名
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, state.walletAddress]
            });
            
            if (signature) {
                // 签名成功，保存到localStorage
                localStorage.setItem('shenyu_signed', 'true');
                localStorage.setItem('shenyu_address', state.walletAddress);
                localStorage.setItem('shenyu_signature', signature);
                
                // 如果有待处理的邀请码，执行注册
                if (state.pendingInviteCode) {
                    await registerUser(state.pendingInviteCode);
                }
                
                showToast('签名验证成功！', 'success');
                return true;
            }
        } catch (error) {
            console.error('签名失败:', error);
            showToast('签名验证失败: ' + error.message, 'error');
            return false;
        }
    }

    // ============ 注册用户 ============
    async function registerUser(inviteCode) {
        if (!state.walletAddress || !state.contract) return;
        
        try {
            const signer = window.provider.getSigner();
            const contractWithSigner = state.contract.connect(signer);
            
            // 解析邀请码获取上级地址
            const inviterAddress = '0x' + inviteCode.padStart(40, '0').slice(-40);
            
            showToast('正在注册...', 'warning');
            const tx = await contractWithSigner.register(inviterAddress);
            await tx.wait();
            
            showToast('注册成功！', 'success');
            
            // 刷新用户数据
            await loadUserInfo();
        } catch (error) {
            console.error('注册失败:', error);
            // 用户可能已经注册过，忽略错误
            if (error.message.includes('already registered')) {
                showToast('已注册，跳过', 'info');
            } else {
                showToast('注册失败: ' + error.message, 'error');
            }
        }
    }

    // ============ 检查是否已签名 ============
    function checkSigned() {
        const signed = localStorage.getItem('shenyu_signed');
        const savedAddress = localStorage.getItem('shenyu_address');
        
        if (signed && savedAddress === state.walletAddress) {
            return true;
        }
        return false;
    }

    // ============ 钱包连接 ============
    async function connectWallet() {
        try {
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            state.walletAddress = accounts[0];
            updateWalletUI();
            
            // 切换到正确网络
            await switchNetwork();
            
            // 初始化合约
            await initContracts();
            
            // 加载数据
            await loadData();
            
            // 检查是否需要签名
            if (!checkSigned()) {
                // 显示签名按钮
                document.getElementById('signBtn').style.display = 'block';
                showToast('请完成签名验证', 'warning');
            } else {
                showToast('钱包连接成功', 'success');
            }
        } catch (error) {
            console.error('连接钱包失败:', error);
            showToast('连接失败: ' + error.message, 'error');
        }
    }

    async function switchNetwork() {
        const config = CONTRACT_CONFIG[CONFIG.chainId];
        const chainId = config.chainId;
        
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }]
            });
        } catch (error) {
            // 网络不存在，添加网络
            if (error.code === 4902) {
                await addNetwork();
            }
        }
    }

    async function addNetwork() {
        const config = CONTRACT_CONFIG[CONFIG.chainId];
        const networkConfig = {
            chainId: config.chainId,
            chainName: config.chainName,
            nativeCurrency: {
                name: 'BNB',
                symbol: 'BNB',
                decimals: 18
            },
            rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
            blockExplorerUrls: ['https://testnet.bscscan.com']
        };
        
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [networkConfig]
            });
        } catch (error) {
            showToast('添加网络失败', 'error');
        }
    }

    // ============ 合约初始化 ============
    async function initContracts() {
        const config = CONTRACT_CONFIG[CONFIG.chainId];
        
        state.contract = new ethers.Contract(
            config.shenyuContract,
            SHENYU_ABI,
            window.provider
        );
        
        state.usdtContract = new ethers.Contract(
            config.usdtContract,
            USDT_ABI,
            window.provider
        );
        
        // 更新合约地址显示
        document.getElementById('contractAddress').textContent = config.shenyuContract;
    }

    // ============ 数据加载 ============
    async function loadData() {
        try {
            await Promise.all([
                loadRounds(),
                loadStats(),
                loadUserInfo()
            ]);
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    async function loadRounds() {
        const roundId = await state.contract.roundId();
        state.rounds = [];
        
        for (let i = 1; i <= roundId; i++) {
            try {
                const round = await state.contract.rounds(i);
                state.rounds.push({
                    id: i,
                    title: round.title,
                    creator: round.creator,
                    endTime: Number(round.endTime),
                    status: Number(round.status),
                    totalYes: Number(round.totalYes),
                    totalNo: Number(round.totalNo),
                    totalPool: Number(round.totalPool)
                });
            } catch (e) {
                break;
            }
        }
        
        renderRounds();
    }

    async function loadStats() {
        const [totalPool, totalUsers, activeCount, communityPool] = await Promise.all([
            state.contract.totalDepositInSystem(),
            state.contract.totalUserCount(),
            state.contract.roundId(),
            state.contract.communityPool()
        ]);
        
        document.getElementById('totalPool').textContent = formatNumber(totalPool);
        document.getElementById('totalUsers').textContent = totalUsers.toString();
        document.getElementById('activeRounds').textContent = activeCount.toString();
        document.getElementById('communityPool').textContent = formatNumber(communityPool);
    }

    async function loadUserInfo() {
        if (!state.walletAddress) return;
        
        try {
            const info = await state.contract.users(state.walletAddress);
            state.userInfo = {
                inviter: info.inviter,
                activePoints: Number(info.activePoints),
                totalDeposit: Number(info.totalDeposit),
                teamEarned: Number(info.teamEarned),
                dailyFlow: Number(info.dailyFlow),
                effectiveDirectReferrals: Number(info.effectiveDirectReferrals),
                nodeLevel: Number(info.nodeLevel),
                activated: info.activated
            };
            
            updateUserDashboard();
        } catch (error) {
            console.error('加载用户信息失败:', error);
        }
    }

    // ============ 渲染 ============
    function renderRounds() {
        const activeList = document.getElementById('activeRoundsList');
        const settledList = document.getElementById('settledRoundsList');
        
        const active = state.rounds.filter(r => r.status === 0);
        const settled = state.rounds.filter(r => r.status === 1);
        
        // 进行中的
        if (active.length === 0) {
            activeList.innerHTML = '<div class="empty">暂无进行中的预测</div>';
        } else {
            activeList.innerHTML = active.map(r => createRoundCard(r)).join('');
        }
        
        // 已结算
        if (settled.length === 0) {
            settledList.innerHTML = '<div class="empty">暂无已结束预测</div>';
        } else {
            settledList.innerHTML = settled.slice(0, 5).map(r => createRoundCard(r, true)).join('');
        }
        
        // 预测列表
        renderPredictList();
    }

    function createRoundCard(round, settled = false) {
        const timeLeft = settled ? '已结束' : formatTimeLeft(round.endTime);
        const statusClass = settled ? 'settled' : 'live';
        
        return `
            <div class="round-card" onclick="selectRound(${round.id})">
                <div class="round-title">${round.title}</div>
                <div class="round-meta">
                    <span>${statusClass === 'live' ? '🔴 进行中' : '✅ 已结束'}</span>
                    <span>${timeLeft}</span>
                </div>
                <div class="round-pool">
                    <div class="pool-yes">
                        <span class="label">YES</span>
                        <span class="amount">${formatNumber(round.totalYes)} USDT</span>
                    </div>
                    <div class="pool-no">
                        <span class="label">NO</                        <span class="amount">${formatNumber(round.totalNo)} USDT</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderPredictList() {
        const list = document.getElementById('predictList');
        const active = state.rounds.filter(r => r.status === 0);
        
        if (active.length === 0) {
            list.innerHTML = '<div class="empty">暂无进行中的预测</div>';
            return;
        }
        
        list.innerHTML = active.map(r => `
            <div class="predict-card" onclick="selectRound(${r.id})">
                <div class="round-title">${r.title}</div>
                <div class="round-meta">
                    <span>奖池: ${formatNumber(r.totalPool)} USDT</span>
                    <span>${formatTimeLeft(r.endTime)}</span>
                </div>
            </div>
        `).join('');
    }

    function updateUserDashboard() {
        if (!state.userInfo) return;
        
        const u = state.userInfo;
        
        document.getElementById('userTotalDeposit').textContent = formatNumber(u.totalDeposit);
        document.getElementById('userTeamEarned').textContent = formatNumber(u.teamEarned);
        document.getElementById('userActivePoints').textContent = formatNumber(u.activePoints);
        document.getElementById('userNodeLevel').textContent = CONFIG.nodeLevelNames[u.nodeLevel];
        document.getElementById('userDailyFlow').textContent = formatNumber(u.dailyFlow) + ' USDT';
        document.getElementById('userDirectReferrals').textContent = u.effectiveDirectReferrals + ' 人';
        
        const activatedEl = document.getElementById('userActivated');
        if (u.activated) {
            activatedEl.textContent = '已激活';
            activatedEl.className = 'status-yes';
        } else {
            activatedEl.textContent = '未激活';
            activatedEl.className = 'status-no';
        }
        
        // 邀请链接
        if (state.walletAddress) {
            const inviteLink = `${window.location.origin}?ref=${state.walletAddress.slice(2, 10)}`;
            document.getElementById('inviteLink').value = inviteLink;
        }
        
        // 更新节点数量
        updateNodeCounts();
    }

    async function updateNodeCounts() {
        const [genesis, superCount, normal] = await Promise.all([
            state.contract.genesisNodeCount(),
            state.contract.superNodeCount(),
            state.contract.normalNodeCount()
        ]);
        
        document.getElementById('genesisLeft').textContent = 49 - genesis;
        document.getElementById('superLeft').textContent = 300 - superCount;
        document.getElementById('normalLeft').textContent = 600 - normal;
        
        document.getElementById('userDeposit').textContent = formatNumber(state.userInfo.totalDeposit);
    }

    // ============ 用户操作 ============
    window.selectRound = function(roundId) {
        const round = state.rounds.find(r => r.id === roundId);
        if (!round) return;
        
        state.selectedRound = round;
        
        // 更新UI
        document.getElementById('roundTitle').textContent = round.title;
        document.getElementById('roundCreator').textContent = formatAddress(round.creator);
        document.getElementById('roundTimer').textContent = formatTimeLeft(round.endTime);
        document.getElementById('yesPool').textContent = formatNumber(round.totalYes) + ' USDT';
        document.getElementById('noPool').textContent = formatNumber(round.totalNo) + ' USDT';
        
        // 切换到预测页面
        navigateTo('predict');
        
        // 开始倒计时
        startTimer(roundId);
    };

    let timerInterval = null;
    function startTimer(roundId) {
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            const round = state.rounds.find(r => r.id === roundId);
            if (!round) {
                clearInterval(timerInterval);
                return;
            }
            
            document.getElementById('roundTimer').textContent = formatTimeLeft(round.endTime);
        }, 1000);
    }

    window.placeBet = async function() {
        if (!state.selectedRound || !state.selectedSide) {
            showToast('请选择预测方向', 'warning');
            return;
        }
        
        const amount = document.getElementById('betAmount').value;
        if (!amount || Number(amount) < CONFIG.minBetAmount) {
            showToast(`最低投注 ${CONFIG.minBetAmount} USDT`, 'warning');
            return;
        }
        
        try {
            const amountWei = ethers.parseUnits(amount, 6);
            
            // 授权USDT
            const config = CONTRACT_CONFIG[CONFIG.chainId];
            const signer = window.provider.getSigner();
            const usdtWithSigner = state.usdtContract.connect(signer);
            
            const allowance = await state.usdtContract.allowance(
                state.walletAddress,
                config.shenyuContract
            );
            
            if (allowance < amountWei) {
                showToast('正在授权USDT...', 'warning');
                const tx = await usdtWithSigner.approve(config.shenyuContract, amountWei);
                await tx.wait();
                showToast('授权成功', 'success');
            }
            
            // 投注
            showToast('正在投注...', 'warning');
            const contractWithSigner = state.contract.connect(signer);
            const tx = await contractWithSigner.bet(
                state.selectedRound.id,
                state.selectedSide === 'YES' ? 0 : 1,
                amountWei
            );
            
            await tx.wait();
            showToast('投注成功!', 'success');
            
            // 刷新数据
            await loadData();
            
            // 重置表单
            state.selectedSide = null;
            document.getElementById('betAmount').value = '';
            document.querySelectorAll('.btn-side').forEach(btn => btn.classList.remove('selected'));
            document.getElementById('betBtn').disabled = true;
            
        } catch (error) {
            console.error('投注失败:', error);
            showToast('投注失败: ' + error.message, 'error');
        }
    };

    window.createRound = async function() {
        const title = document.getElementById('createTitle').value;
        const minBet = document.getElementById('createMinBet').value;
        const duration = document.getElementById('createDuration').value;
        
        if (!title) {
            showToast('请输入预测标题', 'warning');
            return;
        }
        
        try {
            const config = CONTRACT_CONFIG[CONFIG.chainId];
            const signer = window.provider.getSigner();
            const contractWithSigner = state.contract.connect(signer);
            
            // 授权20USDT保证金
            const depositWei = ethers.parseUnits('20', 6);
            const usdtWithSigner = state.usdtContract.connect(signer);
            
            const allowance = await state.usdtContract.allowance(
                state.walletAddress,
                config.shenyuContract
            );
            
            if (allowance < depositWei) {
                showToast('正在授权USDT...', 'warning');
                const tx = await usdtWithSigner.approve(config.shenyuContract, depositWei);
                await tx.wait();
            }
            
            showToast('正在创建预测...', 'warning');
            const tx = await contractWithSigner.createRound(title, ethers.parseUnits(minBet, 6));
            await tx.wait();
            
            showToast('创建成功!', 'success');
            
            // 刷新数据
            await loadData();
            
            // 重置表单
            document.getElementById('createTitle').value = '';
            
            // 切换到首页
            navigateTo('home');
            
        } catch (error) {
            console.error('创建失败:', error);
            showToast('创建失败: ' + error.message, 'error');
        }
    };

    window.claimBenefit = async function() {
        try {
            const signer = window.provider.getSigner();
            const contractWithSigner = state.contract.connect(signer);
            
            showToast('正在领取...', 'warning');
            const tx = await contractWithSigner.claimCommunityBenefit();
            await tx.wait();
            
            showToast('领取成功!', 'success');
            await loadData();
        } catch (error) {
            console.error('领取失败:', error);
            showToast('领取失败: ' + error.message, 'error');
        }
    };

    window.registerAsNode = async function() {
        try {
            const signer = window.provider.getSigner();
            const contractWithSigner = state.contract.connect(signer);
            
            showToast('正在注册节点...', 'warning');
            const tx = await contractWithSigner.registerNode();
            await tx.wait();
            
            showToast('注册成功!', 'success');
            await loadData();
        } catch (error) {
            console.error('注册失败:', error);
            showToast('注册失败: ' + error.message, 'error');
        }
    };

    window.claimNodeDividends = async function() {
        try {
            const signer = window.provider.getSigner();
            const contractWithSigner = state.contract.connect(signer);
            
            showToast('正在领取分红...', 'warning');
            const tx = await contractWithSigner.distributeNodeDividends();
            await tx.wait();
            
            showToast('领取成功!', 'success');
            await loadData();
        } catch (error) {
            console.error('领取失败:', error);
            showToast('领取失败: ' + error.message, 'error');
        }
    };

    window.copyInviteLink = function() {
        const input = document.getElementById('inviteLink');
        input.select();
        document.execCommand('copy');
        showToast('链接已复制', 'success');
    };

    // ============ 事件绑定 ============
    function bindEvents() {
        // 连接钱包
        elements.connectBtn.addEventListener('click', connectWallet);
        
        // 导航
        elements.navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navigateTo(btn.dataset.page);
            });
        });
        
        // 投注方向选择
        document.querySelectorAll('.btn-side').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-side').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.selectedSide = btn.dataset.side;
                checkBetButton();
            });
        });
        
        // 投注金额
        document.getElementById('betAmount').addEventListener('input', checkBetButton);
        
        // 投注按钮
        document.getElementById('betBtn').addEventListener('click', window.placeBet);
        
        // 创建预测
        document.getElementById('createBtn').addEventListener('click', window.createRound);
        
        // 注册节点
        document.getElementById('registerNodeBtn').addEventListener('click', window.registerAsNode);
        
        // 领取分红
        document.getElementById('claimDividendsBtn').addEventListener('click', window.claimNodeDividends);
        
        // 复制链接
        document.getElementById('copyLinkBtn').addEventListener('click', window.copyInviteLink);
        
        // 签名验证按钮（如果有的话）
        const signBtn = document.getElementById('signBtn');
        if (signBtn) {
            signBtn.addEventListener('click', signMessage);
        }
    }

    function checkBetButton() {
        const amount = document.getElementById('betAmount').value;
        const btn = document.getElementById('betBtn');
        btn.disabled = !state.selectedSide || !amount || Number(amount) < CONFIG.minBetAmount;
    }

    function navigateTo(page) {
        elements.navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
        
        elements.pages.forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });
    }

    // ============ 钱包事件 ============
    function handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            state.walletAddress = null;
            updateWalletUI();
            showToast('钱包已断开', 'warning');
        } else if (accounts[0] !== state.walletAddress) {
            state.walletAddress = accounts[0];
            updateWalletUI();
            loadData();
        }
    }

    function handleChainChanged() {
        window.location.reload();
    }

    function updateWalletUI() {
        if (state.walletAddress) {
            elements.walletAddress.textContent = formatAddress(state.walletAddress);
            elements.connectBtn.textContent = '已连接';
            elements.connectBtn.disabled = true;
        } else {
            elements.walletAddress.textContent = '未连接';
            elements.connectBtn.textContent = '连接钱包';
            elements.connectBtn.disabled = false;
        }
    }

    // ============ 工具函数 ============
    function formatAddress(addr) {
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    function formatNumber(num) {
        return (Number(num) / 1e6).toFixed(2);
    }

    function formatTimeLeft(endTime) {
        const now = Math.floor(Date.now() / 1000);
        const left = endTime - now;
        
        if (left <= 0) return '已结束';
        
        const hours = Math.floor(left / 3600);
        const minutes = Math.floor((left % 3600) / 60);
        const seconds = left % 60;
        
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}天 ${hours % 24}小时`;
        }
        
        return `${hours}小时${minutes}分${seconds}秒`;
    }

    function showToast(message, type = 'info') {
        const toast = elements.toast;
        toast.textContent = message;
        toast.className = 'toast ' + type + ' show';
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // ============ 启动 ============
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();