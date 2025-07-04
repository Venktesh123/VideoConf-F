import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Peer from "peerjs";
import Controls from "./Controls";
import Participant from "./Participant";
import ParticipantsList from "./ParticipantsList";
import WaitingRoom from "./WaitingRoom";
import Chat from "./Chat";
import HostControls from "./HostControls";
import "./Room.css";

const API_URL = "https://conference-b.onrender.com";

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { username } = location.state || {};

  // Debug states
  const [debugSteps, setDebugSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState("initializing");
  const [detailedStatus, setDetailedStatus] = useState("Starting...");

  const [participants, setParticipants] = useState({});
  const [stream, setStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHostControls, setShowHostControls] = useState(false);
  const [peerId, setPeerId] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  // Room state management
  const [roomState, setRoomState] = useState("connecting");
  const [isHost, setIsHost] = useState(false);
  const [waitingParticipants, setWaitingParticipants] = useState([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);

  const socketRef = useRef();
  const peerRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();
  const connectionEstablished = useRef(false);
  const initializationRef = useRef(false);

  // Debug helper function
  const addDebugStep = (step, status, details = "") => {
    const timestamp = new Date().toLocaleTimeString();
    const debugInfo = { step, status, details, timestamp };
    console.log(`🔍 DEBUG [${timestamp}]: ${step} - ${status}`, details);
    setDebugSteps((prev) => [...prev, debugInfo]);
    setCurrentStep(step);
    setDetailedStatus(`${step}: ${status}`);
  };

  // Test server connectivity first
  const testServerConnection = async () => {
    try {
      addDebugStep("server-test", "testing", "Checking server connectivity...");

      const response = await fetch(`${API_URL}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        addDebugStep(
          "server-test",
          "success",
          `Server is healthy: ${JSON.stringify(data)}`
        );
        return true;
      } else {
        addDebugStep(
          "server-test",
          "error",
          `Server returned ${response.status}: ${response.statusText}`
        );
        return false;
      }
    } catch (error) {
      addDebugStep(
        "server-test",
        "error",
        `Server connection failed: ${error.message}`
      );
      return false;
    }
  };

  // Test room existence
  const testRoomExists = async () => {
    try {
      addDebugStep(
        "room-test",
        "testing",
        `Checking if room ${roomId} exists...`
      );

      const response = await fetch(`${API_URL}/api/room/${roomId}`);

      if (response.ok) {
        const data = await response.json();
        addDebugStep(
          "room-test",
          "success",
          `Room exists: ${JSON.stringify(data)}`
        );
        return true;
      } else if (response.status === 404) {
        addDebugStep("room-test", "error", "Room not found");
        return false;
      } else {
        addDebugStep(
          "room-test",
          "error",
          `Room check failed: ${response.status}`
        );
        return false;
      }
    } catch (error) {
      addDebugStep("room-test", "error", `Room check error: ${error.message}`);
      return false;
    }
  };

  useEffect(() => {
    // Initial validation
    if (!username) {
      addDebugStep("validation", "error", "Username is missing");
      navigate("/");
      return;
    }

    if (!roomId) {
      addDebugStep("validation", "error", "Room ID is missing");
      navigate("/");
      return;
    }

    if (initializationRef.current) {
      addDebugStep(
        "validation",
        "warning",
        "Already initializing, skipping..."
      );
      return;
    }

    addDebugStep(
      "validation",
      "success",
      `Username: ${username}, Room: ${roomId}`
    );
    initializationRef.current = true;

    // Start the connection process
    startConnectionProcess();

    return () => {
      addDebugStep("cleanup", "info", "Cleaning up...");
      cleanup();
    };
  }, [username, roomId, navigate]);

  const startConnectionProcess = async () => {
    try {
      // Step 1: Test server connectivity
      const serverOk = await testServerConnection();
      if (!serverOk) {
        addNotification(
          "Cannot connect to server. Please check your internet connection.",
          "error"
        );
        setTimeout(() => navigate("/"), 5000);
        return;
      }

      // Step 2: Test room existence
      const roomExists = await testRoomExists();
      if (!roomExists) {
        addNotification(
          "Room does not exist. Please check the room ID.",
          "error"
        );
        setTimeout(() => navigate("/"), 3000);
        return;
      }

      // Step 3: Get media access
      await initializeMedia();

      // Step 4: Initialize connections
      await initializeConnections();
    } catch (error) {
      addDebugStep("connection-process", "error", error.message);
      addNotification(`Connection failed: ${error.message}`, "error");
    }
  };

  const initializeMedia = async () => {
    try {
      addDebugStep(
        "media",
        "requesting",
        "Requesting camera and microphone access..."
      );
      setConnectionStatus("Requesting camera and microphone...");

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      addDebugStep(
        "media",
        "success",
        `Got media stream with ${mediaStream.getTracks().length} tracks`
      );

      setStream(mediaStream);
      streamRef.current = mediaStream;

      if (userVideo.current) {
        userVideo.current.srcObject = mediaStream;
        userVideo.current.muted = true;
      }

      // Test if video is actually working
      const videoTracks = mediaStream.getVideoTracks();
      const audioTracks = mediaStream.getAudioTracks();

      addDebugStep(
        "media",
        "info",
        `Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`
      );

      if (videoTracks.length > 0) {
        addDebugStep(
          "media",
          "info",
          `Video track enabled: ${videoTracks[0].enabled}`
        );
      }

      if (audioTracks.length > 0) {
        addDebugStep(
          "media",
          "info",
          `Audio track enabled: ${audioTracks[0].enabled}`
        );
      }
    } catch (error) {
      addDebugStep("media", "error", error.message);

      let errorMessage = "Failed to access camera/microphone: ";
      if (error.name === "NotAllowedError") {
        errorMessage += "Permission denied. Please allow access and refresh.";
      } else if (error.name === "NotFoundError") {
        errorMessage += "No camera or microphone found.";
      } else {
        errorMessage += error.message;
      }

      throw new Error(errorMessage);
    }
  };

  const initializeConnections = async () => {
    return new Promise((resolve, reject) => {
      try {
        // Initialize Socket
        addDebugStep("socket", "connecting", "Connecting to server...");
        setConnectionStatus("Connecting to server...");

        socketRef.current = io(API_URL, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
        });

        // Socket event handlers
        socketRef.current.on("connect", () => {
          addDebugStep(
            "socket",
            "success",
            `Connected with ID: ${socketRef.current.id}`
          );
          setConnectionStatus("Connected to server");
        });

        socketRef.current.on("connect_error", (error) => {
          addDebugStep("socket", "error", `Connection error: ${error.message}`);
          reject(new Error(`Socket connection failed: ${error.message}`));
        });

        socketRef.current.on("disconnect", (reason) => {
          addDebugStep("socket", "warning", `Disconnected: ${reason}`);
        });

        // Initialize Peer
        addDebugStep("peer", "connecting", "Initializing peer connection...");

        peerRef.current = new Peer(undefined, {
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" },
            ],
          },
          debug: 1,
        });

        peerRef.current.on("open", (id) => {
          addDebugStep("peer", "success", `Peer connected with ID: ${id}`);
          setPeerId(id);
          setConnectionStatus("Joining room...");

          // Now join the room
          addDebugStep(
            "room-join",
            "attempting",
            "Sending join-room request..."
          );

          socketRef.current.emit("join-room", {
            roomId,
            username,
            peerId: id,
          });

          // Set a timeout for room joining
          setTimeout(() => {
            if (roomState === "connecting") {
              addDebugStep(
                "room-join",
                "timeout",
                "Room join timeout - no response from server"
              );
              reject(new Error("Room join timeout"));
            }
          }, 15000);
        });

        peerRef.current.on("error", (error) => {
          addDebugStep("peer", "error", `Peer error: ${error.message}`);
          reject(new Error(`Peer connection failed: ${error.message}`));
        });

        // Setup all socket events
        setupSocketEvents(resolve, reject);

        // Overall timeout
        setTimeout(() => {
          if (roomState === "connecting") {
            addDebugStep("timeout", "error", "Overall connection timeout");
            reject(new Error("Connection timeout"));
          }
        }, 30000);
      } catch (error) {
        addDebugStep("initialization", "error", error.message);
        reject(error);
      }
    });
  };

  const setupSocketEvents = (resolve, reject) => {
    // Handle admission status
    socketRef.current.on(
      "admission-status",
      ({ status, isHost: hostStatus, chatMessages: messages, message }) => {
        addDebugStep(
          "admission",
          "received",
          `Status: ${status}, Host: ${hostStatus}`
        );

        if (status === "approved") {
          addDebugStep(
            "admission",
            "success",
            "Access approved - joining meeting"
          );
          setRoomState("approved");
          setIsHost(hostStatus || false);
          setConnectionStatus("Connected");
          connectionEstablished.current = true;

          if (messages && Array.isArray(messages)) {
            setChatMessages(messages);
          }

          if (hostStatus) {
            addNotification("You are the host of this meeting", "success");
          } else {
            addNotification("Welcome to the meeting!", "success");
          }

          resolve();
        } else if (status === "waiting") {
          addDebugStep("admission", "waiting", "Waiting for host approval");
          setRoomState("waiting");
          setConnectionStatus("Waiting for host approval");
          resolve(); // This is also a successful state
        } else if (status === "denied") {
          addDebugStep("admission", "denied", message || "Access denied");
          setRoomState("denied");
          addNotification(message || "Access denied by host", "error");
          setTimeout(() => navigate("/"), 3000);
          resolve(); // Even denial is a resolved state
        }
      }
    );

    // Handle room errors
    socketRef.current.on("room-error", ({ message }) => {
      addDebugStep("room-error", "error", message);
      reject(new Error(`Room error: ${message}`));
    });

    // Handle other events
    socketRef.current.on(
      "waiting-room-update",
      ({ waitingParticipants: waiting }) => {
        addDebugStep(
          "waiting-room",
          "update",
          `${waiting?.length || 0} participants waiting`
        );
        setWaitingParticipants(waiting || []);
      }
    );

    socketRef.current.on(
      "user-joined",
      ({ participantId, username: newUsername, peerId: newPeerId }) => {
        addDebugStep(
          "user-joined",
          "info",
          `${newUsername} joined with peer ID ${newPeerId}`
        );
        addNotification(`${newUsername} joined the meeting`, "success");

        if (
          newPeerId &&
          newPeerId !== peerId &&
          peerRef.current &&
          connectionEstablished.current
        ) {
          setTimeout(() => makeCall(newPeerId, newUsername), 1000);
        }
      }
    );

    socketRef.current.on(
      "room-participants",
      ({ participants: existingParticipants }) => {
        addDebugStep(
          "existing-participants",
          "info",
          `Found ${
            Object.keys(existingParticipants || {}).length
          } existing participants`
        );

        if (existingParticipants && connectionEstablished.current) {
          Object.values(existingParticipants).forEach((participant) => {
            if (participant.peerId && participant.peerId !== peerId) {
              setTimeout(
                () => makeCall(participant.peerId, participant.username),
                2000
              );
            }
          });
        }
      }
    );

    // Additional socket events...
    socketRef.current.on(
      "user-left",
      ({ peerId: leftPeerId, username: leftUsername }) => {
        addDebugStep("user-left", "info", `${leftUsername} left`);
        addNotification(`${leftUsername} left the meeting`, "info");

        if (leftPeerId && peersRef.current[leftPeerId]) {
          peersRef.current[leftPeerId].close();
          delete peersRef.current[leftPeerId];
        }

        setParticipants((prev) => {
          const newParticipants = { ...prev };
          delete newParticipants[leftPeerId];
          return newParticipants;
        });
      }
    );

    // Audio/Video toggles
    socketRef.current.on(
      "user-toggle-audio",
      ({ peerId: remotePeerId, enabled }) => {
        setParticipants((prev) => ({
          ...prev,
          [remotePeerId]: { ...prev[remotePeerId], audioEnabled: enabled },
        }));
      }
    );

    socketRef.current.on(
      "user-toggle-video",
      ({ peerId: remotePeerId, enabled }) => {
        setParticipants((prev) => ({
          ...prev,
          [remotePeerId]: { ...prev[remotePeerId], videoEnabled: enabled },
        }));
      }
    );

    // Chat events
    socketRef.current.on("new-message", (message) => {
      setChatMessages((prev) => [...prev, message]);
      if (!showChat && message.username !== username) {
        setHasUnreadMessages(true);
        addNotification(
          `${message.username}: ${message.message.substring(0, 30)}`,
          "info"
        );
      }
    });

    // Host events
    socketRef.current.on(
      "host-transferred",
      ({ isHost: newHostStatus, message }) => {
        setIsHost(newHostStatus);
        addNotification(message, "success");
      }
    );
  };

  const makeCall = (remotePeerId, remoteUsername) => {
    addDebugStep(
      "call",
      "making",
      `Calling ${remoteUsername} (${remotePeerId})`
    );

    if (
      !peerRef.current ||
      !peerRef.current.open ||
      peersRef.current[remotePeerId]
    ) {
      addDebugStep("call", "skipped", "Peer not ready or already connected");
      return;
    }

    const call = peerRef.current.call(remotePeerId, streamRef.current);
    if (!call) {
      addDebugStep("call", "error", "Failed to create call");
      return;
    }

    call.on("stream", (remoteStream) => {
      addDebugStep(
        "call",
        "stream-received",
        `Got stream from ${remoteUsername}`
      );
      addParticipant(remotePeerId, remoteStream, call, remoteUsername);
    });

    call.on("close", () => {
      addDebugStep("call", "closed", `Call closed with ${remoteUsername}`);
      removeParticipant(remotePeerId);
    });

    call.on("error", (error) => {
      addDebugStep("call", "error", `Call error: ${error.message}`);
      removeParticipant(remotePeerId);
    });

    peersRef.current[remotePeerId] = call;
  };

  const addParticipant = (peerId, stream, call, username = "Unknown") => {
    setParticipants((prev) => ({
      ...prev,
      [peerId]: {
        id: peerId,
        peerId,
        username,
        stream,
        call,
        audioEnabled: true,
        videoEnabled: true,
      },
    }));
  };

  const removeParticipant = (peerId) => {
    if (peersRef.current[peerId]) {
      delete peersRef.current[peerId];
    }
    setParticipants((prev) => {
      const newParticipants = { ...prev };
      delete newParticipants[peerId];
      return newParticipants;
    });
  };

  const cleanup = () => {
    addDebugStep("cleanup", "starting", "Cleaning up connections...");
    connectionEstablished.current = false;
    initializationRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    Object.values(peersRef.current).forEach((call) => {
      if (call && call.close) call.close();
    });

    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  // Control functions
  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !audioEnabled;
      });
      setAudioEnabled(!audioEnabled);
      if (socketRef.current) {
        socketRef.current.emit("toggle-audio", {
          roomId,
          peerId,
          enabled: !audioEnabled,
        });
      }
    }
  };

  const toggleVideo = async () => {
    // Similar implementation as before but with debug logging
    if (!videoEnabled) {
      try {
        addDebugStep("video", "enabling", "Starting video...");
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        streamRef.current = newStream;
        setStream(newStream);
        if (userVideo.current) {
          userVideo.current.srcObject = newStream;
        }

        // Update peer connections
        Object.values(peersRef.current).forEach((call) => {
          if (call && call.peerConnection) {
            const videoTrack = newStream.getVideoTracks()[0];
            const audioTrack = newStream.getAudioTracks()[0];
            const senders = call.peerConnection.getSenders();
            senders.forEach((sender) => {
              if (sender.track) {
                if (sender.track.kind === "video" && videoTrack) {
                  sender.replaceTrack(videoTrack).catch(console.error);
                } else if (sender.track.kind === "audio" && audioTrack) {
                  sender.replaceTrack(audioTrack).catch(console.error);
                }
              }
            });
          }
        });

        setVideoEnabled(true);
        addDebugStep("video", "enabled", "Video started successfully");
      } catch (error) {
        addDebugStep(
          "video",
          "error",
          `Failed to enable video: ${error.message}`
        );
        addNotification("Failed to access camera", "error");
      }
    } else {
      addDebugStep("video", "disabling", "Stopping video...");
      if (streamRef.current) {
        const videoTracks = streamRef.current.getVideoTracks();
        videoTracks.forEach((track) => track.stop());

        const audioTracks = streamRef.current.getAudioTracks();
        const audioOnlyStream = new MediaStream(audioTracks);

        streamRef.current = audioOnlyStream;
        setStream(audioOnlyStream);
        if (userVideo.current) {
          userVideo.current.srcObject = audioOnlyStream;
        }
        setVideoEnabled(false);
        addDebugStep("video", "disabled", "Video stopped");
      }
    }

    if (socketRef.current) {
      socketRef.current.emit("toggle-video", {
        roomId,
        peerId,
        enabled: !videoEnabled,
      });
    }
  };

  const leaveRoom = () => {
    cleanup();
    navigate("/");
  };

  // Host control functions (simplified for debugging)
  const approveParticipant = (participantId) => {
    if (socketRef.current && isHost) {
      socketRef.current.emit("approve-participant", { roomId, participantId });
      addNotification("Participant approved", "success");
    }
  };

  const denyParticipant = (participantId) => {
    if (socketRef.current && isHost) {
      socketRef.current.emit("deny-participant", { roomId, participantId });
      addNotification("Participant denied", "info");
    }
  };

  const removeParticipantHandler = (participantId) => {
    if (!isHost) return;
    if (window.confirm("Remove participant?")) {
      const participant = Object.values(participants).find(
        (p) => p.id === participantId
      );
      if (socketRef.current) {
        socketRef.current.emit("remove-participant", {
          roomId,
          participantId,
          peerId: participant?.peerId,
        });
      }
    }
  };

  const sendMessage = (message) => {
    if (socketRef.current && message.trim()) {
      socketRef.current.emit("send-message", {
        roomId,
        message: message.trim(),
        username,
      });
    }
  };

  const toggleChat = () => {
    setShowChat(!showChat);
    if (!showChat) setHasUnreadMessages(false);
  };

  const toggleHostControls = () => {
    if (!isHost) {
      addNotification("Only the host can access host controls", "error");
      return;
    }
    setShowHostControls(!showHostControls);
  };

  const copyRoomId = () => {
    navigator.clipboard
      .writeText(roomId)
      .then(() => {
        addNotification("Room ID copied", "success");
      })
      .catch(() => {
        const textarea = document.createElement("textarea");
        textarea.value = roomId;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        addNotification("Room ID copied", "success");
      });
  };

  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    }, 5000);
  };

  // Render different states
  if (roomState === "waiting") {
    return (
      <WaitingRoom roomId={roomId} username={username} onLeave={leaveRoom} />
    );
  }

  if (roomState === "denied") {
    return (
      <div className="room connecting">
        <div className="connecting-message">
          <h2>Access Denied</h2>
          <p>The host has denied your request to join this meeting.</p>
          <button onClick={() => navigate("/")} className="copy-button">
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (roomState !== "approved") {
    return (
      <div className="room connecting">
        <div className="connecting-message">
          <h2>{connectionStatus}</h2>
          <div className="spinner"></div>
          <div style={{ marginTop: "20px", color: "#888", fontSize: "14px" }}>
            <p>Current step: {currentStep}</p>
            <p>{detailedStatus}</p>
          </div>

          {/* Debug Panel */}
          <div
            style={{
              marginTop: "30px",
              textAlign: "left",
              backgroundColor: "#2a2a2a",
              padding: "15px",
              borderRadius: "8px",
              maxHeight: "200px",
              overflowY: "auto",
              fontSize: "12px",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", color: "#2d8cff" }}>
              Debug Log:
            </h4>
            {debugSteps.map((step, index) => (
              <div
                key={index}
                style={{
                  margin: "5px 0",
                  color:
                    step.status === "error"
                      ? "#ff6b6b"
                      : step.status === "success"
                      ? "#4caf50"
                      : step.status === "warning"
                      ? "#ff9800"
                      : "#ccc",
                }}
              >
                <strong>[{step.timestamp}]</strong> {step.step}: {step.status}
                {step.details && (
                  <div style={{ marginLeft: "10px", fontSize: "11px" }}>
                    {step.details}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: "20px" }}>
            <button
              onClick={() => {
                initializationRef.current = false;
                window.location.reload();
              }}
              style={{
                backgroundColor: "#2d8cff",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "5px",
                cursor: "pointer",
                marginRight: "10px",
              }}
            >
              Retry Connection
            </button>
            <button
              onClick={() => navigate("/")}
              style={{
                backgroundColor: "#ff5d5d",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="room">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="notifications">
          {notifications.map((notif) => (
            <div key={notif.id} className={`notification ${notif.type}`}>
              {notif.message}
            </div>
          ))}
        </div>
      )}

      <div className="room-header">
        <div>
          <h2>Meeting: {roomId}</h2>
          <div className="connection-status">
            {connectionStatus}
            {isHost && <span className="host-indicator"> 👑 Host</span>}
            {waitingParticipants.length > 0 && isHost && (
              <span className="waiting-indicator">
                {" "}
                | ⏳ {waitingParticipants.length} waiting
              </span>
            )}
          </div>
        </div>
        <div className="header-controls">
          {peerId && (
            <span className="peer-id">ID: {peerId.substring(0, 8)}...</span>
          )}
          <button className="copy-button" onClick={copyRoomId}>
            Copy Room ID
          </button>
        </div>
      </div>

      <div className="participants-container">
        <div className="participant-wrapper">
          <Participant
            username={`${username} (You)`}
            videoRef={userVideo}
            stream={stream}
            muted={true}
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            isLocal={true}
          />
        </div>

        {Object.values(participants).map((participant) => (
          <div className="participant-wrapper" key={participant.peerId}>
            <Participant
              username={participant.username}
              stream={participant.stream}
              audioEnabled={participant.audioEnabled}
              videoEnabled={participant.videoEnabled}
              isLocal={false}
            />
          </div>
        ))}
      </div>

      <Controls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        leaveRoom={leaveRoom}
        toggleParticipants={() => setShowParticipants(!showParticipants)}
        participantsCount={Object.keys(participants).length + 1}
        onToggleChat={toggleChat}
        onToggleHostControls={isHost ? toggleHostControls : null}
        isHost={isHost}
        waitingCount={waitingParticipants.length}
        showChat={showChat}
        showHostControls={showHostControls}
        hasUnreadMessages={hasUnreadMessages}
      />

      {showParticipants && (
        <ParticipantsList
          participants={[
            { id: "self", username: `${username} (You)` },
            ...Object.values(participants).map((p) => ({
              id: p.id,
              username: p.username,
            })),
          ]}
          onClose={() => setShowParticipants(false)}
          onRemove={isHost ? removeParticipantHandler : null}
        />
      )}

      {showChat && (
        <Chat
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          messages={chatMessages}
          onSendMessage={sendMessage}
          currentUsername={username}
          isHost={isHost}
          typingUsers={typingUsers}
        />
      )}

      {isHost && showHostControls && (
        <HostControls
          isOpen={showHostControls}
          onClose={() => setShowHostControls(false)}
          waitingParticipants={waitingParticipants}
          onApprove={approveParticipant}
          onDeny={denyParticipant}
          currentParticipants={[
            {
              id: "self",
              username: `${username} (You)`,
              isHost: true,
              audioEnabled,
              videoEnabled,
            },
            ...Object.values(participants).map((p) => ({
              id: p.id,
              username: p.username,
              isHost: false,
              audioEnabled: p.audioEnabled,
              videoEnabled: p.videoEnabled,
            })),
          ]}
          onRemoveParticipant={removeParticipantHandler}
        />
      )}
    </div>
  );
};

export default Room;
