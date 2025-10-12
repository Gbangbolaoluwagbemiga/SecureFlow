# 🚀 SecureFlow Deployment Guide

## Overview

This guide will help you deploy the new advanced SecureFlow contract and update all necessary files.

## Prerequisites

- Sufficient MON tokens (at least 0.1 MON recommended)
- MetaMask or compatible wallet
- Node.js and npm installed

## Step 1: Get MON Tokens

1. Visit the Monad testnet faucet: https://testnet-faucet.monad.xyz/
2. Enter your wallet address: `0x3Be7fbBDbC73Fc4731D60EF09c4BA1A94DC58E41`
3. Request MON tokens

## Step 2: Deploy Contract

```bash
# Deploy the new contract and update all files
npx hardhat run scripts/deploy-and-update.js --network monad
```

This script will:

- ✅ Deploy the new SecureFlow contract
- ✅ Authorize the deployer as arbiter
- ✅ Update `deployed-addresses.json`
- ✅ Update `contracts-abi.json`
- ✅ Update frontend config files
- ✅ Update frontend ABI files

## Step 3: Verify Deployment

1. Check the contract on Monad Explorer
2. Verify all files have been updated
3. Test the frontend connection

## New Contract Features

### 🆕 Advanced Features

- **Native MON Support**: Create escrows with native MON tokens
- **ERC20 Permit Support**: Gasless approvals using EIP-2612
- **Platform Fees**: Configurable platform fees with fee collector
- **Arbiter Authorization**: Whitelist system for arbiters
- **Token Whitelisting**: Control which ERC20 tokens are allowed
- **Emergency Refunds**: Advanced refund mechanisms
- **Deadline Extension**: Extend escrow deadlines
- **Enhanced Disputes**: Improved dispute resolution system
- **SafeERC20**: Secure token transfers
- **Pausable**: Emergency pause functionality

### 🔧 Admin Functions

- `setPlatformFeeBP(uint256 _bp)`: Set platform fee in basis points
- `setFeeCollector(address _collector)`: Set fee collector address
- `whitelistToken(address token)`: Whitelist an ERC20 token
- `blacklistToken(address token)`: Remove token from whitelist
- `authorizeArbiter(address arbiter)`: Authorize an arbiter
- `revokeArbiter(address arbiter)`: Revoke arbiter authorization
- `withdrawFees(address token)`: Withdraw collected platform fees
- `emergencyWithdraw(address token, uint256 amount)`: Emergency withdrawal
- `pause()` / `unpause()`: Pause/unpause the contract

### 💰 Escrow Creation Options

1. **ERC20 Escrow**: `createEscrow()` - Standard ERC20 escrow
2. **Native MON Escrow**: `createEscrowNative()` - Using native MON tokens
3. **Permit Escrow**: `createEscrowWithPermit()` - Gasless ERC20 approval

### 🛡️ Security Features

- **ReentrancyGuard**: Protection against reentrancy attacks
- **Ownable**: Owner-only functions
- **Pausable**: Emergency pause capability
- **SafeERC20**: Safe token transfers
- **Input Validation**: Comprehensive parameter validation

## File Structure After Deployment

```
├── contracts/
│   └── SecureFlow.sol (new advanced contract)
├── scripts/
│   ├── deploy-and-update.js (comprehensive deployment)
│   ├── deploy-minimal.js (minimal gas deployment)
│   └── update-frontend.js (frontend update script)
├── test/
│   └── SecureFlow.test.js (updated tests)
├── Frontend/
│   ├── lib/web3/
│   │   ├── config.ts (updated with new contract address)
│   │   └── abis.ts (updated ABI)
│   └── contexts/
│       └── web3-context.tsx (updated for new features)
├── deployed-addresses.json (deployment info)
├── contracts-abi.json (contract ABI)
└── DEPLOYMENT_GUIDE.md (this file)
```

## Testing the Deployment

### 1. Check Contract Info

```javascript
// Get contract information
const contract = await ethers.getContractAt("SecureFlow", contractAddress);
console.log("Owner:", await contract.owner());
console.log("Fee Collector:", await contract.feeCollector());
console.log("Platform Fee BP:", await contract.platformFeeBP());
console.log("Next Escrow ID:", await contract.nextEscrowId());
```

### 2. Test Frontend Connection

1. Start the frontend: `cd Frontend && npm run dev`
2. Connect your wallet
3. Switch to Monad Testnet
4. Test creating an escrow

## Troubleshooting

### Insufficient Balance

- Get more MON tokens from the faucet
- Check your balance: `npx hardhat run scripts/check-balance.js --network monad`

### Network Issues

- Ensure you're on Monad Testnet (Chain ID: 10143)
- Add the network to MetaMask if needed

### Contract Issues

- Verify the contract on Monad Explorer
- Check the deployment logs for errors

## Next Steps

1. **Verify Contract**: Verify on Monad Explorer
2. **Test Features**: Test all new contract features
3. **Update Documentation**: Update your project documentation
4. **Frontend Testing**: Test the updated frontend
5. **Production Ready**: Your contract is now production-ready!

## Support

If you encounter any issues:

1. Check the deployment logs
2. Verify your MON token balance
3. Ensure you're on the correct network
4. Check the contract on Monad Explorer

---

**🎉 Congratulations!** You now have a production-ready, advanced escrow platform with native MON support and all the latest features!
