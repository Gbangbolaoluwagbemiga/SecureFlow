// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./EscrowCore.sol";
import "../Errors.sol";

abstract contract EscrowManagement is EscrowCore {
    using SafeERC20 for IERC20;
    // ===== Escrow creation =====
    function createEscrow(
        address beneficiary,
        address[] calldata arbiters,
        uint8 requiredConfirmations,
        uint256[] calldata milestoneAmounts,
        string[] calldata milestoneDescriptions,
        address token,
        uint256 duration,
        string calldata projectTitle,
        string calldata projectDescription
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        whenJobCreationNotPaused 
        onlyWhitelistedToken(token) 
        returns (uint256) 
    {
        return _createEscrowInternal(
            msg.sender, 
            beneficiary, 
            arbiters, 
            requiredConfirmations, 
            milestoneAmounts, 
            milestoneDescriptions, 
            token, 
            duration, 
            projectTitle, 
            projectDescription, 
            false
        );
    }

    function createEscrowNative(
        address beneficiary,
        address[] calldata arbiters,
        uint8 requiredConfirmations,
        uint256[] calldata milestoneAmounts,
        string[] calldata milestoneDescriptions,
        uint256 duration,
        string calldata projectTitle,
        string calldata projectDescription
    ) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        whenJobCreationNotPaused 
        returns (uint256) 
    {
        return _createEscrowInternal(
            msg.sender, 
            beneficiary, 
            arbiters, 
            requiredConfirmations, 
            milestoneAmounts, 
            milestoneDescriptions, 
            address(0), 
            duration, 
            projectTitle, 
            projectDescription, 
            true
        );
    }

    function _createEscrowInternal(
        address depositor,
        address beneficiary,
        address[] calldata arbiters,
        uint8 requiredConfirmationsParam,
        uint256[] calldata milestoneAmounts,
        string[] calldata milestoneDescriptions,
        address token,
        uint256 duration,
        string calldata projectTitle,
        string calldata projectDescription,
        bool isNative
    ) internal returns (uint256) {
        if (arbiters.length == 0) revert NoArbiters();
        if (requiredConfirmationsParam < 1 || requiredConfirmationsParam > arbiters.length) revert InvalidQuorum();
        if (beneficiary == depositor) revert CannotEscrowToSelf();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDurationRange();
        if (milestoneAmounts.length == 0) revert NoMilestones();
        if (milestoneAmounts.length > MAX_MILESTONES) revert TooManyMilestones();
        if (milestoneAmounts.length != milestoneDescriptions.length) revert MismatchedArrays();
        if (bytes(projectTitle).length == 0) revert ProjectTitleRequired();

        bool isOpenJob = (beneficiary == address(0));
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; ++i) {
            if (milestoneAmounts[i] == 0) revert InvalidMilestoneAmount();
            totalAmount += milestoneAmounts[i];
        }

        uint256 platformFee = _calculateFee(totalAmount);
        uint256 totalWithFee = totalAmount + platformFee;

        if (isNative) {
            if (msg.value != totalWithFee) revert IncorrectNativeAmount();
            escrowedAmount[address(0)] += totalAmount;
        } else {
            IERC20(token).safeTransferFrom(
                depositor, 
                address(this), 
                totalWithFee
            );
            escrowedAmount[token] += totalAmount;
        }

        uint256 escrowId = nextEscrowId++;
        EscrowData storage e = escrows[escrowId];
        e.depositor = depositor;
        e.beneficiary = beneficiary;
        address[] memory arbArr = new address[](arbiters.length);
        for (uint256 i = 0; i < arbiters.length; ++i) {
            arbArr[i] = arbiters[i];
        }
        e.arbiters = arbArr;
        e.requiredConfirmations = requiredConfirmationsParam;
        e.token = token;
        e.totalAmount = totalAmount;
        e.platformFee = platformFee;
        e.deadline = block.timestamp + duration;
        e.status = EscrowStatus.Pending;
        e.createdAt = block.timestamp;
        e.milestoneCount = milestoneAmounts.length;
        e.isOpenJob = isOpenJob;
        e.projectTitle = projectTitle;
        e.projectDescription = projectDescription;

        for (uint256 i = 0; i < milestoneAmounts.length; ++i) {
            milestones[escrowId][i] = Milestone({
                description: milestoneDescriptions[i],
                amount: milestoneAmounts[i],
                status: MilestoneStatus.NotStarted,
                submittedAt: 0,
                approvedAt: 0,
                disputedAt: 0,
                disputedBy: address(0),
                disputeReason: ""
            });
        }

        userEscrows[depositor].push(escrowId);
        if (!isOpenJob) userEscrows[beneficiary].push(escrowId);

        emit EscrowCreated(
            escrowId,
            depositor, 
            beneficiary,
            arbArr, 
            totalAmount,
            platformFee, 
            token,
            e.deadline, 
            isOpenJob
        );
        emit EscrowUpdated(escrowId, EscrowStatus.Pending, block.timestamp);
        return escrowId;
    }
}
