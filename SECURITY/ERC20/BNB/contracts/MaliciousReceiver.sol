// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.4.17;

import "./IERC20.sol";

contract MaliciousReceiver {
    IERC20 public token;
    bool private attacking;

    function MaliciousReceiver(address _token) public {
        token = IERC20(_token);
    }

    function attack(address to, uint256 amount) external {
        attacking = true;
        token.transfer(to, amount);
        attacking = false;
    }

    function() public payable {
        if (attacking) {
            token.transfer(msg.sender, 1); // Attempt reentrancy
        }
    }
}
