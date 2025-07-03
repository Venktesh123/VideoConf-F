import React from "react";
import {
  FaUserClock,
  FaTimes,
  FaCheck,
  FaUserMinus,
  FaCrown,
  FaUsers,
  FaExclamationTriangle,
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

  const hasWaitingParticipants = waitingParticipants.length > 0;

  return (
    <div
      className={`host-controls-container ${
        hasWaitingParticipants ? "urgent" : ""
      }`}
    >
      <div className="host-controls-header">
        <div className="host-controls-title">
          <FaCrown />
          <span>Host Controls</span>
          {hasWaitingParticipants && (
            <span className="urgent-badge">
              <FaExclamationTriangle />
              {waitingParticipants.length}
            </span>
          )}
        </div>
        <button className="host-controls-close-button" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <div className="host-controls-content">
        {/* Waiting Room Section - Prioritized */}
        <div
          className={`host-section ${
            hasWaitingParticipants ? "urgent-section" : ""
          }`}
        >
          <div className="section-header">
            <FaUserClock />
            <h3>Waiting for Approval ({waitingParticipants.length})</h3>
            {hasWaitingParticipants && (
              <div className="urgent-indicator">
                <FaExclamationTriangle />
              </div>
            )}
          </div>

          {waitingParticipants.length === 0 ? (
            <div className="no-waiting">
              <FaUserClock className="empty-icon" />
              <p>No participants waiting for approval</p>
              <small>New participants will appear here for your review</small>
            </div>
          ) : (
            <div className="waiting-list">
              {waitingParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="waiting-participant urgent"
                >
                  <div className="participant-info">
                    <div className="participant-name">
                      {participant.username}
                      <span className="new-badge">NEW</span>
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
            <FaUsers />
            <h3>Current Participants ({currentParticipants.length})</h3>
          </div>

          {currentParticipants.length === 0 ? (
            <div className="no-participants">
              <FaUsers className="empty-icon" />
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
                        title={
                          participant.audioEnabled
                            ? "Microphone on"
                            : "Microphone off"
                        }
                      >
                        🎤
                      </span>
                      <span
                        className={`status-indicator ${
                          participant.videoEnabled ? "enabled" : "disabled"
                        }`}
                        title={
                          participant.videoEnabled ? "Camera on" : "Camera off"
                        }
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
        <div className="host-section tips-section">
          <div className="host-tips">
            <h4>Host Tips</h4>
            <ul>
              <li>Review participant names before approving them</li>
              <li>You can remove disruptive participants anytime</li>
              <li>If you leave, host privileges transfer automatically</li>
              <li>Use chat to communicate with all participants</li>
              {hasWaitingParticipants && (
                <li className="urgent-tip">
                  <FaExclamationTriangle /> Participants are waiting for your
                  approval!
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostControls;
