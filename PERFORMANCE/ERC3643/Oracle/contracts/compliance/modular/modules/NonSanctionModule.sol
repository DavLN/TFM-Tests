// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./AbstractModule.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
//import "../../../roles/AgentRoleUpgradeable.sol";

contract NonSanctionModule is AbstractModule, Ownable {
    using ECDSA for bytes32;

    address public trustedOracle;
    bool private _initialized = false;

    modifier onlyOracle() {
        require(msg.sender == trustedOracle, "Caller is not the trusted oracle");
        _;
    }

    mapping(bytes32 => bool) private isBlockedPair;

    event OracleCheck(address indexed from, address indexed to);

    function blockTransferPair(address from, address to) external onlyOracle {
        bytes32 key = keccak256(abi.encodePacked(from, to));
        isBlockedPair[key] = true;
    }

    function unblockTransferPair(address from, address to) external onlyOracle {
        bytes32 key = keccak256(abi.encodePacked(from, to));
        isBlockedPair[key] = false;
    }   

    function init(address _oracle) external onlyOwner {
        require(!_initialized, "Already initialized");
        require(_oracle != address(0), "Invalid oracle address");

        trustedOracle = _oracle;
        _initialized = true;
    }

    function initialized() external view returns (bool) {
        return _initialized;
    }

    function checkOracle(address from, address to) external {
        emit OracleCheck(from, to);
    }

    function moduleCheck(
        address from,
        address to,
        uint256,
        address
    ) external view override returns (bool) {
        // Minting exception and burning exception
        if (from == address(0) || to == address(0)) {
            return true;
        }

        bytes32 key = keccak256(abi.encodePacked(from, to));
        return !isBlockedPair[key];
    }

    function name() external pure returns (string memory) {
        return "NonSanctionModule";
    }

    function isPlugAndPlay() external pure returns (bool) {
        return true;
    }

    function canComplianceBind(address _compliance) external view returns (bool) {
        return true;
    }

    // Update state after successful transfers
    function moduleTransferAction(
    address _from,
    address _to,
    uint256 _amount
    ) external onlyComplianceCall override {
        // State change due to transfer is not needed here
        emit OracleCheck(_from, _to);
    }

    // Minting restrictions
    function moduleMintAction(address _to, uint256 _amount) external onlyComplianceCall override {
        // Add minting restrictions if needed
    }

    // Burning restrictions
    function moduleBurnAction(address _from, uint256 _amount) external onlyComplianceCall override {
        // Add burning restrictions if needed
    }
}
