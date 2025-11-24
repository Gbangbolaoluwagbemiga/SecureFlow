// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

/**
 * @title SecureFlowToken
 * @notice Official token for the SecureFlow platform
 * @dev ERC20 token with permit functionality
 */
contract SecureFlowToken is ERC20, ERC20Permit {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens with 18 decimals

    constructor(address initialOwner) 
        ERC20("SecureFlow", "STK") 
        ERC20Permit("SecureFlow") 
    {
        require(initialOwner != address(0), "Invalid owner address");
        _mint(initialOwner, TOTAL_SUPPLY);
    }
}

