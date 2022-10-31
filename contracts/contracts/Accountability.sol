// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./AccountabilityNFTs.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
    Lock up funds for a period of time.
    Users can only withdraw funds if they own an NFT from another smart contract.
 */
contract Accountability is ReentrancyGuard {
    // Store the NFT Collection smart contract in this variable.
    AccountabilityNFTs public accountabilityNFTs;

    constructor(AccountabilityNFTs _nftCollectionAddress) {
        accountabilityNFTs = _nftCollectionAddress;
    }

    struct LockedFunds {
        uint256 amount;   // The amount of funds locked up
        uint256 time;     // The amount of time the funds are locked up for
        uint256 lockedAt; // When the user locked the funds up.
    }

    // The wallet address is the key that maps to a LockedFunds struct
    mapping(address => LockedFunds) public lockedFunds;

    function lockFunds(uint256 _time) public payable nonReentrant {
        require(lockedFunds[msg.sender].amount == 0, "You have already locked up funds.");
        lockedFunds[msg.sender] = LockedFunds(msg.value, _time, block.timestamp);
    }

    function withdraw() public nonReentrant {
        require(lockedFunds[msg.sender].amount > 0, "You have no locked funds.");
        require(block.timestamp >= lockedFunds[msg.sender].lockedAt + lockedFunds[msg.sender].time, "You cannot withdraw yet.");
        require(accountabilityNFTs.balanceOf(msg.sender) > 0, "You do not own an NFT from the other smart contract.");
        
        payable(msg.sender).transfer(lockedFunds[msg.sender].amount);
        lockedFunds[msg.sender].amount = 0;
    }
}