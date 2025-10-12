// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title SecureFlow
 * @dev Milestone-based escrow platform with MetaMask Smart Accounts delegation
 * @author Oluwagbemiga - Hackathon Winner
 */
contract SecureFlow is ReentrancyGuard, Ownable, Pausable {
    using SafeMath for uint256;

    // Constants
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 365 days;
    uint256 public constant DISPUTE_PERIOD = 7 days;
    uint256 public constant TTL_BUFFER = 30 days;

    // Enums
    enum EscrowStatus {
        Pending,
        InProgress,
        Released,
        Refunded,
        Disputed
    }

    enum MilestoneStatus {
        NotStarted,
        Submitted,
        Approved,
        Disputed
    }

    // Structs
    struct Milestone {
        string description;
        uint256 amount;
        MilestoneStatus status;
        uint256 submittedAt;
        uint256 approvedAt;
    }

    struct EscrowData {
        address depositor;
        address beneficiary;
        address arbiter;
        address token;
        uint256 totalAmount;
        uint256 paidAmount;
        uint256 deadline;
        EscrowStatus status;
        bool workStarted;
        uint256 createdAt;
        uint256 milestoneCount;
    }

    // State variables
    uint256 public nextEscrowId;
    mapping(uint256 => EscrowData) public escrows;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(address => uint256[]) public userEscrows;
    mapping(address => bool) public authorizedArbiters;

    // Events for Envio indexing
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed depositor,
        address indexed beneficiary,
        address arbiter,
        uint256 totalAmount,
        address token,
        uint256 deadline
    );

    event WorkStarted(
        uint256 indexed escrowId,
        address indexed beneficiary,
        uint256 startedAt
    );

    event MilestoneSubmitted(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        address indexed beneficiary,
        string description
    );

    event MilestoneApproved(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        address indexed depositor,
        uint256 amount
    );

    event MilestoneDisputed(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        address indexed depositor,
        string reason
    );

    event DisputeResolved(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        address indexed arbiter,
        uint256 beneficiaryAmount,
        uint256 refundAmount
    );

    event FundsRefunded(
        uint256 indexed escrowId,
        address indexed depositor,
        uint256 amount
    );

    event EscrowCompleted(
        uint256 indexed escrowId,
        address indexed beneficiary,
        uint256 totalPaid
    );

    // Modifiers
    modifier onlyEscrowParticipant(uint256 escrowId) {
        EscrowData storage escrow = escrows[escrowId];
        require(
            msg.sender == escrow.depositor || 
            msg.sender == escrow.beneficiary || 
            msg.sender == escrow.arbiter,
            "Not authorized"
        );
        _;
    }

    modifier onlyDepositor(uint256 escrowId) {
        require(msg.sender == escrows[escrowId].depositor, "Only depositor");
        _;
    }

    modifier onlyBeneficiary(uint256 escrowId) {
        require(msg.sender == escrows[escrowId].beneficiary, "Only beneficiary");
        _;
    }

    modifier onlyArbiter(uint256 escrowId) {
        require(msg.sender == escrows[escrowId].arbiter, "Only arbiter");
        _;
    }

    modifier validEscrow(uint256 escrowId) {
        require(escrowId < nextEscrowId, "Escrow not found");
        _;
    }

    constructor() {
        nextEscrowId = 1;
    }

    /**
     * @dev Create a new milestone-based escrow
     */
    function createEscrow(
        address beneficiary,
        address arbiter,
        uint256[] memory milestoneAmounts,
        string[] memory milestoneDescriptions,
        address token,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(arbiter != address(0), "Invalid arbiter");
        require(beneficiary != msg.sender, "Cannot escrow to self");
        require(arbiter != msg.sender && arbiter != beneficiary, "Invalid arbiter");
        require(duration >= MIN_DURATION && duration <= MAX_DURATION, "Invalid duration");
        require(milestoneAmounts.length > 0, "No milestones");
        require(milestoneAmounts.length == milestoneDescriptions.length, "Mismatched arrays");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            require(milestoneAmounts[i] > 0, "Invalid milestone amount");
            totalAmount = totalAmount.add(milestoneAmounts[i]);
        }

        uint256 escrowId = nextEscrowId++;
        uint256 deadline = block.timestamp.add(duration);

        // Create escrow
        escrows[escrowId] = EscrowData({
            depositor: msg.sender,
            beneficiary: beneficiary,
            arbiter: arbiter,
            token: token,
            totalAmount: totalAmount,
            paidAmount: 0,
            deadline: deadline,
            status: EscrowStatus.Pending,
            workStarted: false,
            createdAt: block.timestamp,
            milestoneCount: milestoneAmounts.length
        });

        // Create milestones
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            milestones[escrowId][i] = Milestone({
                description: milestoneDescriptions[i],
                amount: milestoneAmounts[i],
                status: MilestoneStatus.NotStarted,
                submittedAt: 0,
                approvedAt: 0
            });
        }

        // Add to user escrows
        userEscrows[msg.sender].push(escrowId);
        userEscrows[beneficiary].push(escrowId);

        // Transfer tokens to contract
        IERC20(token).transferFrom(msg.sender, address(this), totalAmount);

        emit EscrowCreated(
            escrowId,
            msg.sender,
            beneficiary,
            arbiter,
            totalAmount,
            token,
            deadline
        );

        return escrowId;
    }

    /**
     * @dev Beneficiary starts work (prevents refunds)
     */
    function startWork(uint256 escrowId) 
        external 
        onlyBeneficiary(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Pending, "Invalid status");
        require(!escrow.workStarted, "Work already started");

        escrow.workStarted = true;
        escrow.status = EscrowStatus.InProgress;

        emit WorkStarted(escrowId, msg.sender, block.timestamp);
    }

    /**
     * @dev Submit milestone for review
     */
    function submitMilestone(
        uint256 escrowId,
        uint256 milestoneIndex,
        string memory description
    ) external onlyBeneficiary(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.InProgress, "Invalid status");
        require(milestoneIndex < escrow.milestoneCount, "Invalid milestone");
        require(milestones[escrowId][milestoneIndex].status == MilestoneStatus.NotStarted, "Already submitted");

        milestones[escrowId][milestoneIndex].status = MilestoneStatus.Submitted;
        milestones[escrowId][milestoneIndex].submittedAt = block.timestamp;
        milestones[escrowId][milestoneIndex].description = description;

        emit MilestoneSubmitted(escrowId, milestoneIndex, msg.sender, description);
    }

    /**
     * @dev Approve milestone and release payment
     */
    function approveMilestone(
        uint256 escrowId,
        uint256 milestoneIndex
    ) external onlyDepositor(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage escrow = escrows[escrowId];
        require(milestoneIndex < escrow.milestoneCount, "Invalid milestone");
        require(milestones[escrowId][milestoneIndex].status == MilestoneStatus.Submitted, "Not submitted");

        uint256 amount = milestones[escrowId][milestoneIndex].amount;
        
        milestones[escrowId][milestoneIndex].status = MilestoneStatus.Approved;
        milestones[escrowId][milestoneIndex].approvedAt = block.timestamp;
        escrow.paidAmount = escrow.paidAmount.add(amount);

        // Transfer payment
        IERC20(escrow.token).transfer(escrow.beneficiary, amount);

        emit MilestoneApproved(escrowId, milestoneIndex, msg.sender, amount);

        // Check if all milestones completed
        if (escrow.paidAmount == escrow.totalAmount) {
            escrow.status = EscrowStatus.Released;
            emit EscrowCompleted(escrowId, escrow.beneficiary, escrow.paidAmount);
        }
    }

    /**
     * @dev Dispute milestone quality
     */
    function disputeMilestone(
        uint256 escrowId,
        uint256 milestoneIndex,
        string memory reason
    ) external onlyDepositor(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage escrow = escrows[escrowId];
        require(milestoneIndex < escrow.milestoneCount, "Invalid milestone");
        require(milestones[escrowId][milestoneIndex].status == MilestoneStatus.Submitted, "Not submitted");

        milestones[escrowId][milestoneIndex].status = MilestoneStatus.Disputed;
        escrow.status = EscrowStatus.Disputed;

        emit MilestoneDisputed(escrowId, milestoneIndex, msg.sender, reason);
    }

    /**
     * @dev Arbiter resolves dispute
     */
    function resolveDispute(
        uint256 escrowId,
        uint256 milestoneIndex,
        uint256 beneficiaryAmount
    ) external onlyArbiter(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage escrow = escrows[escrowId];
        require(milestoneIndex < escrow.milestoneCount, "Invalid milestone");
        require(milestones[escrowId][milestoneIndex].status == MilestoneStatus.Disputed, "Not disputed");

        uint256 milestoneAmount = milestones[escrowId][milestoneIndex].amount;
        require(beneficiaryAmount <= milestoneAmount, "Invalid amount");

        uint256 refundAmount = milestoneAmount.sub(beneficiaryAmount);

        // Pay beneficiary
        if (beneficiaryAmount > 0) {
            IERC20(escrow.token).transfer(escrow.beneficiary, beneficiaryAmount);
            escrow.paidAmount = escrow.paidAmount.add(beneficiaryAmount);
        }

        // Refund depositor
        if (refundAmount > 0) {
            IERC20(escrow.token).transfer(escrow.depositor, refundAmount);
        }

        milestones[escrowId][milestoneIndex].status = MilestoneStatus.Approved;
        escrow.status = EscrowStatus.InProgress;

        emit DisputeResolved(escrowId, milestoneIndex, msg.sender, beneficiaryAmount, refundAmount);
    }

    /**
     * @dev Refund escrow (only before work starts)
     */
    function refundEscrow(uint256 escrowId) 
        external 
        onlyDepositor(escrowId) 
        validEscrow(escrowId) 
        nonReentrant 
        whenNotPaused 
    {
        EscrowData storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Pending, "Invalid status");
        require(!escrow.workStarted, "Work started");
        require(block.timestamp < escrow.deadline, "Deadline passed");

        uint256 refundAmount = escrow.totalAmount.sub(escrow.paidAmount);
        escrow.status = EscrowStatus.Refunded;

        IERC20(escrow.token).transfer(escrow.depositor, refundAmount);

        emit FundsRefunded(escrowId, msg.sender, refundAmount);
    }

    /**
     * @dev Get escrow details
     */
    function getEscrow(uint256 escrowId) external view validEscrow(escrowId) returns (EscrowData memory) {
        return escrows[escrowId];
    }

    /**
     * @dev Get user's escrows
     */
    function getUserEscrows(address user) external view returns (uint256[] memory) {
        return userEscrows[user];
    }

    /**
     * @dev Get milestone details
     */
    function getMilestone(uint256 escrowId, uint256 milestoneIndex) 
        external 
        view 
        validEscrow(escrowId) 
        returns (Milestone memory) 
    {
        require(milestoneIndex < escrows[escrowId].milestoneCount, "Invalid milestone");
        return milestones[escrowId][milestoneIndex];
    }

    /**
     * @dev Get all milestones for an escrow
     */
    function getMilestones(uint256 escrowId) 
        external 
        view 
        validEscrow(escrowId) 
        returns (Milestone[] memory) 
    {
        uint256 count = escrows[escrowId].milestoneCount;
        Milestone[] memory result = new Milestone[](count);
        
        for (uint256 i = 0; i < count; i++) {
            result[i] = milestones[escrowId][i];
        }
        
        return result;
    }

    /**
     * @dev Emergency pause (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal (owner only)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}