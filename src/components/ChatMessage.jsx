import React from "react";
import "./ChatMessage.css";

const ChatMessage = ({ message, isOwnMessage }) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatMessage = (text) => {
    // Convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(
      urlRegex,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  };

  return (
    <div
      className={`chat-message ${
        isOwnMessage ? "own-message" : "other-message"
      }`}
    >
      {!isOwnMessage && (
        <div className="message-avatar">
          {message.username.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="message-content">
        {!isOwnMessage && (
          <div className="message-sender">{message.username}</div>
        )}

        <div className="message-bubble">
          <div
            className="message-text"
            dangerouslySetInnerHTML={{
              __html: formatMessage(message.message),
            }}
          />
          <div className="message-time">{formatTime(message.timestamp)}</div>
        </div>
      </div>

      {isOwnMessage && (
        <div className="message-avatar own-avatar">
          {message.username.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
