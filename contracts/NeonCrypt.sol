// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title NeonCrypt - FHE-powered Encrypted Messaging
/// @author neon-crypt team
/// @notice A messaging contract that stores encrypted messages using FHEVM.
/// Each message is end-to-end encrypted and can only be decrypted by authorized users.
contract NeonCrypt is SepoliaConfig {
    /// @notice Structure to store message metadata
    struct Message {
        euint32 encryptedContent; // The encrypted message content
        uint256 timestamp;        // When the message was submitted
        address sender;           // Who sent the message
        bool isActive;            // Whether the message is active (not deleted)
    }

    /// @notice Total number of messages ever created
    uint256 private _totalMessages;

    /// @notice Mapping from message ID to message data
    mapping(uint256 => Message) private _messages;

    /// @notice Mapping from user address to their message IDs
    mapping(address => uint256[]) private _userMessages;

    /// @notice Event emitted when a new message is submitted
    /// @param sender The address that sent the message
    /// @param messageId The unique ID of the message
    /// @param timestamp When the message was created
    event MessageSubmitted(
        address indexed sender,
        uint256 indexed messageId,
        uint256 timestamp
    );

    /// @notice Event emitted when a message is deleted
    /// @param sender The address that deleted the message
    /// @param messageId The ID of the deleted message
    event MessageDeleted(
        address indexed sender,
        uint256 indexed messageId
    );

    /// @notice Submit a new encrypted message
    /// @param encryptedContent The encrypted message content (euint32)
    /// @param inputProof The proof for the encrypted input
    /// @dev The encrypted content is stored and access is granted to sender and contract
    function submitMessage(
        externalEuint32 encryptedContent,
        bytes calldata inputProof
    ) external {
        // Validate input proof is not empty
        require(inputProof.length > 0, "Input proof cannot be empty");

        // Convert external encrypted input to internal euint32
        euint32 content = FHE.fromExternal(encryptedContent, inputProof);

        // Increment total message count and get new message ID
        uint256 messageId = _totalMessages++;

        // Store the message
        _messages[messageId] = Message({
            encryptedContent: content,
            timestamp: block.timestamp,
            sender: msg.sender,
            isActive: true
        });

        // Add message ID to user's message list
        _userMessages[msg.sender].push(messageId);

        // Grant access to the encrypted content
        // Allow the contract to perform operations on this value
        FHE.allowThis(content);
        // Allow the sender to decrypt this value
        FHE.allow(content, msg.sender);

        emit MessageSubmitted(msg.sender, messageId, block.timestamp);
    }

    /// @notice Get message details by ID
    /// @param messageId The ID of the message to retrieve
    /// @return encryptedContent The encrypted content handle
    /// @return timestamp When the message was created
    /// @return sender Who sent the message
    /// @return isActive Whether the message is active
    function getMessage(uint256 messageId) 
        external 
        view 
        returns (
            euint32 encryptedContent,
            uint256 timestamp,
            address sender,
            bool isActive
        ) 
    {
        require(messageId < _totalMessages, "Message does not exist");
        Message storage msg_ = _messages[messageId];
        return (
            msg_.encryptedContent,
            msg_.timestamp,
            msg_.sender,
            msg_.isActive
        );
    }

    /// @notice Get all message IDs for a user
    /// @param user The address to query
    /// @return messageIds Array of message IDs owned by the user
    function getUserMessages(address user) 
        external 
        view 
        returns (uint256[] memory messageIds) 
    {
        return _userMessages[user];
    }

    /// @notice Get message count for a user
    /// @param user The address to query
    /// @return count The number of messages the user has
    function getMessageCount(address user) 
        external 
        view 
        returns (uint256 count) 
    {
        return _userMessages[user].length;
    }

    /// @notice Get metadata for all user messages
    /// @param user The address to query
    /// @return timestamps Array of timestamps
    /// @return messageIds Array of message IDs
    /// @return activeStatus Array of active status flags
    function getUserMessageMetadata(address user)
        external
        view
        returns (
            uint256[] memory timestamps,
            uint256[] memory messageIds,
            bool[] memory activeStatus
        )
    {
        uint256[] memory userMsgIds = _userMessages[user];
        uint256 length = userMsgIds.length;

        timestamps = new uint256[](length);
        messageIds = new uint256[](length);
        activeStatus = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 msgId = userMsgIds[i];
            Message storage msg_ = _messages[msgId];
            timestamps[i] = msg_.timestamp;
            messageIds[i] = msgId;
            activeStatus[i] = msg_.isActive;
        }

        return (timestamps, messageIds, activeStatus);
    }

    /// @notice Get total number of messages
    /// @return total The total message count
    function getTotalMessages() external view returns (uint256 total) {
        return _totalMessages;
    }

    /// @notice Get multiple messages by their IDs in a single call
    /// @param messageIds Array of message IDs to retrieve
    /// @return timestamps Array of timestamps for each message
    /// @return senders Array of sender addresses for each message
    /// @return activeStatuses Array of active status flags for each message
    function getMessagesBatch(uint256[] calldata messageIds)
        external
        view
        returns (
            uint256[] memory timestamps,
            address[] memory senders,
            bool[] memory activeStatuses
        )
    {
        uint256 length = messageIds.length;
        timestamps = new uint256[](length);
        senders = new address[](length);
        activeStatuses = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 msgId = messageIds[i];
            require(msgId < _totalMessages, "Message does not exist");
            Message storage msg_ = _messages[msgId];
            timestamps[i] = msg_.timestamp;
            senders[i] = msg_.sender;
            activeStatuses[i] = msg_.isActive;
        }

        return (timestamps, senders, activeStatuses);
    }

    /// @notice Delete a message (soft delete - marks as inactive)
    /// @param messageId The ID of the message to delete
    /// @dev Only the message sender can delete their own message
    function deleteMessage(uint256 messageId) external {
        require(messageId < _totalMessages, "Message does not exist");
        Message storage msg_ = _messages[messageId];
        require(msg_.sender == msg.sender, "Not message owner");
        require(msg_.isActive, "Message already deleted");

        msg_.isActive = false;

        emit MessageDeleted(msg.sender, messageId);
    }

    /// @notice Check if a message exists and is active
    /// @param messageId The ID of the message to check
    /// @return exists Whether the message exists
    /// @return active Whether the message is active
    function isMessageActive(uint256 messageId) external view returns (bool exists, bool active) {
        if (messageId >= _totalMessages) {
            return (false, false);
        }
        return (true, _messages[messageId].isActive);
    }
}

