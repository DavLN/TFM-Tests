// SPDX-License-Identifier: Apache-2.0
/*
 * This code has not been reviewed.
 * Do not use or deploy this code before reviewing it personally first.
 */
pragma solidity ^0.8.0 ;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// ****************** Document Management *******************
import "./interface/IERC1643.sol";

/// @title IERC1400 Security Token Standard
/// @dev See https://github.com/SecurityTokenStandard/EIP-Spec

interface IERC1400 is IERC20 {

  // Document Management
  function getDocument(bytes32 _name) external view returns (string calldata, bytes32);
  function setDocument(bytes32 _name, string memory _uri, bytes32 _documentHash) external;

  // Token Information
  function balanceOfByPartition(bytes32 _partition, address _tokenHolder) external view returns (uint256);
  function partitionsOf(address _tokenHolder) external view returns (bytes32[] calldata);

  // Transfers
  function transferWithData(address _to, uint256 _value, bytes memory _data) external;
  function transferFromWithData(address _from, address _to, uint256 _value, bytes memory _data) external;

  // Partition Token Transfers
  function transferByPartition(bytes32 _partition, address _to, uint256 _value, bytes memory _data) external returns (bytes32);
  function operatorTransferByPartition(bytes32 _partition, address _from, address _to, uint256 _value, bytes memory _data, bytes memory _operatorData) external returns (bytes32);

  // Controller Operation
  function isControllable() external view returns (bool);
  function controllerTransfer(address _from, address _to, uint256 _value, bytes memory _data, bytes memory _operatorData) external;
  function controllerRedeem(address _tokenHolder, uint256 _value, bytes memory _data, bytes memory _operatorData) external;

  // Operator Management
  function authorizeOperator(address _operator) external;
  function revokeOperator(address _operator) external;
  function authorizeOperatorByPartition(bytes32 _partition, address _operator) external;
  function revokeOperatorByPartition(bytes32 _partition, address _operator) external;

  // Operator Information
  function isOperator(address _operator, address _tokenHolder) external view returns (bool);
  function isOperatorForPartition(bytes32 _partition, address _operator, address _tokenHolder) external view returns (bool);

  // Token Issuance
  function isIssuable() external view returns (bool);
  function issue(address _tokenHolder, uint256 _value, bytes memory _data) external;
  function issueByPartition(bytes32 _partition, address _tokenHolder, uint256 _value, bytes memory _data) external;

  // Token Redemption
  function redeem(uint256 _value, bytes memory _data) external;
  function redeemFrom(address _tokenHolder, uint256 _value, bytes memory _data) external;
  function redeemByPartition(bytes32 _partition, uint256 _value, bytes memory _data) external;
  function operatorRedeemByPartition(bytes32 _partition, address _tokenHolder, uint256 _value, bytes memory _operatorData) external;

  // Transfer Validity
  function canTransfer(address _to, uint256 _value, bytes memory _data) external view returns (bytes1, bytes32);
  function canTransferFrom(address _from, address _to, uint256 _value, bytes memory _data) external view returns (bytes1, bytes32);
  function canTransferByPartition(address _from, address _to, bytes32 _partition, uint256 _value, bytes memory _data) external view returns (bytes1, bytes32, bytes32);    

  // Controller Events
  event ControllerTransfer(
      address _controller,
      address indexed _from,
      address indexed _to,
      uint256 _value,
      bytes _data,
      bytes _operatorData
  );

  event ControllerRedemption(
      address _controller,
      address indexed _tokenHolder,
      uint256 _value,
      bytes _data,
      bytes _operatorData
  );

  // Document Events // Modified
  event DocumentUpdated(bytes32 indexed _name, string _uri, bytes32 _documentHash);
  event DocumentRemoved(bytes32 indexed _name, string _uri, bytes32 _documentHash);

  // Transfer Events
  event TransferByPartition(
      bytes32 indexed _fromPartition,
      address _operator,
      address indexed _from,
      address indexed _to,
      uint256 _value,
      bytes _data,
      bytes _operatorData
  );

  event ChangedPartition(
      bytes32 indexed _fromPartition,
      bytes32 indexed _toPartition,
      uint256 _value
  );

  // Operator Events
  event AuthorizedOperator(address indexed _operator, address indexed _tokenHolder);
  event RevokedOperator(address indexed _operator, address indexed _tokenHolder);
  event AuthorizedOperatorByPartition(bytes32 indexed _partition, address indexed _operator, address indexed _tokenHolder);
  event RevokedOperatorByPartition(bytes32 indexed _partition, address indexed _operator, address indexed _tokenHolder);

  // Issuance / Redemption Events
  event Issued(address indexed _operator, address indexed _to, uint256 _value, bytes _data);
  event Redeemed(address indexed _operator, address indexed _from, uint256 _value, bytes _data);
  event IssuedByPartition(bytes32 indexed _partition, address indexed _operator, address indexed _to, uint256 _value, bytes _data, bytes _operatorData);
  event RedeemedByPartition(bytes32 indexed _partition, address indexed _operator, address indexed _from, uint256 _value, bytes _operatorData);


}

/**
 * Reason codes - ERC-1066
 *
 * To improve the token holder experience, canTransfer MUST return a reason byte code
 * on success or failure based on the ERC-1066 application-specific status codes specified below.
 * An implementation can also return arbitrary data as a bytes32 to provide additional
 * information not captured by the reason code.
 * 
 * Code	Reason
 * 0x50	transfer failure
 * 0x51	transfer success
 * 0x52	insufficient balance
 * 0x53	insufficient allowance
 * 0x54	transfers halted (contract paused)
 * 0x55	funds locked (lockup period)
 * 0x56	invalid sender
 * 0x57	invalid receiver
 * 0x58	invalid operator (transfer agent)
 * 0x59	
 * 0x5a	
 * 0x5b	
 * 0x5a	
 * 0x5b	
 * 0x5c	
 * 0x5d	
 * 0x5e	
 * 0x5f	token meta or info
 *
 * These codes are being discussed at: https://ethereum-magicians.org/t/erc-1066-ethereum-status-codes-esc/283/24
 */