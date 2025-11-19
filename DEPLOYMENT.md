# Base Mainnet Deployment Guide

## Prerequisites

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Set up Environment Variables**

   Create a `.env` file in the root directory with:

   ```env
   PRIVATE_KEY=your_private_key_here
   BASE_RPC_URL=https://mainnet.base.org
   BASESCAN_API_KEY=your_basescan_api_key_here
   ```

   **To get a BaseScan API key:**

   - Go to https://basescan.org/
   - Sign up/Login
   - Go to API-KEYs section
   - Create a new API key
   - Copy it to your `.env` file

## Deployment Steps

1. **Deploy to Base Mainnet**

   ```bash
   npx hardhat run scripts/deploy.js --network base
   ```

   This will:

   - Deploy MockERC20 token
   - Deploy SecureFlow contract with review system
   - Authorize arbiters
   - Whitelist the token
   - **Automatically verify both contracts on BaseScan**
   - Save deployment info to `deployed.json`

2. **Update Frontend Configuration**

   After deployment, update `frontend/lib/web3/config.ts`:

   ```typescript
   export const CONTRACTS = {
     SECUREFLOW_ESCROW: "NEW_CONTRACT_ADDRESS_FROM_deployed.json",
     MOCK_ERC20: "NEW_MOCK_ERC20_ADDRESS_FROM_deployed.json",
   };
   ```

3. **Verify Deployment**

   Check the contract on BaseScan:

   - Visit https://basescan.org/address/YOUR_CONTRACT_ADDRESS
   - You should see "Contract" tab with verified source code

## Important Notes

- ⚠️ **Mainnet Deployment**: This deploys to Base mainnet with real ETH costs
- 💰 **Gas Fees**: Ensure your wallet has enough ETH for deployment
- 🔒 **Security**: Never commit your `.env` file or private keys
- 📝 **Verification**: Contracts are automatically verified after deployment
- 🔄 **Migration**: Existing escrows on old contracts won't be accessible

## Troubleshooting

If verification fails:

1. Check your BaseScan API key is correct
2. Wait a few minutes and try manual verification:
   ```bash
   npx hardhat verify --network base CONTRACT_ADDRESS "constructor_arg1" "constructor_arg2" "constructor_arg3"
   ```
