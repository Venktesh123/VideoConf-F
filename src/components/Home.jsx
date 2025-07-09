import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Home.css";

const API_URL = "https://confrencebackend.onrender.com";

const Home = () => {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [serverStatus, setServerStatus] = useState("checking");
  const navigate = useNavigate();

  // Check server status on component mount
  useEffect(() => {
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    try {
      setServerStatus("checking");
      const response = await axios.get(`${API_URL}/health`, {
        timeout: 10000, // 10 second timeout
      });
      setServerStatus("online");
    } catch (error) {
      console.error("Server status check failed:", error);
      setServerStatus("offline");
    }
  };

  const createRoom = async () => {
    if (!username.trim()) {
      alert("Please enter your name");
      return;
    }

    if (serverStatus === "offline") {
      alert("Server is currently offline. Please try again later.");
      return;
    }

    setIsCreating(true);
    try {
      console.log("Attempting to create room...");

      const response = await axios.post(
        `${API_URL}/api/room`,
        {}, // Empty body, or add any required data
        {
          timeout: 15000, // 15 second timeout
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Room creation response:", response.data);

      if (response.data && response.data.roomId) {
        const { roomId } = response.data;
        navigate(`/room/${roomId}`, { state: { username: username.trim() } });
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error creating room:", error);

      let errorMessage = "Failed to create room. ";

      if (error.code === "ECONNABORTED") {
        errorMessage +=
          "Request timed out. Please check your internet connection.";
      } else if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const data = error.response.data;

        if (status === 404) {
          errorMessage +=
            "API endpoint not found. Please check the server configuration.";
        } else if (status === 500) {
          errorMessage += "Server error. Please try again later.";
        } else if (status === 403) {
          errorMessage += "Access forbidden. Please check CORS configuration.";
        } else {
          errorMessage += `Server error (${status}): ${
            data?.message || "Unknown error"
          }`;
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage +=
          "No response from server. Please check if the server is running.";
      } else {
        // Something else happened
        errorMessage += error.message;
      }

      alert(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = () => {
    if (!username.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!roomId.trim()) {
      alert("Please enter a room ID");
      return;
    }

    navigate(`/room/${roomId.trim()}`, {
      state: { username: username.trim() },
    });
  };

  const generateRoomId = () => {
    // Generate a random room ID as fallback
    const randomId = Math.random().toString(36).substr(2, 9);
    setRoomId(randomId);
  };

  return (
    <div className="home">
      <div className="home-container">
        <h1>Video Conference App</h1>

        {/* Server Status Indicator */}
        <div className="server-status">
          <span className={`status-indicator ${serverStatus}`}>
            {serverStatus === "checking" && "Checking server..."}
            {serverStatus === "online" && "✓ Server Online"}
            {serverStatus === "offline" && "✗ Server Offline"}
          </span>
          {serverStatus === "offline" && (
            <button
              className="retry-button"
              onClick={checkServerStatus}
              disabled={serverStatus === "checking"}
            >
              Retry
            </button>
          )}
        </div>

        <div className="input-group">
          <label>Your Name</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            maxLength={50}
          />
        </div>

        <div className="button-group">
          <button
            className="create-button"
            onClick={createRoom}
            disabled={isCreating || !username.trim()}
          >
            {isCreating ? "Creating..." : "Create New Meeting"}
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="input-group">
            <label>Room ID</label>
            <div className="room-id-input-group">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID"
                maxLength={20}
              />
              <button
                className="generate-button"
                onClick={generateRoomId}
                type="button"
                title="Generate random room ID"
              >
                🎲
              </button>
            </div>
          </div>

          <button
            className="join-button"
            onClick={joinRoom}
            disabled={!username.trim() || !roomId.trim()}
          >
            Join Meeting
          </button>
        </div>

        {/* Debug Info */}
        <div className="debug-info">
          <details>
            <summary>Debug Information</summary>
            <div>
              <p>
                <strong>API URL:</strong> {API_URL}
              </p>
              <p>
                <strong>Server Status:</strong> {serverStatus}
              </p>
              <p>
                <strong>Browser:</strong> {navigator.userAgent}
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default Home;
