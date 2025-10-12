// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

contract SecureFlow is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 365 days;
    uint256 public constant DISPUTE_PERIOD = 7 days;
    uint256 public constant EMERGENCY_REFUND_DELAY = 30 days;
    uint256 public constant MAX_PLATFORM_FEE_BP = 1000;

    address public monadToken;
    uint256 public platformFeeBP;
    address public feeCollector;

    enum EscrowStatus { Pending, InProgress, Released, Refunded, Disputed, Expired }
    enum MilestoneStatus { NotStarted, Submitted, Approved, Disputed, Resolved }
    struct Milestone {
        string description;
        uint256 amount;
        MilestoneStatus status;
        uint256 submittedAt;
        uint256 approvedAt;
        uint256 disputedAt;
        address disputedBy;
        string disputeReason;
    }

    struct EscrowData {
        address depositor;
        address beneficiary;
        address arbiter;
        address token;
        uint256 totalAmount;
        uint256 paidAmount;
        uint256 platformFee;
        uint256 deadline;
        EscrowStatus status;
        bool workStarted;
        uint256 createdAt;
        uint256 milestoneCount;
    }

    uint256 public nextEscrowId;
    mapping(uint256 => EscrowData) public escrows;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(address => uint256[]) public userEscrows;
    mapping(address => bool) public authorizedArbiters;
    mapping(address => bool) public whitelistedTokens;
    mapping(address => uint256) public escrowedAmount;
    mapping(address => uint256) public totalFeesByToken;
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed depositor,
        address indexed beneficiary,
        address arbiter,
        uint256 totalAmount,
        uint256 platformFee,
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
        string description,
        uint256 submittedAt
    );
    event MilestoneApproved(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        address indexed depositor,
        uint256 amount,
        uint256 approvedAt
    );
    event MilestoneDisputed(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        address indexed depositor,
        string reason,
        uint256 disputedAt
    );
    event DisputeResolved(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        address indexed arbiter,
        uint256 beneficiaryAmount,
        uint256 refundAmount,
        uint256 resolvedAt
    );
    event FundsRefunded(
        uint256 indexed escrowId,
        address indexed depositor,
        uint256 amount
    );
    event EmergencyRefundExecuted(
        uint256 indexed escrowId,
        address indexed depositor,
        uint256 amount
    );
    event EscrowCompleted(uint256 indexed escrowId, address indexed beneficiary, uint256 totalPaid);
    event ArbiterAuthorized(address indexed arbiter);
    event ArbiterRevoked(address indexed arbiter);
    event TokenWhitelisted(address indexed token);
    event TokenBlacklisted(address indexed token);
    event PlatformFeeUpdated(uint256 newFeeBP);
    event FeeCollectorUpdated(address indexed newFeeCollector);
    event FeesWithdrawn(address indexed token, uint256 amount, address indexed recipient);
    event EmergencyWithdrawn(address indexed token, uint256 amount, address indexed to);
    event DeadlineExtended(uint256 indexed escrowId, uint256 newDeadline);
    modifier onlyEscrowParticipant(uint256 escrowId) {
        EscrowData storage e = escrows[escrowId];
        require(
            msg.sender == e.depositor || msg.sender == e.beneficiary || msg.sender == e.arbiter,
            "SecureFlow: Not authorized"
        );
        _;
    }

    modifier onlyDepositor(uint256 escrowId) {
        require(msg.sender == escrows[escrowId].depositor, "SecureFlow: Only depositor");
        _;
    }

    modifier onlyBeneficiary(uint256 escrowId) {
        require(msg.sender == escrows[escrowId].beneficiary, "SecureFlow: Only beneficiary");
        _;
    }

    modifier onlyArbiter(uint256 escrowId) {
        require(msg.sender == escrows[escrowId].arbiter, "SecureFlow: Only arbiter");
        _;
    }

    modifier validEscrow(uint256 escrowId) {
        require(escrowId < nextEscrowId && escrowId != 0, "SecureFlow: Escrow not found");
        _;
    }

    modifier onlyWhitelistedToken(address token) {
        require(whitelistedTokens[token], "SecureFlow: Token not whitelisted");
        _;
    }

    modifier onlyAuthorizedArbiter(address arbiter) {
        require(authorizedArbiters[arbiter], "SecureFlow: Arbiter not authorized");
        _;
    }

    constructor(address _monadToken, address _feeCollector, uint256 _platformFeeBP) {
        require(_feeCollector != address(0), "Invalid fee collector");
        require(_platformFeeBP <= MAX_PLATFORM_FEE_BP, "Fee too high");

        monadToken = _monadToken;
        feeCollector = _feeCollector;
        platformFeeBP = _platformFeeBP;
        nextEscrowId = 1;

        if (_monadToken != address(0) && !whitelistedTokens[_monadToken]) {
            whitelistedTokens[_monadToken] = true;
            emit TokenWhitelisted(_monadToken);
        }
    }
    function setPlatformFeeBP(uint256 _bp) external onlyOwner {
        require(_bp <= MAX_PLATFORM_FEE_BP, "SecureFlow: Fee too high");
        platformFeeBP = _bp;
        emit PlatformFeeUpdated(_bp);
    }

    function setFeeCollector(address _collector) external onlyOwner {
        require(_collector != address(0), "SecureFlow: Invalid collector");
        feeCollector = _collector;
        emit FeeCollectorUpdated(_collector);
    }

    function whitelistToken(address token) external onlyOwner {
        require(token != address(0), "SecureFlow: Invalid token");
        whitelistedTokens[token] = true;
        emit TokenWhitelisted(token);
    }

    function blacklistToken(address token) external onlyOwner {
        whitelistedTokens[token] = false;
        emit TokenBlacklisted(token);
    }

    function authorizeArbiter(address arbiter) external onlyOwner {
        require(arbiter != address(0), "SecureFlow: Invalid arbiter");
        authorizedArbiters[arbiter] = true;
        emit ArbiterAuthorized(arbiter);
    }

    function revokeArbiter(address arbiter) external onlyOwner {
        authorizedArbiters[arbiter] = false;
        emit ArbiterRevoked(arbiter);
    }

    function _calculateFee(uint256 amount) internal view returns (uint256) {
        if (platformFeeBP == 0) return 0;
        return (amount * platformFeeBP) / 10000;
    }
    function createEscrow(
        address beneficiary,
        address arbiter,
        uint256[] memory milestoneAmounts,
        string[] memory milestoneDescriptions,
        address token,
        uint256 duration
    ) external nonReentrant whenNotPaused onlyWhitelistedToken(token) onlyAuthorizedArbiter(arbiter) 
        returns (uint256) {
        require(token != address(0), "SecureFlow: Use createEscrowNative for native");
        return _createEscrowInternal(
            msg.sender,
            beneficiary,
            arbiter,
            milestoneAmounts,
            milestoneDescriptions,
            token,
            duration,
            false
        );
    }

    function createEscrowNative(
        address beneficiary,
        address arbiter,
        uint256[] memory milestoneAmounts,
        string[] memory milestoneDescriptions,
        uint256 duration
    ) external payable nonReentrant whenNotPaused onlyAuthorizedArbiter(arbiter) 
        returns (uint256) {
        address token = address(0);
        return _createEscrowInternal(
            msg.sender,
            beneficiary,
            arbiter,
            milestoneAmounts,
            milestoneDescriptions,
            token,
            duration,
            true
        );
    }

    function createEscrowWithPermit(
        address depositor,
        address beneficiary,
        address arbiter,
        uint256[] memory milestoneAmounts,
        string[] memory milestoneDescriptions,
        address token,
        uint256 duration,
        uint256 permitValue,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused onlyWhitelistedToken(token) returns (uint256) {
        require(token != address(0), "SecureFlow: Use createEscrowNative for native");
        require(authorizedArbiters[arbiter], "SecureFlow: Arbiter not authorized");
        
        // Calculate expected permit value
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; ++i) {
            totalAmount += milestoneAmounts[i];
        }
        uint256 expectedPermitValue = totalAmount + _calculateFee(totalAmount);
        require(permitValue >= expectedPermitValue, "SecureFlow: Permit value too low");
        
        IERC20Permit(token).permit(depositor, address(this), permitValue, permitDeadline, v, r, s);
        return _createEscrowInternal(
            depositor,
            beneficiary,
            arbiter,
            milestoneAmounts,
            milestoneDescriptions,
            token,
            duration,
            false
        );
    }

    function _createEscrowInternal(
        address depositor,
        address beneficiary,
        address arbiter,
        uint256[] memory milestoneAmounts,
        string[] memory milestoneDescriptions,
        address token,
        uint256 duration,
        bool isNative
    ) internal returns (uint256) {
        require(beneficiary != address(0), "SecureFlow: Invalid beneficiary");
        require(arbiter != address(0), "SecureFlow: Invalid arbiter");
        require(beneficiary != depositor, "SecureFlow: Cannot escrow to self");
        require(arbiter != depositor && arbiter != beneficiary, "SecureFlow: Invalid arbiter");
        require(duration >= MIN_DURATION && duration <= MAX_DURATION, "SecureFlow: Invalid duration");
        require(milestoneAmounts.length > 0, "SecureFlow: No milestones");
        require(milestoneAmounts.length == milestoneDescriptions.length, "SecureFlow: Mismatched arrays");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; ++i) {
            require(milestoneAmounts[i] > 0, "SecureFlow: Invalid milestone amount");
            totalAmount += milestoneAmounts[i];
        }

        uint256 platformFee = _calculateFee(totalAmount);
        uint256 totalWithFee = totalAmount + platformFee;

        if (isNative) {
            require(msg.value == totalWithFee, "SecureFlow: Incorrect native amount");
            escrowedAmount[address(0)] += totalAmount;
            totalFeesByToken[address(0)] += platformFee;
        } else {
            IERC20(token).safeTransferFrom(depositor, address(this), totalWithFee);
            escrowedAmount[token] += totalAmount;
            totalFeesByToken[token] += platformFee;
        }

        uint256 escrowId = nextEscrowId++;
        uint256 deadline = block.timestamp + duration;

        escrows[escrowId] = EscrowData({
            depositor: depositor,
            beneficiary: beneficiary,
            arbiter: arbiter,
            token: token,
            totalAmount: totalAmount,
            paidAmount: 0,
            platformFee: platformFee,
            deadline: deadline,
            status: EscrowStatus.Pending,
            workStarted: false,
            createdAt: block.timestamp,
            milestoneCount: milestoneAmounts.length
        });

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
        userEscrows[beneficiary].push(escrowId);

        emit EscrowCreated(escrowId, depositor, beneficiary, arbiter, totalAmount, platformFee, token, deadline);
        return escrowId;
    }


    function startWork(uint256 escrowId) external onlyBeneficiary(escrowId) validEscrow(escrowId) 
        nonReentrant whenNotPaused {
        EscrowData storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Pending, "SecureFlow: Invalid status");
        require(!e.workStarted, "SecureFlow: Work already started");

        e.workStarted = true;
        e.status = EscrowStatus.InProgress;

        emit WorkStarted(escrowId, msg.sender, block.timestamp);
    }

    function submitMilestone(
        uint256 escrowId,
        uint256 milestoneIndex,
        string memory description
    ) external onlyBeneficiary(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage e = escrows[escrowId];
        require(e.status == EscrowStatus.InProgress, "SecureFlow: Invalid status");
        require(milestoneIndex < e.milestoneCount, "SecureFlow: Invalid milestone");

        Milestone storage m = milestones[escrowId][milestoneIndex];
        require(m.status == MilestoneStatus.NotStarted, "SecureFlow: Already submitted or processed");

        m.status = MilestoneStatus.Submitted;
        m.submittedAt = block.timestamp;
        m.description = description;

        emit MilestoneSubmitted(escrowId, milestoneIndex, msg.sender, description, block.timestamp);
    }

    function approveMilestone(
        uint256 escrowId,
        uint256 milestoneIndex
    ) external onlyDepositor(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage e = escrows[escrowId];
        require(milestoneIndex < e.milestoneCount, "SecureFlow: Invalid milestone");

        Milestone storage m = milestones[escrowId][milestoneIndex];
        require(m.status == MilestoneStatus.Submitted, "SecureFlow: Not submitted");

        uint256 amount = m.amount;
        m.status = MilestoneStatus.Approved;
        m.approvedAt = block.timestamp;

        e.paidAmount += amount;

        if (e.token == address(0)) {
            escrowedAmount[address(0)] -= amount;
            (bool ok, ) = e.beneficiary.call{value: amount}("");
            require(ok, "SecureFlow: Native transfer failed");
        } else {
            escrowedAmount[e.token] -= amount;
            IERC20(e.token).safeTransfer(e.beneficiary, amount);
        }

        emit MilestoneApproved(escrowId, milestoneIndex, msg.sender, amount, block.timestamp);

        if (e.paidAmount == e.totalAmount) {
            e.status = EscrowStatus.Released;
            emit EscrowCompleted(escrowId, e.beneficiary, e.paidAmount);
        }
    }

    function disputeMilestone(
        uint256 escrowId,
        uint256 milestoneIndex,
        string memory reason
    ) external onlyDepositor(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage e = escrows[escrowId];
        require(milestoneIndex < e.milestoneCount, "SecureFlow: Invalid milestone");

        Milestone storage m = milestones[escrowId][milestoneIndex];
        require(m.status == MilestoneStatus.Submitted, "SecureFlow: Not submitted");
        require(block.timestamp <= m.submittedAt + DISPUTE_PERIOD, "SecureFlow: Dispute period expired");

        m.status = MilestoneStatus.Disputed;
        m.disputedAt = block.timestamp;
        m.disputedBy = msg.sender;
        m.disputeReason = reason;

        e.status = EscrowStatus.Disputed;

        emit MilestoneDisputed(escrowId, milestoneIndex, msg.sender, reason, block.timestamp);
    }

    function resolveDispute(
        uint256 escrowId,
        uint256 milestoneIndex,
        uint256 beneficiaryAmount
    ) external onlyArbiter(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Disputed, "SecureFlow: Not in dispute");

        Milestone storage m = milestones[escrowId][milestoneIndex];
        require(m.status == MilestoneStatus.Disputed, "SecureFlow: Not disputed");

        uint256 milestoneAmount = m.amount;
        require(beneficiaryAmount <= milestoneAmount, "SecureFlow: Invalid allocation");

        uint256 refundAmount = milestoneAmount - beneficiaryAmount;

        m.status = MilestoneStatus.Resolved;
        m.approvedAt = block.timestamp;

        if (beneficiaryAmount > 0) {
            e.paidAmount += beneficiaryAmount;
            if (e.token == address(0)) {
                escrowedAmount[address(0)] -= beneficiaryAmount;
                (bool ok, ) = e.beneficiary.call{value: beneficiaryAmount}("");
                require(ok, "SecureFlow: Native transfer failed");
            } else {
                escrowedAmount[e.token] -= beneficiaryAmount;
                IERC20(e.token).safeTransfer(e.beneficiary, beneficiaryAmount);
            }
        }

        if (refundAmount > 0) {
            if (e.token == address(0)) {
                escrowedAmount[address(0)] -= refundAmount;
                (bool ok2, ) = e.depositor.call{value: refundAmount}("");
                require(ok2, "SecureFlow: Native refund failed");
            } else {
                escrowedAmount[e.token] -= refundAmount;
                IERC20(e.token).safeTransfer(e.depositor, refundAmount);
            }
        }

        e.status = EscrowStatus.InProgress;

        emit DisputeResolved(escrowId, milestoneIndex, msg.sender, beneficiaryAmount, refundAmount, block.timestamp);

        if (e.paidAmount == e.totalAmount) {
            e.status = EscrowStatus.Released;
            emit EscrowCompleted(escrowId, e.beneficiary, e.paidAmount);
        }
    }

    function refundEscrow(uint256 escrowId) external onlyDepositor(escrowId) validEscrow(escrowId) 
        nonReentrant whenNotPaused {
        EscrowData storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Pending, "SecureFlow: Invalid status");
        require(!e.workStarted, "SecureFlow: Work started");
        require(block.timestamp < e.deadline, "SecureFlow: Deadline passed");

        uint256 refundAmount = e.totalAmount - e.paidAmount;
        require(refundAmount > 0, "SecureFlow: Nothing to refund");

        e.status = EscrowStatus.Refunded;

        if (e.token == address(0)) {
            escrowedAmount[address(0)] -= refundAmount;
            (bool ok, ) = e.depositor.call{value: refundAmount}("");
            require(ok, "SecureFlow: Native refund failed");
        } else {
            escrowedAmount[e.token] -= refundAmount;
            IERC20(e.token).safeTransfer(e.depositor, refundAmount);
        }

        emit FundsRefunded(escrowId, msg.sender, refundAmount);
    }

    function emergencyRefundAfterDeadline(uint256 escrowId) external onlyDepositor(escrowId) 
        validEscrow(escrowId) nonReentrant whenNotPaused {
        EscrowData storage e = escrows[escrowId];
        require(block.timestamp > e.deadline + EMERGENCY_REFUND_DELAY, "SecureFlow: Emergency period not reached");
        require(e.status != EscrowStatus.Released && e.status != EscrowStatus.Refunded, "SecureFlow: Cannot refund");

        uint256 refundAmount = e.totalAmount - e.paidAmount;
        require(refundAmount > 0, "SecureFlow: Nothing to refund");

        e.status = EscrowStatus.Expired;

        if (e.token == address(0)) {
            escrowedAmount[address(0)] -= refundAmount;
            (bool ok, ) = e.depositor.call{value: refundAmount}("");
            require(ok, "SecureFlow: Native refund failed");
        } else {
            escrowedAmount[e.token] -= refundAmount;
            IERC20(e.token).safeTransfer(e.depositor, refundAmount);
        }

        emit EmergencyRefundExecuted(escrowId, e.depositor, refundAmount);
    }

    function extendDeadline(
        uint256 escrowId,
        uint256 extraSeconds
    ) external onlyDepositor(escrowId) validEscrow(escrowId) nonReentrant whenNotPaused {
        require(extraSeconds > 0 && extraSeconds <= 30 days, "SecureFlow: Invalid extension");
        EscrowData storage e = escrows[escrowId];
        require(e.status == EscrowStatus.InProgress || e.status == EscrowStatus.Pending, "SecureFlow: Cannot extend");
        e.deadline += extraSeconds;
        emit DeadlineExtended(escrowId, e.deadline);
    }

    function withdrawFees(address token) external nonReentrant {
        require(msg.sender == feeCollector || msg.sender == owner(), "SecureFlow: Not authorized");
        uint256 amount = totalFeesByToken[token];
        require(amount > 0, "SecureFlow: No fees");

        totalFeesByToken[token] = 0;

        if (token == address(0)) {
            (bool ok, ) = feeCollector.call{value: amount}("");
            require(ok, "SecureFlow: Native fee transfer failed");
        } else {
            IERC20(token).safeTransfer(feeCollector, amount);
        }

        emit FeesWithdrawn(token, amount, feeCollector);
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "SecureFlow: Invalid amount");
        uint256 balance;
        if (token == address(0)) {
            balance = address(this).balance;
            uint256 reserved = escrowedAmount[address(0)] + totalFeesByToken[address(0)];
            require(balance > reserved, "SecureFlow: Nothing withdrawable");
            uint256 available = balance - reserved;
            require(amount <= available, "SecureFlow: Amount exceeds available native balance");
            (bool ok, ) = owner().call{value: amount}("");
            require(ok, "SecureFlow: Native withdraw failed");
        } else {
            balance = IERC20(token).balanceOf(address(this));
            uint256 reserved = escrowedAmount[token] + totalFeesByToken[token];
            require(balance >= reserved + amount, "SecureFlow: Insufficient non-escrow balance");
            IERC20(token).safeTransfer(owner(), amount);
        }
        emit EmergencyWithdrawn(token, amount, owner());
    }


    function getEscrowSummary(uint256 escrowId) external view validEscrow(escrowId) returns (
        address depositor,
        address beneficiary,
        EscrowStatus status,
        uint256 totalAmount,
        uint256 paidAmount,
        uint256 remaining,
        address token,
        uint256 deadline
    ) {
        EscrowData storage e = escrows[escrowId];
        depositor = e.depositor;
        beneficiary = e.beneficiary;
        status = e.status;
        totalAmount = e.totalAmount;
        paidAmount = e.paidAmount;
        remaining = e.totalAmount - e.paidAmount;
        token = e.token;
        deadline = e.deadline;
    }

    function getMilestones(uint256 escrowId) external view validEscrow(escrowId) returns (Milestone[] memory) {
        EscrowData storage e = escrows[escrowId];
        uint256 count = e.milestoneCount;
        Milestone[] memory list = new Milestone[](count);
        for (uint256 i = 0; i < count; ++i) {
            list[i] = milestones[escrowId][i];
        }
        return list;
    }

    function getUserEscrows(address user) external view returns (uint256[] memory) {
        return userEscrows[user];
    }

    function canDisputeMilestone(
        uint256 escrowId,
        uint256 milestoneIndex
    ) external view validEscrow(escrowId) returns (bool) {
        EscrowData storage e = escrows[escrowId];
        if (milestoneIndex >= e.milestoneCount) return false;
        
        Milestone storage m = milestones[escrowId][milestoneIndex];
        if (m.status != MilestoneStatus.Submitted) return false;
        
        return block.timestamp <= m.submittedAt + DISPUTE_PERIOD;
    }

    function getWithdrawableFees(address token) external view returns (uint256) {
        return totalFeesByToken[token];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {
        revert("SecureFlow: Do not send native directly");
    }

    fallback() external payable {
        revert("SecureFlow: Fallback not allowed");
    }
}