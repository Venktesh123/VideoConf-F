import React from "react";
import { FaClock, FaTimes } from "react-icons/fa";
import "./WaitingRoom.css";

const WaitingRoom = ({ roomId, username, onLeave }) => {
  return (
    <div className="waiting-room">
      <div className="waiting-room-container">
        <div className="waiting-room-header">
          <h1>Waiting for Host Approval</h1>
          <button className="leave-button" onClick={onLeave}>
            <FaTimes />
          </button>
        </div>

        <div className="waiting-room-content">
          <div className="waiting-icon">
            <FaClock />
          </div>

          <div className="waiting-info">
            <h2>Hello, {username}!</h2>
            <p>
              You're trying to join meeting: <strong>{roomId}</strong>
            </p>
            <p>Please wait while the host reviews your request to join.</p>
          </div>

          <div className="waiting-animation">
            <div className="spinner"></div>
            <span>Waiting for approval...</span>
          </div>

          <div className="waiting-tips">
            <h3>While you wait:</h3>
            <ul>
              <li>Make sure your camera and microphone are working</li>
              <li>Check your internet connection</li>
              <li>The host will be notified of your request</li>
            </ul>
          </div>
        </div>

        <div className="waiting-room-footer">
          <button className="cancel-button" onClick={onLeave}>
            Cancel Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
