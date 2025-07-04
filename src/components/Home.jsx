import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Home.css";

const API_URL = "https://conference-b.onrender.com";

const Home = () => {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const validateUsername = (name) => {
    if (!name || name.trim().length === 0) {
      return "Please enter your name";
    }
    if (name.trim().length < 2) {
      return "Name must be at least 2 characters";
    }
    if (name.trim().length > 30) {
      return "Name must be less than 30 characters";
    }
    if (!/^[a-zA-Z0-9\s]+$/.test(name.trim())) {
      return "Name can only contain letters, numbers, and spaces";
    }
    return null;
  };

  const validateRoomId = (id) => {
    if (!id || id.trim().length === 0) {
      return "Please enter a room ID";
    }
    if (id.trim().length < 6) {
      return "Room ID must be at least 6 characters";
    }
    return null;
  };

  const createRoom = async () => {
    setError("");

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    setIsCreating(true);
    try {
      console.log("Creating new room...");
      const response = await axios.post(`${API_URL}/api/room`);
      const { roomId: newRoomId } = response.data;

      console.log("Room created successfully:", newRoomId);

      // Navigate to the room with username
      navigate(`/room/${newRoomId}`, {
        state: {
          username: username.trim(),
          isHost: true,
        },
      });
    } catch (error) {
      console.error("Error creating room:", error);
      if (error.response) {
        setError(
          `Failed to create room: ${
            error.response.data.error || error.response.statusText
          }`
        );
      } else if (error.request) {
        setError(
          "Failed to create room: No response from server. Please check your internet connection."
        );
      } else {
        setError("Failed to create room: " + error.message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    setError("");

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    const roomIdError = validateRoomId(roomId);
    if (roomIdError) {
      setError(roomIdError);
      return;
    }

    setIsJoining(true);
    try {
      console.log("Checking if room exists...");

      // First check if room exists
      const roomCheckResponse = await axios.get(
        `${API_URL}/api/room/${roomId.trim().toUpperCase()}`
      );

      if (roomCheckResponse.data) {
        console.log("Room exists, joining...");

        // Navigate to the room with username
        navigate(`/room/${roomId.trim().toUpperCase()}`, {
          state: {
            username: username.trim(),
            isHost: false,
          },
        });
      }
    } catch (error) {
      console.error("Error joining room:", error);
      if (error.response && error.response.status === 404) {
        setError("Room not found. Please check the Room ID and try again.");
      } else if (error.response) {
        setError(
          `Failed to join room: ${
            error.response.data.error || error.response.statusText
          }`
        );
      } else if (error.request) {
        setError(
          "Failed to join room: No response from server. Please check your internet connection."
        );
      } else {
        setError("Failed to join room: " + error.message);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    if (error) setError(""); // Clear error when user starts typing
  };

  const handleRoomIdChange = (e) => {
    // Convert to uppercase and remove spaces
    const value = e.target.value.toUpperCase().replace(/\s/g, "");
    setRoomId(value);
    if (error) setError(""); // Clear error when user starts typing
  };

  const handleKeyPress = (e, action) => {
    if (e.key === "Enter") {
      if (action === "create") {
        createRoom();
      } else if (action === "join") {
        joinRoom();
      }
    }
  };

  return (
    <div className="home">
      <div className="home-container">
        <h1>🎥 Video Conference</h1>
        <p className="subtitle">Connect with anyone, anywhere</p>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="input-group">
          <label htmlFor="username">Your Name *</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={handleUsernameChange}
            onKeyPress={(e) => handleKeyPress(e, "create")}
            placeholder="Enter your full name"
            maxLength={30}
            disabled={isCreating || isJoining}
          />
          <small className="input-hint">
            This will be visible to other participants
          </small>
        </div>

        <div className="button-group">
          <button
            className="create-button"
            onClick={createRoom}
            disabled={isCreating || isJoining || !username.trim()}
            onKeyPress={(e) => handleKeyPress(e, "create")}
          >
            {isCreating ? (
              <>
                <span className="spinner"></span>
                Creating...
              </>
            ) : (
              <>
                <span className="button-icon">🎬</span>
                Start New Meeting
              </>
            )}
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="join-section">
            <div className="input-group">
              <label htmlFor="roomId">Meeting ID</label>
              <input
                id="roomId"
                type="text"
                value={roomId}
                onChange={handleRoomIdChange}
                onKeyPress={(e) => handleKeyPress(e, "join")}
                placeholder="Enter Meeting ID (e.g., ABC12345)"
                maxLength={12}
                disabled={isCreating || isJoining}
                style={{ fontFamily: "monospace", fontSize: "16px" }}
              />
              <small className="input-hint">
                Get this ID from the meeting host
              </small>
            </div>

            <button
              className="join-button"
              onClick={joinRoom}
              disabled={
                isJoining || isCreating || !username.trim() || !roomId.trim()
              }
            >
              {isJoining ? (
                <>
                  <span className="spinner"></span>
                  Joining...
                </>
              ) : (
                <>
                  <span className="button-icon">🚪</span>
                  Join Meeting
                </>
              )}
            </button>
          </div>
        </div>

        <div className="features">
          <h3>Features</h3>
          <ul>
            <li>🎥 HD Video & Audio</li>
            <li>💬 Real-time Chat</li>
            <li>👑 Host Controls</li>
            <li>⏳ Waiting Room</li>
            <li>🔒 Secure Meetings</li>
          </ul>
        </div>

        <div className="instructions">
          <h3>How it works</h3>
          <div className="steps">
            <div className="step">
              <span className="step-number">1</span>
              <div>
                <strong>Host:</strong> Click "Start New Meeting" to create a
                room
              </div>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <div>
                <strong>Participants:</strong> Enter the Meeting ID to request
                access
              </div>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <div>
                <strong>Host:</strong> Approve participants from the waiting
                room
              </div>
            </div>
            <div className="step">
              <span className="step-number">4</span>
              <div>
                <strong>Everyone:</strong> Enjoy secure video conferencing!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
