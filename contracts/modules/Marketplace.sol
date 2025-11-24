// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EscrowCore.sol";
import "../Errors.sol";

abstract contract Marketplace is EscrowCore {
    // ===== Marketplace functions =====
    function applyToJob(
        uint256 escrowId, 
        string calldata coverLetter, 
        uint256 proposedTimeline
    ) 
        external 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        if (!e.isOpenJob) revert NotOpenJob();
        if (e.status != EscrowStatus.Pending) revert JobClosed();
        if (hasApplied[escrowId][msg.sender]) revert AlreadyApplied();
        if (escrowApplications[escrowId].length >= MAX_APPLICATIONS) revert TooManyApplications();
        if (msg.sender == e.depositor) revert CannotApplyToOwnJob();
        if (bytes(coverLetter).length == 0) revert CoverLetterRequired();

        // Get freelancer rating - will be 0 if no ratings yet
        uint256 avgRating = 0;
        uint256 totalRatings = 0;
        // Note: RatingSystem will be available through inheritance in SecureFlow
        // For now, we'll set defaults and RatingSystem will handle the actual rating logic
        
        escrowApplications[escrowId].push(Application({
            freelancer: msg.sender,
            coverLetter: coverLetter,
            proposedTimeline: proposedTimeline,
            appliedAt: block.timestamp,
            exists: true,
            averageRating: avgRating,
            totalRatings: totalRatings
        }));
        hasApplied[escrowId][msg.sender] = true;
        emit ApplicationSubmitted(
            escrowId, 
            msg.sender, 
            coverLetter, 
            proposedTimeline
        );
    }

    function acceptFreelancer(
        uint256 escrowId, 
        address freelancer
    ) 
        external 
        onlyDepositor(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage e = escrows[escrowId];
        if (!e.isOpenJob) revert NotOpenJob();
        if (e.status != EscrowStatus.Pending) revert JobClosed();
        if (!hasApplied[escrowId][freelancer]) revert FreelancerNotApplied();

        e.beneficiary = freelancer;
        e.isOpenJob = false;
        userEscrows[freelancer].push(escrowId);
        emit FreelancerAccepted(escrowId, freelancer);
        emit EscrowUpdated(escrowId, e.status, block.timestamp);
    }

    // ===== View functions =====
    function getApplicationsPage(
        uint256 escrowId, 
        uint256 offset, 
        uint256 limit
    ) external view validEscrow(escrowId) returns (Application[] memory) {
        if (limit == 0 || limit > MAX_APPLICATIONS) revert InvalidLimit();
        Application[] storage apps = escrowApplications[escrowId];
        if (offset > apps.length) revert InvalidOffset();
        uint256 end = offset + limit > apps.length ? apps.length : offset + limit;
        uint256 len = end - offset;
        Application[] memory result = new Application[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = apps[offset + i];
        }
        return result;
    }

    function getApplicationCount(uint256 escrowId) external view validEscrow(escrowId) returns (uint256) {
        return escrowApplications[escrowId].length;
    }

    function hasUserApplied(uint256 escrowId, address user) external view validEscrow(escrowId) returns (bool) {
        return hasApplied[escrowId][user];
    }
}
