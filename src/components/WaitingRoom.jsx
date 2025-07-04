import React, { useState, useEffect } from "react";
import {
  FaClock,
  FaTimes,
  FaVideo,
  FaMicrophone,
  FaWifi,
} from "react-icons/fa";
import "./WaitingRoom.css";

const WaitingRoom = ({ roomId, username, onLeave }) => {
  const [waitingTime, setWaitingTime] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("connected");

  useEffect(() => {
    // Update waiting time every second
    const timer = setInterval(() => {
      setWaitingTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatWaitingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}`;
    } else {
      return `${minutes} minute${
        minutes !== 1 ? "s" : ""
      } ${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}`;
    }
  };

  const checkMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      return { video: true, audio: true };
    } catch (error) {
      console.log("Media permission error:", error);
      return { video: false, audio: false };
    }
  };

  const [mediaStatus, setMediaStatus] = useState({
    video: false,
    audio: false,
  });

  useEffect(() => {
    checkMediaPermissions().then(setMediaStatus);
  }, []);

  return (
    <div className="waiting-room">
      <div className="waiting-room-container">
        <div className="waiting-room-header">
          <div className="header-content">
            <h1>
              <FaClock className="header-icon" />
              Waiting for Host Approval
            </h1>
            <div className="connection-indicator">
              <FaWifi className={`wifi-icon ${connectionStatus}`} />
              <span>Connected</span>
            </div>
          </div>
          <button
            className="leave-button"
            onClick={onLeave}
            title="Leave waiting room"
          >
            <FaTimes />
          </button>
        </div>

        <div className="waiting-room-content">
          <div className="waiting-info">
            <div className="user-avatar">
              {username.charAt(0).toUpperCase()}
            </div>
            <h2>Hello, {username}!</h2>
            <p className="room-info">
              You're requesting to join meeting: <strong>{roomId}</strong>
            </p>
            <p className="waiting-message">
              Please wait while the host reviews your request to join the
              meeting.
            </p>
          </div>

          <div className="waiting-animation">
            <div className="waiting-timer">
              <span className="timer-text">Waiting for</span>
              <span className="timer-value">
                {formatWaitingTime(waitingTime)}
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <span className="status-text">
              Your request has been sent to the host
            </span>
          </div>

          <div className="media-check">
            <h3>Media Device Status</h3>
            <div className="device-status">
              <div
                className={`device-item ${
                  mediaStatus.video ? "enabled" : "disabled"
                }`}
              >
                <FaVideo className="device-icon" />
                <span>Camera</span>
                <span className="status-badge">
                  {mediaStatus.video ? "Ready" : "Needs Permission"}
                </span>
              </div>
              <div
                className={`device-item ${
                  mediaStatus.audio ? "enabled" : "disabled"
                }`}
              >
                <FaMicrophone className="device-icon" />
                <span>Microphone</span>
                <span className="status-badge">
                  {mediaStatus.audio ? "Ready" : "Needs Permission"}
                </span>
              </div>
            </div>
            {(!mediaStatus.video || !mediaStatus.audio) && (
              <div className="permission-notice">
                <p>
                  Please allow camera and microphone access when prompted to
                  join the meeting.
                </p>
              </div>
            )}
          </div>

          <div className="waiting-tips">
            <h3>While you wait:</h3>
            <ul>
              <li>✅ Check your camera and microphone are working</li>
              <li>🌐 Ensure you have a stable internet connection</li>
              <li>📧 The host has been notified of your request</li>
              <li>⏱️ Most hosts respond within a few minutes</li>
              <li>🔒 Your privacy is protected until approved</li>
            </ul>
          </div>

          <div className="host-info">
            <div className="info-card">
              <h4>What happens next?</h4>
              <ol>
                <li>The host will see your join request</li>
                <li>They can approve or deny your access</li>
                <li>If approved, you'll join the meeting automatically</li>
                <li>If denied, you'll be notified and can try again</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="waiting-room-footer">
          <div className="footer-info">
            <p>
              Having trouble? Make sure you have a stable internet connection.
            </p>
          </div>
          <button className="cancel-button" onClick={onLeave}>
            <FaTimes />
            Cancel Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
