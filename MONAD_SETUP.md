# 🚀 Monad Testnet Setup Guide

## 🎯 Getting Started with Monad Testnet

### **Step 1: Get MON Testnet Tokens**

1. **Visit Monad Faucet:** https://testnet-monad.xyz
2. **Connect your wallet** (MetaMask)
3. **Add Monad Testnet** to your wallet:
   - **Network Name:** Monad Testnet
   - **RPC URL:** https://testnet-rpc.monad.xyz
   - **Chain ID:** 41474
   - **Currency Symbol:** MON
4. **Request testnet tokens** from the faucet

### **Step 2: Configure Your Environment**

1. **Copy environment file:**

   ```bash
   cp env.example .env
   ```

2. **Add your private key to .env:**

   ```
   PRIVATE_KEY=your_private_key_here
   ```

3. **Add Monad Testnet to MetaMask:**
   - Network Name: Monad Testnet
   - RPC URL: https://testnet-rpc.monad.xyz
   - Chain ID: 41474
   - Currency Symbol: MON

### **Step 3: Deploy to Monad Testnet**

```bash
# Deploy test token and SecureFlow
npm run deploy:token

# Or deploy just SecureFlow
npm run deploy
```

### **Step 4: Verify Deployment**

Your contracts will be deployed to Monad testnet and you'll get:

- **Test Token Address** - For testing escrow functionality
- **SecureFlow Address** - Your main escrow contract
- **Deployed Addresses** - Saved to `deployed-addresses.json`

## 🎯 Using Real Monad Testnet Tokens

### **Benefits:**

- ✅ **Real blockchain** - Actual testnet environment
- ✅ **Real transactions** - Gas fees with MON tokens
- ✅ **Real testing** - Production-like conditions
- ✅ **Hackathon ready** - Judges can interact with real contracts

### **Token Details:**

- **Network:** Monad Testnet
- **Chain ID:** 41474
- **Currency:** MON (testnet tokens)
- **Faucet:** https://testnet-monad.xyz
- **Explorer:** https://testnet-monad.xyz

## 🔧 Development Workflow

### **Local Testing:**

```bash
npm run test        # Test with MockERC20
npm run test:gas    # Test with gas reporting
```

### **Monad Testnet:**

```bash
npm run deploy:token # Deploy test token + SecureFlow
npm run verify      # Verify contracts on explorer
```

### **Frontend Integration:**

```javascript
// Use deployed addresses from deployed-addresses.json
const testTokenAddress = "0x..."; // From deployment
const secureFlowAddress = "0x..."; // From deployment

// Connect to Monad testnet
const provider = new ethers.providers.JsonRpcProvider(
  "https://testnet-rpc.monad.xyz",
);
```

## 🏆 Hackathon Advantages

### **Why Monad Testnet is Perfect:**

- ✅ **Real blockchain** - Not just local testing
- ✅ **EVM compatible** - Works with all Ethereum tools
- ✅ **High performance** - Fast transactions
- ✅ **Public explorer** - Judges can verify contracts
- ✅ **Real gas fees** - Authentic blockchain experience

### **Demo Ready:**

- **Live contracts** on Monad testnet
- **Real MON tokens** for transactions
- **Public verification** on explorer
- **MetaMask integration** ready

## 🚀 Next Steps

1. **Get MON tokens** from faucet
2. **Deploy contracts** to Monad testnet
3. **Build frontend** with real addresses
4. **Record demo** with live transactions
5. **Win hackathon** with production-ready dApp!

**Your SecureFlow will be running on real Monad testnet infrastructure!** 🎯
