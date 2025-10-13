# SecureFlow Frontend Integration Guide

## Overview

This guide explains how the SecureFlow frontend integrates with the hybrid smart contract that supports both direct assignment and marketplace features.

## Contract Features

### Security Features (From Audit)
✅ **Dispute timeline enforcement** - 7 days dispute period
✅ **Emergency refund delay** - 30 days grace period
✅ **Dispute evidence storage** - Reason stored on-chain
✅ **Checks-effects-interactions** - Proper ordering to prevent reentrancy
✅ **SafeERC20** - Safe token transfers
✅ **ReentrancyGuard** - Protection against reentrancy attacks
✅ **Pausable** - Emergency stop mechanism
✅ **Arbiter authorization** - Only authorized arbiters can resolve disputes
✅ **Token whitelisting** - Only approved tokens can be used

### Marketplace Features
✅ **Open jobs** - Create escrows without assigning freelancer (beneficiary = address(0))
✅ **Applications** - Freelancers can apply with cover letters
✅ **Freelancer acceptance** - Clients review and accept applications
✅ **Reputation system** - On-chain reputation with anti-gaming measures
✅ **Direct assignment** - Skip marketplace for known freelancers

## Key Differences from Previous Contract

### 1. Create Escrow Function Signature Changed

**Old:**
\`\`\`typescript
createEscrow(
  beneficiary: address,
  token: address,
  totalAmount: uint256,
  milestoneDescriptions: string[],
  milestoneAmounts: uint256[],
  duration: uint256
)
\`\`\`

**New:**
\`\`\`typescript
createEscrow(
  beneficiary: address,        // Can be address(0) for open jobs
  arbiter: address,            // NEW: Required arbiter for disputes
  milestoneAmounts: uint256[], // Order changed
  milestoneDescriptions: string[],
  token: address,
  duration: uint256,
  projectTitle: string,        // NEW: Job title
  projectDescription: string   // NEW: Job description
)
\`\`\`

### 2. Native Token Support

**New function for native MON:**
\`\`\`typescript
createEscrowNative(
  beneficiary: address,
  arbiter: address,
  milestoneAmounts: uint256[],
  milestoneDescriptions: string[],
  duration: uint256,
  projectTitle: string,
  projectDescription: string
) payable
\`\`\`

Use `address(0)` for token parameter and send value with transaction.

### 3. Milestone Functions Updated

**Submit Milestone:**
\`\`\`typescript
// Old: submitMilestone(escrowId, milestoneIndex)
// New: submitMilestone(escrowId, milestoneIndex, description)
\`\`\`

**Dispute Milestone:**
\`\`\`typescript
// Old: disputeMilestone(escrowId)
// New: disputeMilestone(escrowId, milestoneIndex, reason)
\`\`\`

### 4. New Marketplace Functions

\`\`\`typescript
// Apply to open job
applyToJob(escrowId, coverLetter, proposedTimeline)

// Accept freelancer application
acceptFreelancer(escrowId, freelancerAddress)

// Check if user applied
hasUserApplied(escrowId, userAddress) returns (bool)

// Get all applications
getApplications(escrowId) returns (Application[])
\`\`\`

### 5. Enhanced View Functions

\`\`\`typescript
// Get comprehensive escrow data
getEscrowSummary(escrowId) returns (
  depositor,
  beneficiary,
  status,
  totalAmount,
  paidAmount,
  remaining,
  token,
  deadline,
  isOpenJob,          // NEW
  projectTitle,       // NEW
  projectDescription  // NEW
)

// Get reputation
getReputation(userAddress) returns (uint256)

// Get completed escrows count
getCompletedEscrows(userAddress) returns (uint256)
\`\`\`

## Frontend Implementation

### 1. Creating Escrows

**Direct Assignment (Known Freelancer):**
\`\`\`typescript
const tx = await contract.createEscrow(
  freelancerAddress,  // Specific address
  arbiterAddress,     // Authorized arbiter
  milestoneAmounts,
  milestoneDescriptions,
  tokenAddress,
  duration,
  "Build Landing Page",
  "Need a modern landing page with React..."
)
\`\`\`

**Open Job (Marketplace):**
\`\`\`typescript
const tx = await contract.createEscrow(
  "0x0000000000000000000000000000000000000000", // address(0) for open job
  arbiterAddress,
  milestoneAmounts,
  milestoneDescriptions,
  tokenAddress,
  duration,
  "Build Landing Page",
  "Need a modern landing page with React..."
)
\`\`\`

**Native MON:**
\`\`\`typescript
const totalWithFee = calculateTotalWithFee(milestoneAmounts)
const tx = await contract.createEscrowNative(
  beneficiaryOrZero,
  arbiterAddress,
  milestoneAmounts,
  milestoneDescriptions,
  duration,
  projectTitle,
  projectDescription,
  { value: totalWithFee }
)
\`\`\`

### 2. Marketplace Workflow

**Browse Open Jobs:**
\`\`\`typescript
// Get all user escrows
const escrowIds = await contract.getUserEscrows(userAddress)

// Filter for open jobs
const openJobs = []
for (const id of escrowIds) {
  const summary = await contract.getEscrowSummary(id)
  if (summary.isOpenJob && summary.status === 0) { // Pending status
    openJobs.push({ id, ...summary })
  }
}
\`\`\`

**Apply to Job:**
\`\`\`typescript
const tx = await contract.applyToJob(
  escrowId,
  "I have 5 years of experience building React apps...",
  14 // 14 days proposed timeline
)
\`\`\`

**Review Applications (Client):**
\`\`\`typescript
const applications = await contract.getApplications(escrowId)

// Display applications to client
applications.forEach(app => {
  console.log(`Freelancer: ${app.freelancer}`)
  console.log(`Cover Letter: ${app.coverLetter}`)
  console.log(`Timeline: ${app.proposedTimeline} days`)
})
\`\`\`

**Accept Freelancer:**
\`\`\`typescript
const tx = await contract.acceptFreelancer(
  escrowId,
  selectedFreelancerAddress
)
\`\`\`

### 3. Milestone Workflow

**Start Work:**
\`\`\`typescript
const tx = await contract.startWork(escrowId)
\`\`\`

**Submit Milestone:**
\`\`\`typescript
const tx = await contract.submitMilestone(
  escrowId,
  milestoneIndex,
  "Completed the homepage design with all requested features"
)
\`\`\`

**Approve Milestone:**
\`\`\`typescript
const tx = await contract.approveMilestone(escrowId, milestoneIndex)
// Automatically updates reputation
\`\`\`

**Dispute Milestone:**
\`\`\`typescript
const tx = await contract.disputeMilestone(
  escrowId,
  milestoneIndex,
  "The design doesn't match the requirements discussed"
)
\`\`\`

### 4. Reputation Display

\`\`\`typescript
const reputation = await contract.getReputation(userAddress)
const completedCount = await contract.getCompletedEscrows(userAddress)

// Calculate trust level
const trustLevel = 
  reputation >= 100 ? "Expert" :
  reputation >= 50 ? "Trusted" :
  reputation >= 20 ? "Verified" :
  "New"
\`\`\`

## Required Environment Variables

\`\`\`env
# Contract Addresses (update after deployment)
NEXT_PUBLIC_SECUREFLOW_ADDRESS=0x...
NEXT_PUBLIC_ARBITER_ADDRESS=0x...  # Your authorized arbiter address

# Monad Testnet
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_MONAD_CHAIN_ID=10143

# Optional: Test Token
NEXT_PUBLIC_TEST_TOKEN_ADDRESS=0x...
\`\`\`

## Deployment Checklist

### Before Deployment

- [ ] Deploy SecureFlow contract to Monad Testnet
- [ ] Deploy test ERC20 token (optional)
- [ ] Authorize arbiter address
- [ ] Whitelist tokens (including address(0) for native)
- [ ] Set platform fee (e.g., 250 = 2.5%)
- [ ] Verify contract on Monad explorer

### After Deployment

- [ ] Update `NEXT_PUBLIC_SECUREFLOW_ADDRESS` in env
- [ ] Update `SECUREFLOW_ABI` in `lib/web3/abis.ts`
- [ ] Update arbiter address in create form
- [ ] Test direct assignment flow
- [ ] Test open job flow
- [ ] Test milestone completion
- [ ] Test dispute resolution
- [ ] Test reputation system

## Testing Workflow

### 1. Direct Assignment Test
1. Client creates escrow with specific freelancer address
2. Freelancer starts work
3. Freelancer submits milestone
4. Client approves milestone
5. Verify payment transferred
6. Verify reputation updated

### 2. Marketplace Test
1. Client creates open job (beneficiary = address(0))
2. Verify job appears in Browse Jobs
3. Freelancer applies with cover letter
4. Client reviews applications
5. Client accepts freelancer
6. Verify escrow assigned to freelancer
7. Complete milestone workflow

### 3. Dispute Test
1. Freelancer submits milestone
2. Client disputes with reason
3. Arbiter resolves dispute
4. Verify correct amounts distributed

### 4. Native Token Test
1. Create escrow with native MON
2. Complete milestone
3. Verify native transfer to freelancer

## Common Issues & Solutions

### Issue: "Arbiter not authorized"
**Solution:** Call `authorizeArbiter(address)` as contract owner

### Issue: "Token not whitelisted"
**Solution:** Call `whitelistToken(address)` as contract owner

### Issue: "Dispute period expired"
**Solution:** Disputes must be raised within 7 days of milestone submission

### Issue: "Emergency period not reached"
**Solution:** Emergency refund only available 30 days after deadline

### Issue: "Already applied"
**Solution:** Each address can only apply once per job

### Issue: "Too many applications"
**Solution:** Maximum 50 applications per job to prevent spam

## Gas Optimization Tips

1. **Batch milestone approvals** - Approve multiple milestones in sequence
2. **Use native MON** - Saves gas vs ERC20 transfers
3. **Limit milestone count** - More milestones = more gas
4. **Cache view calls** - Don't repeatedly call view functions

## Security Best Practices

1. **Always use authorized arbiters** - Don't use random addresses
2. **Whitelist tokens carefully** - Only use trusted ERC20 tokens
3. **Monitor platform fees** - Withdraw regularly to fee collector
4. **Pause in emergencies** - Use pause() if issues detected
5. **Verify all inputs** - Frontend should validate before sending transactions

## Support & Resources

- **Contract Source:** `contracts/SecureFlow.sol`
- **ABI:** `lib/web3/abis.ts`
- **Types:** `lib/web3/types.ts`
- **Web3 Context:** `contexts/web3-context.tsx`

For questions or issues, check the contract events and transaction logs on Monad explorer.
