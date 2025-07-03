import React from "react";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
  FaUserFriends,
  FaComments,
  FaCrown,
  FaExclamationCircle,
} from "react-icons/fa";
import "./Controls.css";

const Controls = ({
  audioEnabled,
  videoEnabled,
  toggleAudio,
  toggleVideo,
  leaveRoom,
  toggleParticipants,
  participantsCount,
  onToggleChat,
  onToggleHostControls,
  isHost,
  waitingCount = 0,
  showChat,
  showHostControls,
  hasUnreadMessages = false,
}) => {
  return (
    <div className="controls">
      <button
        className={`control-button ${
          !audioEnabled ? "control-button-off" : ""
        }`}
        onClick={toggleAudio}
      >
        {audioEnabled ? (
          <>
            <FaMicrophone />
            <span>Mute</span>
          </>
        ) : (
          <>
            <FaMicrophoneSlash />
            <span>Unmute</span>
          </>
        )}
      </button>

      <button
        className={`control-button ${
          !videoEnabled ? "control-button-off" : ""
        }`}
        onClick={toggleVideo}
      >
        {videoEnabled ? (
          <>
            <FaVideo />
            <span>Stop Video</span>
          </>
        ) : (
          <>
            <FaVideoSlash />
            <span>Start Video</span>
          </>
        )}
      </button>

      <button className="control-button" onClick={toggleParticipants}>
        <FaUserFriends />
        <span>Participants ({participantsCount})</span>
      </button>

      <button
        className={`control-button ${showChat ? "control-button-active" : ""} ${
          hasUnreadMessages ? "has-notification" : ""
        }`}
        onClick={onToggleChat}
      >
        <FaComments />
        <span>Chat</span>
        {hasUnreadMessages && <div className="notification-dot"></div>}
      </button>

      {isHost && (
        <button
          className={`control-button control-button-host ${
            showHostControls ? "control-button-active" : ""
          } ${waitingCount > 0 ? "has-notification" : ""}`}
          onClick={onToggleHostControls}
        >
          <FaCrown />
          <span>Host Controls</span>
          {waitingCount > 0 && (
            <div className="notification-badge">{waitingCount}</div>
          )}
        </button>
      )}

      <button
        className="control-button control-button-danger"
        onClick={leaveRoom}
      >
        <FaPhoneSlash />
        <span>Leave</span>
      </button>
    </div>
  );
};

export default Controls;
