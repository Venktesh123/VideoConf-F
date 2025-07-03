import React from "react";
import {
  FaUserClock,
  FaTimes,
  FaCheck,
  FaUserMinus,
  FaCrown,
  FaEye,
} from "react-icons/fa";
import "./HostControls.css";

const HostControls = ({
  isOpen,
  onClose,
  waitingParticipants = [],
  onApprove,
  onDeny,
  currentParticipants = [],
  onRemoveParticipant,
}) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getWaitingTime = (requestedAt) => {
    const now = new Date();
    const requested = new Date(requestedAt);
    const diffMinutes = Math.floor((now - requested) / 60000);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes === 1) return "1 minute ago";
    return `${diffMinutes} minutes ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="host-controls-container">
      <div className="host-controls-header">
        <div className="host-controls-title">
          <FaCrown />
          <span>Host Controls</span>
        </div>
        <button className="host-controls-close-button" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <div className="host-controls-content">
        {/* Waiting Room Section */}
        <div className="host-section">
          <div className="section-header">
            <FaUserClock />
            <h3>Waiting Room ({waitingParticipants.length})</h3>
          </div>

          {waitingParticipants.length === 0 ? (
            <div className="no-waiting">
              <p>No participants waiting for approval</p>
            </div>
          ) : (
            <div className="waiting-list">
              {waitingParticipants.map((participant) => (
                <div key={participant.id} className="waiting-participant">
                  <div className="participant-info">
                    <div className="participant-name">
                      {participant.username}
                    </div>
                    <div className="participant-details">
                      <span className="join-time">
                        Requested: {formatTime(participant.requestedAt)}
                      </span>
                      <span className="waiting-duration">
                        ({getWaitingTime(participant.requestedAt)})
                      </span>
                    </div>
                  </div>
                  <div className="participant-actions">
                    <button
                      className="approve-button"
                      onClick={() => onApprove(participant.id)}
                      title="Approve participant"
                    >
                      <FaCheck />
                    </button>
                    <button
                      className="deny-button"
                      onClick={() => onDeny(participant.id)}
                      title="Deny participant"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current Participants Section */}
        <div className="host-section">
          <div className="section-header">
            <FaEye />
            <h3>Current Participants ({currentParticipants.length})</h3>
          </div>

          {currentParticipants.length === 0 ? (
            <div className="no-participants">
              <p>Only you are in the meeting</p>
            </div>
          ) : (
            <div className="participants-list">
              {currentParticipants.map((participant) => (
                <div key={participant.id} className="current-participant">
                  <div className="participant-info">
                    <div className="participant-name">
                      {participant.username}
                      {participant.isHost && <FaCrown className="host-badge" />}
                    </div>
                    <div className="participant-status">
                      <span
                        className={`status-indicator ${
                          participant.audioEnabled ? "enabled" : "disabled"
                        }`}
                      >
                        🎤
                      </span>
                      <span
                        className={`status-indicator ${
                          participant.videoEnabled ? "enabled" : "disabled"
                        }`}
                      >
                        📹
                      </span>
                    </div>
                  </div>
                  {!participant.isHost && participant.id !== "self" && (
                    <div className="participant-actions">
                      <button
                        className="remove-button"
                        onClick={() => onRemoveParticipant(participant.id)}
                        title="Remove participant"
                      >
                        <FaUserMinus />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Host Tips */}
        <div className="host-section">
          <div className="host-tips">
            <h4>Host Tips:</h4>
            <ul>
              <li>Review participants before approving them</li>
              <li>You can remove disruptive participants anytime</li>
              <li>If you leave, another participant will become host</li>
              <li>Use the chat to communicate with everyone</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostControls;
