import React, { useEffect, useState, useRef, useCallback } from "react";
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

// Use environment variable or fallback to production URL
const API_URL =
  import.meta.env.VITE_API_URL || "https://conference-b.onrender.com";
const isDevelopment = import.meta.env.DEV;

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { username } = location.state || {};

  // Connection states
  const [participants, setParticipants] = useState({});
  const [stream, setStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHostControls, setShowHostControls] = useState(false);
  const [peerId, setPeerId] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [roomState, setRoomState] = useState("connecting");
  const [isHost, setIsHost] = useState(false);
  const [waitingParticipants, setWaitingParticipants] = useState([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);

  // Refs for persistent connections
  const socketRef = useRef();
  const peerRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();
  const connectionEstablished = useRef(false);
  const initializationRef = useRef(false);
  const reconnectTimeoutRef = useRef();
  const heartbeatIntervalRef = useRef();

  // Memoized functions to prevent re-renders
  const addNotification = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    }, 5000);
  }, []);

  const addParticipant = useCallback(
    (peerId, stream, call, username = "Unknown") => {
      console.log(`➕ Adding participant: ${username} (${peerId})`);
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
    },
    []
  );

  const removeParticipant = useCallback((peerId) => {
    console.log(`➖ Removing participant: ${peerId}`);
    if (peersRef.current[peerId]) {
      try {
        peersRef.current[peerId].close();
      } catch (error) {
        console.error("Error closing peer connection:", error);
      }
      delete peersRef.current[peerId];
    }
    setParticipants((prev) => {
      const newParticipants = { ...prev };
      delete newParticipants[peerId];
      return newParticipants;
    });
  }, []);

  // Enhanced media initialization with retry logic
  const initializeMedia = useCallback(
    async (retryCount = 0) => {
      try {
        setConnectionStatus("Requesting camera and microphone...");

        // Stop existing tracks before requesting new ones
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (error) {
              console.warn("Error stopping track:", error);
            }
          });
        }

        const mediaConstraints = {
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: "user",
            frameRate: { ideal: 30, max: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
          },
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(
          mediaConstraints
        );

        // Verify stream is active
        const videoTracks = mediaStream.getVideoTracks();
        const audioTracks = mediaStream.getAudioTracks();

        console.log(
          `📹 Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`
        );

        if (videoTracks.length === 0 && audioTracks.length === 0) {
          throw new Error("No media tracks available");
        }

        // Set up stream monitoring
        videoTracks.forEach((track) => {
          track.addEventListener("ended", () => {
            console.warn("Video track ended unexpectedly");
            // Attempt to restart video
            setTimeout(() => initializeMedia(0), 1000);
          });
        });

        audioTracks.forEach((track) => {
          track.addEventListener("ended", () => {
            console.warn("Audio track ended unexpectedly");
            // Attempt to restart audio
            setTimeout(() => initializeMedia(0), 1000);
          });
        });

        setStream(mediaStream);
        streamRef.current = mediaStream;
        setVideoEnabled(videoTracks.length > 0);
        setAudioEnabled(audioTracks.length > 0);

        if (userVideo.current) {
          userVideo.current.srcObject = mediaStream;
          userVideo.current.muted = true;

          // Ensure video plays
          try {
            await userVideo.current.play();
          } catch (playError) {
            console.warn("Autoplay failed, but continuing:", playError);
          }
        }

        return mediaStream;
      } catch (error) {
        console.error(
          `Media initialization failed (attempt ${retryCount + 1}):`,
          error
        );

        if (retryCount < 2) {
          console.log(`Retrying media initialization in 2 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return initializeMedia(retryCount + 1);
        }

        // If all retries failed, try audio-only
        if (retryCount < 3) {
          try {
            console.log("Attempting audio-only fallback...");
            const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            setStream(audioOnlyStream);
            streamRef.current = audioOnlyStream;
            setVideoEnabled(false);
            setAudioEnabled(true);
            addNotification("Camera unavailable, using audio only", "warning");
            return audioOnlyStream;
          } catch (audioError) {
            console.error("Audio-only fallback failed:", audioError);
          }
        }

        let errorMessage = "Failed to access camera/microphone: ";
        if (error.name === "NotAllowedError") {
          errorMessage += "Permission denied. Please allow access and refresh.";
        } else if (error.name === "NotFoundError") {
          errorMessage += "No camera or microphone found.";
        } else if (error.name === "NotReadableError") {
          errorMessage += "Device is already in use by another application.";
        } else {
          errorMessage += error.message;
        }

        throw new Error(errorMessage);
      }
    },
    [addNotification]
  );

  // Enhanced socket connection with better error handling
  const initializeSocket = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      setConnectionStatus("Connecting to server...");

      socketRef.current = io(API_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true,
      });

      const connectionTimeout = setTimeout(() => {
        reject(new Error("Socket connection timeout"));
      }, 20000);

      socketRef.current.on("connect", () => {
        clearTimeout(connectionTimeout);
        console.log(`🔌 Connected to server: ${socketRef.current.id}`);
        setConnectionStatus("Connected to server");

        // Set up heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        heartbeatIntervalRef.current = setInterval(() => {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("heartbeat-response");
          }
        }, 30000);

        resolve();
      });

      socketRef.current.on("connect_error", (error) => {
        clearTimeout(connectionTimeout);
        console.error("Socket connection error:", error);
        reject(new Error(`Socket connection failed: ${error.message}`));
      });

      socketRef.current.on("disconnect", (reason) => {
        console.warn(`🔌 Disconnected from server: ${reason}`);
        setConnectionStatus("Disconnected from server");

        if (reason === "io server disconnect") {
          // Server disconnected us, try to reconnect
          setTimeout(() => {
            if (!connectionEstablished.current) return;
            console.log("Attempting to reconnect...");
            initializeSocket().catch(console.error);
          }, 2000);
        }
      });

      socketRef.current.on("reconnect", () => {
        console.log("🔌 Reconnected to server");
        setConnectionStatus("Reconnected to server");
        addNotification("Reconnected to server", "success");
      });

      socketRef.current.on("heartbeat", () => {
        if (socketRef.current) {
          socketRef.current.emit("heartbeat-response");
        }
      });
    });
  }, [addNotification]);

  // Enhanced peer connection
  const initializePeer = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (error) {
          console.warn("Error destroying previous peer:", error);
        }
      }

      setConnectionStatus("Initializing peer connection...");

      peerRef.current = new Peer(undefined, {
        host: isDevelopment ? "localhost" : "conference-b-peerjs.onrender.com",
        port: isDevelopment ? 9000 : 443,
        path: "/peerjs",
        secure: !isDevelopment,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
          ],
          sdpSemantics: "unified-plan",
        },
        debug: isDevelopment ? 3 : 1,
      });

      const peerTimeout = setTimeout(() => {
        reject(new Error("Peer connection timeout"));
      }, 15000);

      peerRef.current.on("open", (id) => {
        clearTimeout(peerTimeout);
        console.log(`📡 Peer connected with ID: ${id}`);
        setPeerId(id);
        setConnectionStatus("Peer connection established");
        resolve(id);
      });

      peerRef.current.on("error", (error) => {
        clearTimeout(peerTimeout);
        console.error("Peer error:", error);
        reject(new Error(`Peer connection failed: ${error.message}`));
      });

      peerRef.current.on("disconnected", () => {
        console.warn("📡 Peer disconnected, attempting reconnection...");
        if (connectionEstablished.current) {
          try {
            peerRef.current.reconnect();
          } catch (error) {
            console.error("Peer reconnection failed:", error);
          }
        }
      });
    });
  }, []);

  // Enhanced call management
  const makeCall = useCallback(
    (remotePeerId, remoteUsername) => {
      console.log(`📞 Making call to ${remoteUsername} (${remotePeerId})`);

      if (!peerRef.current || !peerRef.current.open || !streamRef.current) {
        console.warn("Cannot make call: peer or stream not ready");
        return;
      }

      if (peersRef.current[remotePeerId]) {
        console.warn("Call already exists with this peer");
        return;
      }

      try {
        const call = peerRef.current.call(remotePeerId, streamRef.current);

        if (!call) {
          console.error("Failed to create call");
          return;
        }

        // Set up call event handlers
        call.on("stream", (remoteStream) => {
          console.log(`📹 Received stream from ${remoteUsername}`);
          addParticipant(remotePeerId, remoteStream, call, remoteUsername);
        });

        call.on("close", () => {
          console.log(`📞 Call closed with ${remoteUsername}`);
          removeParticipant(remotePeerId);
        });

        call.on("error", (error) => {
          console.error(`📞 Call error with ${remoteUsername}:`, error);
          removeParticipant(remotePeerId);
        });

        // Store the call
        peersRef.current[remotePeerId] = call;

        // Set up call timeout
        setTimeout(() => {
          if (call && call.open === false) {
            console.warn(`Call to ${remoteUsername} timed out`);
            call.close();
            removeParticipant(remotePeerId);
          }
        }, 30000);
      } catch (error) {
        console.error(`Error making call to ${remoteUsername}:`, error);
      }
    },
    [addParticipant, removeParticipant]
  );

  // Socket event handlers
  const setupSocketEvents = useCallback(() => {
    if (!socketRef.current) return;

    // Handle admission status
    socketRef.current.on(
      "admission-status",
      ({ status, isHost: hostStatus, chatMessages: messages, message }) => {
        console.log(`🎫 Admission status: ${status}, Host: ${hostStatus}`);

        if (status === "approved") {
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
        } else if (status === "waiting") {
          setRoomState("waiting");
          setConnectionStatus("Waiting for host approval");
        } else if (status === "denied") {
          setRoomState("denied");
          addNotification(message || "Access denied by host", "error");
          setTimeout(() => navigate("/"), 3000);
        }
      }
    );

    // Handle room errors
    socketRef.current.on("room-error", ({ message }) => {
      console.error("Room error:", message);
      addNotification(`Room error: ${message}`, "error");
      setTimeout(() => navigate("/"), 3000);
    });

    // Handle waiting room updates
    socketRef.current.on(
      "waiting-room-update",
      ({ waitingParticipants: waiting }) => {
        setWaitingParticipants(waiting || []);
      }
    );

    // Handle user joined
    socketRef.current.on(
      "user-joined",
      ({ participantId, username: newUsername, peerId: newPeerId }) => {
        console.log(`👤 ${newUsername} joined with peer ID ${newPeerId}`);
        addNotification(`${newUsername} joined the meeting`, "success");

        if (
          newPeerId &&
          newPeerId !== peerId &&
          connectionEstablished.current
        ) {
          // Delay the call to allow the other peer to be ready
          setTimeout(() => makeCall(newPeerId, newUsername), 2000);
        }
      }
    );

    // Handle existing participants
    socketRef.current.on(
      "room-participants",
      ({ participants: existingParticipants }) => {
        console.log(
          `👥 Found ${
            Object.keys(existingParticipants || {}).length
          } existing participants`
        );

        if (existingParticipants && connectionEstablished.current) {
          Object.values(existingParticipants).forEach((participant) => {
            if (participant.peerId && participant.peerId !== peerId) {
              setTimeout(
                () => makeCall(participant.peerId, participant.username),
                3000
              );
            }
          });
        }
      }
    );

    // Handle user left
    socketRef.current.on(
      "user-left",
      ({ peerId: leftPeerId, username: leftUsername }) => {
        console.log(`👋 ${leftUsername} left`);
        addNotification(`${leftUsername} left the meeting`, "info");
        removeParticipant(leftPeerId);
      }
    );

    // Handle media toggles
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

    // Handle chat
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

    // Handle host transfer
    socketRef.current.on(
      "host-transferred",
      ({ isHost: newHostStatus, message }) => {
        setIsHost(newHostStatus);
        addNotification(message, "success");
      }
    );

    // Handle incoming calls
    if (peerRef.current) {
      peerRef.current.on("call", (call) => {
        console.log(`📞 Incoming call from ${call.peer}`);

        if (streamRef.current) {
          call.answer(streamRef.current);

          call.on("stream", (remoteStream) => {
            console.log(`📹 Received stream from incoming call: ${call.peer}`);
            addParticipant(call.peer, remoteStream, call, "Unknown");
          });

          call.on("close", () => {
            console.log(`📞 Incoming call closed: ${call.peer}`);
            removeParticipant(call.peer);
          });

          call.on("error", (error) => {
            console.error(`📞 Incoming call error: ${call.peer}`, error);
            removeParticipant(call.peer);
          });

          peersRef.current[call.peer] = call;
        } else {
          console.warn("No stream available to answer call");
          call.close();
        }
      });
    }
  }, [
    peerId,
    username,
    showChat,
    addNotification,
    navigate,
    makeCall,
    addParticipant,
    removeParticipant,
  ]);

  // Main initialization function
  const initializeConnection = useCallback(async () => {
    try {
      // Step 1: Test server connectivity
      setConnectionStatus("Testing server connection...");
      const healthResponse = await fetch(`${API_URL}/health`);
      if (!healthResponse.ok) {
        throw new Error("Server is not responding");
      }

      // Step 2: Test room existence
      setConnectionStatus("Checking room...");
      const roomResponse = await fetch(`${API_URL}/api/room/${roomId}`);
      if (!roomResponse.ok) {
        throw new Error("Room does not exist");
      }

      // Step 3: Initialize media
      const mediaStream = await initializeMedia();

      // Step 4: Initialize socket
      await initializeSocket();

      // Step 5: Initialize peer
      const peerIdResult = await initializePeer();

      // Step 6: Set up socket events
      setupSocketEvents();

      // Step 7: Join room
      setConnectionStatus("Joining room...");
      socketRef.current.emit("join-room", {
        roomId,
        username,
        peerId: peerIdResult,
      });
    } catch (error) {
      console.error("Connection initialization failed:", error);
      addNotification(`Connection failed: ${error.message}`, "error");

      // Retry logic
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          if (initializationRef.current) {
            console.log("Retrying connection...");
            initializeConnection();
          }
        }, 5000);
      }
    }
  }, [
    roomId,
    username,
    initializeMedia,
    initializeSocket,
    initializePeer,
    setupSocketEvents,
    addNotification,
  ]);

  // Main effect
  useEffect(() => {
    if (!username || !roomId) {
      navigate("/");
      return;
    }

    if (initializationRef.current) {
      return;
    }

    initializationRef.current = true;
    connectionEstablished.current = false;

    initializeConnection();

    return () => {
      console.log("🧹 Cleaning up Room component...");
      initializationRef.current = false;
      connectionEstablished.current = false;

      // Clear timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Stop media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (error) {
            console.warn("Error stopping track:", error);
          }
        });
      }

      // Close peer connections
      Object.values(peersRef.current).forEach((call) => {
        if (call && typeof call.close === "function") {
          try {
            call.close();
          } catch (error) {
            console.warn("Error closing call:", error);
          }
        }
      });

      // Destroy peer
      if (peerRef.current && !peerRef.current.destroyed) {
        try {
          peerRef.current.destroy();
        } catch (error) {
          console.warn("Error destroying peer:", error);
        }
      }

      // Disconnect socket
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (error) {
          console.warn("Error disconnecting socket:", error);
        }
      }
    };
  }, [username, roomId, navigate, initializeConnection]);

  // Enhanced toggle functions with better stream management
  const toggleAudio = useCallback(() => {
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
  }, [audioEnabled, roomId, peerId]);

  const toggleVideo = useCallback(async () => {
    try {
      if (!videoEnabled) {
        // Enable video
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: true,
        });

        // Stop old stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Update refs and state
        streamRef.current = newStream;
        setStream(newStream);
        setVideoEnabled(true);

        // Update video element
        if (userVideo.current) {
          userVideo.current.srcObject = newStream;
        }

        // Update all peer connections
        Object.values(peersRef.current).forEach((call) => {
          if (call && call.peerConnection) {
            const senders = call.peerConnection.getSenders();
            const videoTrack = newStream.getVideoTracks()[0];
            const audioTrack = newStream.getAudioTracks()[0];

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
      } else {
        // Disable video
        if (streamRef.current) {
          const videoTracks = streamRef.current.getVideoTracks();
          videoTracks.forEach((track) => track.stop());

          const audioTracks = streamRef.current.getAudioTracks();
          const audioOnlyStream = new MediaStream(audioTracks);

          streamRef.current = audioOnlyStream;
          setStream(audioOnlyStream);
          setVideoEnabled(false);

          if (userVideo.current) {
            userVideo.current.srcObject = audioOnlyStream;
          }
        }
      }

      // Notify server
      if (socketRef.current) {
        socketRef.current.emit("toggle-video", {
          roomId,
          peerId,
          enabled: !videoEnabled,
        });
      }
    } catch (error) {
      console.error("Error toggling video:", error);
      addNotification("Failed to toggle video", "error");
    }
  }, [videoEnabled, roomId, peerId, addNotification]);

  const leaveRoom = useCallback(() => {
    initializationRef.current = false;
    connectionEstablished.current = false;
    navigate("/");
  }, [navigate]);

  // Host control functions
  const approveParticipant = useCallback(
    (participantId) => {
      if (socketRef.current && isHost) {
        socketRef.current.emit("approve-participant", {
          roomId,
          participantId,
        });
        addNotification("Participant approved", "success");
      }
    },
    [roomId, isHost, addNotification]
  );

  const denyParticipant = useCallback(
    (participantId) => {
      if (socketRef.current && isHost) {
        socketRef.current.emit("deny-participant", { roomId, participantId });
        addNotification("Participant denied", "info");
      }
    },
    [roomId, isHost, addNotification]
  );

  const removeParticipantHandler = useCallback(
    (participantId) => {
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
    },
    [isHost, participants, roomId]
  );

  const sendMessage = useCallback(
    (message) => {
      if (socketRef.current && message.trim()) {
        socketRef.current.emit("send-message", {
          roomId,
          message: message.trim(),
          username,
        });
      }
    },
    [roomId, username]
  );

  const toggleChat = useCallback(() => {
    setShowChat(!showChat);
    if (!showChat) setHasUnreadMessages(false);
  }, [showChat]);

  const toggleHostControls = useCallback(() => {
    if (!isHost) {
      addNotification("Only the host can access host controls", "error");
      return;
    }
    setShowHostControls(!showHostControls);
  }, [isHost, showHostControls, addNotification]);

  const copyRoomId = useCallback(() => {
    navigator.clipboard
      .writeText(roomId)
      .then(() => addNotification("Room ID copied", "success"))
      .catch(() => {
        const textarea = document.createElement("textarea");
        textarea.value = roomId;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        addNotification("Room ID copied", "success");
      });
  }, [roomId, addNotification]);

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
          <div style={{ marginTop: "20px" }}>
            <button
              onClick={() => {
                initializationRef.current = false;
                window.location.reload();
              }}
              className="copy-button"
              style={{ marginRight: "10px" }}
            >
              Retry Connection
            </button>
            <button onClick={() => navigate("/")} className="copy-button">
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
