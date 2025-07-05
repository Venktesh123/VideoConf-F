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

  // Enhanced network test function
  const testNetworkConnectivity = async () => {
    try {
      // First test basic internet connectivity
      await fetch("https://www.google.com/favicon.ico", {
        mode: "no-cors",
        cache: "no-cache",
        signal: AbortSignal.timeout(5000),
      });

      // Then test our API server
      const response = await fetch(`${API_URL}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("Network connectivity test failed:", error);

      if (error.name === "AbortError") {
        throw new Error(
          "Connection timeout. Please check your internet connection."
        );
      } else if (error.message.includes("CORS")) {
        throw new Error("Network configuration issue. Please try again.");
      } else if (error.message.includes("Failed to fetch")) {
        throw new Error(
          "Cannot connect to server. Please check your internet connection."
        );
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
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
      console.log("Testing network connectivity...");
      await testNetworkConnectivity();

      console.log("Creating new room...");

      // Configure axios with timeout and proper headers
      const axiosConfig = {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };

      const response = await axios.post(`${API_URL}/api/room`, {}, axiosConfig);
      const { roomId: newRoomId } = response.data;

      if (!newRoomId) {
        throw new Error("Server did not return a room ID");
      }

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

      let errorMessage = "Failed to create room. ";

      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        errorMessage +=
          "Connection timeout. Please check your internet connection and try again.";
      } else if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        if (status === 500) {
          errorMessage += "Server error. Please try again in a few moments.";
        } else if (status === 429) {
          errorMessage +=
            "Too many requests. Please wait a moment and try again.";
        } else {
          errorMessage += `Server error (${status}): ${
            error.response.data?.error || "Unknown error"
          }`;
        }
      } else if (error.request) {
        // Network error
        errorMessage +=
          "Cannot connect to server. Please check your internet connection.";
      } else {
        // Other error
        errorMessage += error.message;
      }

      setError(errorMessage);
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
      console.log("Testing network connectivity...");
      await testNetworkConnectivity();

      console.log("Checking if room exists...");

      // Configure axios with timeout and proper headers
      const axiosConfig = {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };

      // First check if room exists
      const roomCheckResponse = await axios.get(
        `${API_URL}/api/room/${roomId.trim().toUpperCase()}`,
        axiosConfig
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

      let errorMessage = "Failed to join room. ";

      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        errorMessage +=
          "Connection timeout. Please check your internet connection and try again.";
      } else if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          errorMessage +=
            "Room not found. Please check the Room ID and try again.";
        } else if (status === 500) {
          errorMessage += "Server error. Please try again in a few moments.";
        } else if (status === 429) {
          errorMessage +=
            "Too many requests. Please wait a moment and try again.";
        } else {
          errorMessage += `Server error (${status}): ${
            error.response.data?.error || "Unknown error"
          }`;
        }
      } else if (error.request) {
        errorMessage +=
          "Cannot connect to server. Please check your internet connection.";
      } else {
        errorMessage += error.message;
      }

      setError(errorMessage);
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

        {/* Network Status Indicator */}
        <div className="network-status">
          <p
            style={{
              color: "#888",
              fontSize: "12px",
              textAlign: "center",
              marginTop: "20px",
            }}
          >
            Server: {API_URL}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
