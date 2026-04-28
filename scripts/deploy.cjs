// 神预DApp 部署脚本
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('\n========================================');
    console.log('  🔮 开始部署神预DApp 智能合约');
    console.log('========================================\n');

    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log('� wallet address:', deployer.address);
    console.log('💰 balance:', (await deployer.getBalance()).toString() / 1e18, 'BNB\n');

    // 1. 部署USDT代币（测试网使用已有的）
    const USDT_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"; // BSC测试网
    console.log('✅ USDT合约地址:', USDT_ADDRESS);

    // 2. 部署主合约
    console.log('\n📦 部署ShenYuFullDApp合约...');
    const ShenYuFullDApp = await ethers.getContractFactory('ShenYuFullDApp');
    
    // 合约无构造函数，直接部署
    const contract = await ShenYuFullDApp.deploy();
    
    await contract.deployed();
    console.log('✅ 合约部署成功!');
    console.log('📍 合约地址:', contract.address);

    // 3. 等待确认
    console.log('\n⏳ 等待区块确认...');
    await contract.deployTransaction.wait(5);

    // 4. 验证部署
    console.log('\n📋 验证部署...');
    const roundId = await contract.roundId();
    console.log('   roundId:', roundId.toString());

    // 5. 保存部署信息
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId,
        deployer: deployer.address,
        contractAddress: contract.address,
        usdtAddress: USDT_ADDRESS,
        timestamp: new Date().toISOString(),
        blockNumber: contract.deployTransaction.blockNumber
    };

    const savePath = path.join(__dirname, '../DEPLOYMENT_INFO.json');
    fs.writeFileSync(savePath, JSON.stringify(deploymentInfo, null, 2));
    console.log('📁 部署信息已保存到:', savePath);

    // 6. 输出结果
    console.log('\n========================================');
    console.log('  ✅ 部署完成!');
    console.log('========================================');
    console.log('📍 合约地址:', contract.address);
    console.log('🌐 BSC扫描: https://testnet.bscscan.com/address/' + contract.address);
    console.log('========================================\n');

    return contract.address;
}

main()
    .then((address) => {
        console.log('✅ 部署成功, 合约地址:', address);
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ 部署失败:', error);
        process.exit(1);
    });