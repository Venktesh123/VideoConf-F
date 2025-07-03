import React, { useState, useRef, useEffect } from "react";
import {
  FaComments,
  FaTimes,
  FaPaperPlane,
  FaCrown,
  FaEllipsisV,
} from "react-icons/fa";
import "./Chat.css";

const Chat = ({
  isOpen,
  onClose,
  messages = [],
  onSendMessage,
  currentUsername,
  isHost,
  typingUsers = [],
}) => {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
      setIsTyping(false);
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);

    // Handle typing indicators
    if (!isTyping) {
      setIsTyping(true);
      // Emit typing start event (would be handled by parent)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // Emit typing stop event (would be handled by parent)
    }, 1000);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isConsecutiveMessage = (currentMsg, prevMsg) => {
    if (!prevMsg) return false;
    return (
      currentMsg.senderId === prevMsg.senderId &&
      new Date(currentMsg.timestamp) - new Date(prevMsg.timestamp) < 60000
    ); // 1 minute
  };

  if (!isOpen) return null;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-title">
          <FaComments />
          <span>Meeting Chat</span>
          {messages.length > 0 && (
            <span className="message-count">({messages.length})</span>
          )}
        </div>
        <button className="chat-close-button" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">
            <FaComments className="no-messages-icon" />
            <p>No messages yet</p>
            <p>Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const isConsecutive = isConsecutiveMessage(msg, prevMsg);
              const isOwnMessage =
                msg.senderId === "self" || msg.username === currentUsername;

              return (
                <div
                  key={msg.id}
                  className={`message ${
                    isOwnMessage ? "own-message" : "other-message"
                  } ${isConsecutive ? "consecutive" : ""}`}
                >
                  {!isConsecutive && (
                    <div className="message-header">
                      <span className="message-username">
                        {msg.username}
                        {msg.isHost && <FaCrown className="host-icon" />}
                      </span>
                      <span className="message-time">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className="message-content">{msg.message}</div>
                </div>
              );
            })}

            {/* Typing indicators */}
            {typingUsers.length > 0 && (
              <div className="typing-indicators">
                <div className="typing-message">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="typing-text">
                    {typingUsers.length === 1
                      ? `${typingUsers[0]} is typing...`
                      : `${typingUsers.length} people are typing...`}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-container">
        <form onSubmit={handleSendMessage} className="chat-input-form">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="chat-input"
            maxLength={500}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!message.trim()}
          >
            <FaPaperPlane />
          </button>
        </form>

        {message.length > 450 && (
          <div className="character-count">
            {500 - message.length} characters remaining
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
