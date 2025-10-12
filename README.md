# 🏆 SecureFlow - Hackathon Winner

<div align="center">

**Milestone-Based Escrow Platform with MetaMask Smart Accounts Delegation**

[![Solidity](https://img.shields.io/badge/Solidity-0.8.19-blue.svg)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.17.0-yellow.svg)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-4.9.0-green.svg)](https://openzeppelin.com/)
[![License](https://img.shields.io/badge/License-MIT-red.svg)](LICENSE)

</div>

## 🎯 Project Overview

SecureFlow is a decentralized escrow platform that enables secure, milestone-based transactions between buyers and sellers using MetaMask Smart Accounts delegation.

## 🚀 Key Features

- ✅ **Milestone-based payments** - Perfect for freelancers and contractors
- ✅ **Dispute resolution** - Professional arbitration system
- ✅ **MetaMask Smart Accounts** - Delegation for automated actions
- ✅ **Envio integration** - Real-time indexing and analytics
- ✅ **Security first** - Production-ready smart contracts

## 🏗 Architecture

```
NextJS Frontend
    ↓ (queries)
Envio Indexer API
    ↓ (indexes)
Monad Testnet ← SecureFlow Smart Contract
```

## 📊 Smart Contract Features

### Core Functions:

- `createEscrow()` - Create milestone-based escrow
- `startWork()` - Beneficiary starts work (prevents refunds)
- `submitMilestone()` - Submit milestone for review
- `approveMilestone()` - Approve and release payment
- `disputeMilestone()` - Raise dispute for quality issues
- `resolveDispute()` - Arbiter resolves disputes
- `refundEscrow()` - Refund before work starts

### Security Features:

- ✅ **ReentrancyGuard** - Prevents reentrancy attacks
- ✅ **SafeMath** - Prevents integer overflow
- ✅ **Pausable** - Emergency stop functionality
- ✅ **Access Control** - Role-based permissions
- ✅ **Input Validation** - All parameters checked

## 🛠 Development Setup

### Prerequisites:

- Node.js v18+
- npm or yarn
- Hardhat
- MetaMask

### Installation:

```bash
npm install
```

### Compile:

```bash
npm run compile
```

### Format Code:

```bash
npm run format
```

### Deploy to Monad Testnet:

```bash
npm run deploy
```

## 🎯 Hackathon Requirements

### ✅ MetaMask Smart Accounts Integration

- **Delegation support** - Agents can act on behalf
- **Permission management** - Granular access control
- **Automated actions** - Smart contract execution

### ✅ Envio Integration

- **Real-time indexing** - All events tracked
- **Fast queries** - Portfolio and transaction data
- **Analytics dashboard** - User insights

## 🚀 Quick Start

1. **Clone and install:**

   ```bash
   git clone <repo>
   cd secureflow
   npm install
   ```

2. **Compile contracts:**

   ```bash
   npm run compile
   ```

3. **Deploy to Monad:**

   ```bash
   npm run deploy
   ```

4. **Start frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 📝 License

MIT License - see LICENSE file for details

## 👨‍💻 Author

**Oluwagbemiga** 🏆
