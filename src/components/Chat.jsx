import React, { useState, useRef, useEffect } from "react";
import { FaComments, FaTimes, FaPaperPlane, FaCrown } from "react-icons/fa";
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
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();

    const trimmedMessage = message.trim();
    if (trimmedMessage && trimmedMessage.length > 0 && onSendMessage) {
      onSendMessage(trimmedMessage);
      setMessage("");
      setIsTyping(false);

      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleInputChange = (e) => {
    const newMessage = e.target.value;

    // Prevent message from being too long
    if (newMessage.length > 500) {
      return;
    }

    setMessage(newMessage);

    // Handle typing indicators
    if (newMessage.trim().length > 0 && !isTyping) {
      setIsTyping(true);
      // Note: In a real implementation, you would emit typing-start event here
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    if (newMessage.trim().length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        // Note: In a real implementation, you would emit typing-stop event here
      }, 1000);
    } else {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return "";
      }
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.warn("Error formatting time:", error);
      return "";
    }
  };

  const isConsecutiveMessage = (currentMsg, prevMsg) => {
    if (!prevMsg || !currentMsg) return false;

    try {
      return (
        currentMsg.senderId === prevMsg.senderId &&
        currentMsg.username === prevMsg.username &&
        new Date(currentMsg.timestamp) - new Date(prevMsg.timestamp) < 60000 // 1 minute
      );
    } catch (error) {
      return false;
    }
  };

  const sanitizeMessage = (msg) => {
    if (!msg || typeof msg !== "string") return "";

    // Basic HTML sanitization
    return msg
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\n/g, "<br>"); // Allow line breaks
  };

  const isValidMessage = (msg) => {
    return (
      msg &&
      typeof msg === "object" &&
      msg.id &&
      msg.username &&
      msg.message &&
      msg.timestamp
    );
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
        <button
          className="chat-close-button"
          onClick={onClose}
          type="button"
          aria-label="Close chat"
        >
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
              if (!isValidMessage(msg)) {
                console.warn("Invalid message:", msg);
                return null;
              }

              const prevMsg = index > 0 ? messages[index - 1] : null;
              const isConsecutive = isConsecutiveMessage(msg, prevMsg);
              const isOwnMessage = msg.username === currentUsername;

              return (
                <div
                  key={`${msg.id}-${index}`} // More robust key
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
                  <div
                    className="message-content"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeMessage(msg.message),
                    }}
                  />
                </div>
              );
            })}

            {/* Typing indicators */}
            {typingUsers && typingUsers.length > 0 && (
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
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="chat-input"
            maxLength={500}
            disabled={!onSendMessage}
            autoComplete="off"
          />
          <button
            type="submit"
            className="send-button"
            disabled={!message.trim() || !onSendMessage}
            aria-label="Send message"
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
