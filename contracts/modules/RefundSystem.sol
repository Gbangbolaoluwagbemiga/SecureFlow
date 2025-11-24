// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EscrowCore.sol";
import "../Errors.sol";

abstract contract RefundSystem is EscrowCore {
    function refundEscrow(uint256 escrowId) 
        external 
        onlyDepositor(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Pending) revert InvalidStatus();
        if (e.workStarted) revert WorkAlreadyStarted();
        if (block.timestamp >= e.deadline) revert DeadlineNotExpired();

        uint256 refundAmount = e.totalAmount - e.paidAmount;
        if (refundAmount == 0) revert InvalidAmount();

        e.status = EscrowStatus.Refunded;

        escrowedAmount[e.token] -= refundAmount;
        _transferOut(e.token, e.depositor, refundAmount);

        emit FundsRefunded(escrowId, msg.sender, refundAmount);
        emit EscrowUpdated(escrowId, EscrowStatus.Refunded, block.timestamp);
    }

    function emergencyRefundAfterDeadline(uint256 escrowId) 
        external 
        onlyDepositor(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        if (block.timestamp <= e.deadline + EMERGENCY_REFUND_DELAY) revert DeadlineNotExpired();
        if (e.status == EscrowStatus.Released || e.status == EscrowStatus.Refunded) revert InvalidStatus();

        uint256 refundAmount = e.totalAmount - e.paidAmount;
        if (refundAmount == 0) revert InvalidAmount();

        e.status = EscrowStatus.Expired;

        escrowedAmount[e.token] -= refundAmount;
        _transferOut(e.token, e.depositor, refundAmount);

        emit EmergencyRefundExecuted(escrowId, e.depositor, refundAmount);
        emit EscrowUpdated(escrowId, EscrowStatus.Expired, block.timestamp);
    }

    function extendDeadline(
        uint256 escrowId,
        uint256 extraSeconds
    ) external onlyDepositor(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        if (extraSeconds == 0 || extraSeconds > 30 days) revert InvalidDuration();
        EscrowData storage e = escrows[escrowId];
        if (e.status != EscrowStatus.InProgress && e.status != EscrowStatus.Pending) revert InvalidStatus();
        e.deadline += extraSeconds;
        emit DeadlineExtended(escrowId, e.deadline);
    }
}
