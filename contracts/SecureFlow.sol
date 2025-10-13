// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./modules/EscrowCore.sol";
import "./modules/EscrowManagement.sol";
import "./modules/Marketplace.sol";
import "./modules/WorkLifecycle.sol";
import "./modules/AdminFunctions.sol";
import "./modules/RefundSystem.sol";
import "./modules/ViewFunctions.sol";

/**
 * @title SecureFlow - Modular Hybrid Escrow + Marketplace Platform
 * @dev This contract combines all functionality through inheritance
 * @notice Modular design for better maintainability and readability
 */
contract SecureFlow is 
    EscrowCore,
    EscrowManagement,
    Marketplace,
    WorkLifecycle,
    AdminFunctions,
    RefundSystem,
    ViewFunctions
{
    constructor(
        address _monadToken, 
        address _feeCollector, 
        uint256 _platformFeeBP
    ) EscrowCore(_monadToken, _feeCollector, _platformFeeBP) {
        // Constructor is handled by EscrowCore
    }
}
