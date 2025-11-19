// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/ISecureFlow.sol";

/**
 * @title ReviewSystem
 * @dev Standalone contract for handling reviews, integrated with SecureFlow
 */
contract ReviewSystem is ReentrancyGuard {
    // ===== State =====
    address public immutable secureFlowAddress;
    ISecureFlow public immutable secureFlow;

    // ===== Structs =====
    struct Review {
        uint256 escrowId;
        address reviewer; // The client (depositor)
        address freelancer; // The freelancer being reviewed
        uint8 rating; // 1-5 stars
        string comment;
        uint256 timestamp;
        bool exists;
    }

    // ===== Storage =====
    mapping(address => Review[]) public freelancerReviews; // freelancer => reviews array
    mapping(uint256 => Review) public escrowReviews; // escrowId => review (one review per escrow)
    mapping(address => uint256) public reviewCount; // freelancer => total review count

    // ===== Events =====
    event ReviewSubmitted(
        uint256 indexed escrowId,
        address indexed reviewer,
        address indexed freelancer,
        uint8 rating,
        uint256 timestamp
    );

    // ===== Constructor =====
    constructor(address _secureFlowAddress) {
        require(_secureFlowAddress != address(0), "Invalid SecureFlow address");
        secureFlowAddress = _secureFlowAddress;
        secureFlow = ISecureFlow(_secureFlowAddress);
    }

    // ===== Functions =====
    /**
     * @dev Submit a review for a completed escrow
     * @param escrowId The ID of the completed escrow
     * @param rating Rating from 1-5
     * @param comment Review comment
     */
    function submitReview(
        uint256 escrowId,
        uint8 rating,
        string calldata comment
    ) external nonReentrant {
        // Get escrow data from SecureFlow contract
        (
            address depositor,
            address beneficiary,
            , // arbiters
            ISecureFlow.EscrowStatus status,
            , // totalAmount
            , // paidAmount
            , // remaining
            , // token
            , // deadline
            , // workStarted
            , // createdAt
            , // milestoneCount
            , // isOpenJob
            , // projectTitle
        ) = secureFlow.getEscrowSummary(escrowId);

        // Only depositor (client) can review
        require(msg.sender == depositor, "Only depositor can review");

        // Escrow must be completed (status = Released)
        require(status == ISecureFlow.EscrowStatus.Released, "Escrow not completed");

        // Rating must be between 1 and 5
        require(rating >= 1 && rating <= 5, "Invalid rating");

        // Check if review already exists for this escrow
        require(!escrowReviews[escrowId].exists, "Review already submitted");

        // Create review
        Review memory review = Review({
            escrowId: escrowId,
            reviewer: msg.sender,
            freelancer: beneficiary,
            rating: rating,
            comment: comment,
            timestamp: block.timestamp,
            exists: true
        });

        // Store review
        escrowReviews[escrowId] = review;
        freelancerReviews[beneficiary].push(review);
        reviewCount[beneficiary] += 1;

        emit ReviewSubmitted(escrowId, msg.sender, beneficiary, rating, block.timestamp);
    }

    /**
     * @dev Get all reviews for a freelancer
     * @param freelancer The freelancer address
     * @return Array of reviews
     */
    function getFreelancerReviews(address freelancer) external view returns (Review[] memory) {
        return freelancerReviews[freelancer];
    }

    /**
     * @dev Get review count for a freelancer
     * @param freelancer The freelancer address
     * @return Total number of reviews
     */
    function getReviewCount(address freelancer) external view returns (uint256) {
        return reviewCount[freelancer];
    }

    /**
     * @dev Get average rating for a freelancer
     * @param freelancer The freelancer address
     * @return Average rating (0 if no reviews)
     */
    function getAverageRating(address freelancer) external view returns (uint256) {
        uint256 count = reviewCount[freelancer];
        if (count == 0) return 0;

        uint256 totalRating = 0;
        for (uint256 i = 0; i < freelancerReviews[freelancer].length; i++) {
            totalRating += freelancerReviews[freelancer][i].rating;
        }

        return totalRating / count;
    }

    /**
     * @dev Check if a review exists for an escrow
     * @param escrowId The escrow ID
     * @return Whether a review exists
     */
    function hasReview(uint256 escrowId) external view returns (bool) {
        return escrowReviews[escrowId].exists;
    }

    /**
     * @dev Get review for a specific escrow
     * @param escrowId The escrow ID
     * @return The review struct
     */
    function getEscrowReview(uint256 escrowId) external view returns (Review memory) {
        return escrowReviews[escrowId];
    }
}

