// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EscrowCore.sol";
import "../Errors.sol";

abstract contract WorkLifecycle is EscrowCore {
    // ===== Work lifecycle =====
    function startWork(uint256 escrowId) 
        external 
        onlyBeneficiary(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Pending) revert InvalidStatus();
        if (e.workStarted) revert WorkAlreadyStarted();

        e.workStarted = true;
        e.status = EscrowStatus.InProgress;

        if (e.platformFee > 0) {
            totalFeesByToken[e.token] += e.platformFee;
        }

        emit WorkStarted(escrowId, msg.sender, block.timestamp);
        emit EscrowUpdated(escrowId, EscrowStatus.InProgress, block.timestamp);
    }

    function submitMilestone(
        uint256 escrowId, 
        uint256 milestoneIndex, 
        string calldata description
    ) 
        external 
        onlyBeneficiary(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        if (e.status != EscrowStatus.InProgress) revert EscrowNotActive();
        if (milestoneIndex >= e.milestoneCount) revert InvalidMilestone();

        Milestone storage m = milestones[escrowId][milestoneIndex];
        require(
            m.status == MilestoneStatus.NotStarted, 
            "Already submitted/processed"
        );

        m.status = MilestoneStatus.Submitted;
        m.submittedAt = block.timestamp;
        if (bytes(description).length > 0) m.description = description;

        emit MilestoneSubmitted(
            escrowId, 
            milestoneIndex, 
            msg.sender, 
            m.description, 
            block.timestamp
        );
    }

    function approveMilestone(
        uint256 escrowId, 
        uint256 milestoneIndex
    ) 
        external 
        onlyDepositor(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        if (e.status != EscrowStatus.InProgress) revert EscrowNotActive();
        if (milestoneIndex >= e.milestoneCount) revert InvalidMilestone();

        Milestone storage m = milestones[escrowId][milestoneIndex];
        if (m.status != MilestoneStatus.Submitted) revert NotSubmitted();

        uint256 amount = m.amount;
        m.status = MilestoneStatus.Approved;
        m.approvedAt = block.timestamp;

        e.paidAmount += amount;
        escrowedAmount[e.token] -= amount;

        _transferOut(e.token, e.beneficiary, amount);

        emit MilestoneApproved(escrowId, milestoneIndex, msg.sender, amount, block.timestamp);

        if (e.totalAmount >= MIN_REP_ELIGIBLE_ESCROW_VALUE) {
            _updateReputation(e.beneficiary, REPUTATION_PER_MILESTONE, "Milestone approved");
        }

        if (e.paidAmount == e.totalAmount) {
            e.status = EscrowStatus.Released;
            bool eligible = e.totalAmount >= MIN_REP_ELIGIBLE_ESCROW_VALUE;
            if (eligible) {
                _updateReputation(e.beneficiary, REPUTATION_PER_ESCROW, "Escrow completed");
                _updateReputation(e.depositor, REPUTATION_PER_ESCROW, "Escrow completed");
            }
            completedEscrows[e.beneficiary] += 1;
            completedEscrows[e.depositor] += 1;
            emit EscrowCompleted(escrowId, e.beneficiary, e.paidAmount);
            emit EscrowUpdated(escrowId, EscrowStatus.Released, block.timestamp);
        }
    }

    function rejectMilestone(
        uint256 escrowId, 
        uint256 milestoneIndex, 
        string calldata reason
    ) 
        external 
        onlyDepositor(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        if (e.status != EscrowStatus.InProgress) revert EscrowNotActive();
        if (milestoneIndex >= e.milestoneCount) revert InvalidMilestone();

        Milestone storage m = milestones[escrowId][milestoneIndex];
        if (m.status != MilestoneStatus.Submitted) revert NotSubmitted();

        // Mark milestone as rejected
        m.status = MilestoneStatus.Rejected;
        m.disputedAt = block.timestamp; // Reuse disputedAt field for rejectedAt
        m.disputedBy = msg.sender; // Reuse disputedBy field for rejectedBy
        m.disputeReason = reason; // Reuse disputeReason field for rejectionReason

        emit MilestoneRejected(escrowId, milestoneIndex, msg.sender, reason, block.timestamp);
    }

    function resubmitMilestone(
        uint256 escrowId, 
        uint256 milestoneIndex, 
        string calldata description
    ) 
        external 
        onlyBeneficiary(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        if (e.status != EscrowStatus.InProgress) revert EscrowNotActive();
        if (milestoneIndex >= e.milestoneCount) revert InvalidMilestone();

        Milestone storage m = milestones[escrowId][milestoneIndex];
        if (m.status != MilestoneStatus.Rejected) revert NotRejected();

        // Reset milestone to submitted status
        m.status = MilestoneStatus.Submitted;
        m.submittedAt = block.timestamp;
        if (bytes(description).length > 0) m.description = description;

        emit MilestoneResubmitted(
            escrowId, 
            milestoneIndex, 
            msg.sender, 
            m.description, 
            block.timestamp
        );
    }

    function disputeMilestone(
        uint256 escrowId, 
        uint256 milestoneIndex, 
        string calldata reason
    ) 
        external 
        onlyDepositor(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        Milestone storage m = milestones[escrowId][milestoneIndex];
        if (m.status != MilestoneStatus.Submitted) revert NotSubmitted();
        if (block.timestamp > m.submittedAt + DISPUTE_PERIOD) revert DisputePeriodExpired();

        m.status = MilestoneStatus.Disputed;
        m.disputedAt = block.timestamp;
        m.disputedBy = msg.sender;
        m.disputeReason = reason;

        e.status = EscrowStatus.Disputed;

        emit MilestoneDisputed(escrowId, milestoneIndex, msg.sender, reason, block.timestamp);
        emit EscrowUpdated(escrowId, EscrowStatus.Disputed, block.timestamp);
    }

    function resolveDispute(
        uint256 escrowId,
        uint256 milestoneIndex,
        uint256 beneficiaryAmount,
        string calldata resolutionReason
    ) external onlyEscrowParticipant(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Disputed) revert NotInDispute();

        Milestone storage m = milestones[escrowId][milestoneIndex];
        if (m.status != MilestoneStatus.Disputed) revert NotInDispute();

        uint256 milestoneAmount = m.amount;
        if (beneficiaryAmount > milestoneAmount) revert InvalidAllocation();

        uint256 refundAmount = milestoneAmount - beneficiaryAmount;

        m.status = MilestoneStatus.Resolved;
        m.approvedAt = block.timestamp;
        
        m.disputeReason = resolutionReason;
        m.disputedBy = beneficiaryAmount > refundAmount ? e.beneficiary : e.depositor;

        if (beneficiaryAmount > 0) {
            e.paidAmount += beneficiaryAmount;
            escrowedAmount[e.token] -= beneficiaryAmount;
            _transferOut(e.token, e.beneficiary, beneficiaryAmount);
        }

        if (refundAmount > 0) {
            escrowedAmount[e.token] -= refundAmount;
            _transferOut(e.token, e.depositor, refundAmount);
        }

        e.status = EscrowStatus.InProgress;

        emit DisputeResolved(escrowId, milestoneIndex, msg.sender, beneficiaryAmount, refundAmount, block.timestamp);
        emit EscrowUpdated(escrowId, EscrowStatus.InProgress, block.timestamp);

        if (e.paidAmount == e.totalAmount) {
            e.status = EscrowStatus.Released;
            emit EscrowCompleted(escrowId, e.beneficiary, e.paidAmount);
            emit EscrowUpdated(escrowId, EscrowStatus.Released, block.timestamp);
        }
    }
}
