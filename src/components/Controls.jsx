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
  console.log(
    "Controls rendered - isHost:",
    isHost,
    "waitingCount:",
    waitingCount
  );

  return (
    <div className="controls">
      <button
        className={`control-button ${
          !audioEnabled ? "control-button-off" : ""
        }`}
        onClick={toggleAudio}
        title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
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
        title={videoEnabled ? "Stop video" : "Start video"}
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

      <button
        className="control-button"
        onClick={toggleParticipants}
        title="Show participants list"
      >
        <FaUserFriends />
        <span>Participants ({participantsCount})</span>
      </button>

      <button
        className={`control-button ${showChat ? "control-button-active" : ""} ${
          hasUnreadMessages ? "has-notification" : ""
        }`}
        onClick={onToggleChat}
        title="Toggle chat"
      >
        <FaComments />
        <span>Chat</span>
        {hasUnreadMessages && <div className="notification-dot"></div>}
      </button>

      {/* FIXED: Only show host controls if user is actually a host */}
      {isHost && onToggleHostControls && (
        <button
          className={`control-button control-button-host ${
            showHostControls ? "control-button-active" : ""
          } ${waitingCount > 0 ? "has-notification" : ""}`}
          onClick={() => {
            console.log("Host controls button clicked");
            onToggleHostControls();
          }}
          title="Host controls and waiting room"
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
        title="Leave meeting"
      >
        <FaPhoneSlash />
        <span>Leave</span>
      </button>
    </div>
  );
};

export default Controls;
