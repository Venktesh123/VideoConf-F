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

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    initializeConnection();

    return () => {
      cleanup();
    };
  }, [username, navigate, roomId]);

  const initializeConnection = async () => {
    try {
      setConnectionStatus("Getting media...");

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

      setStream(mediaStream);
      streamRef.current = mediaStream;

      if (userVideo.current) {
        userVideo.current.srcObject = mediaStream;
        userVideo.current.muted = true;
      }

      setConnectionStatus("Connecting to server...");

      // Initialize Socket connection
      socketRef.current = io(API_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Initialize Peer connection
      peerRef.current = new Peer(undefined, {
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun.relay.metered.ca:80" },
          ],
        },
        debug: 1,
      });

      setupSocketEvents();
      setupPeerEvents();
    } catch (error) {
      console.error("Error initializing connection:", error);
      setConnectionStatus("Failed to connect");
      addNotification(
        "Failed to access camera/microphone. Please check permissions.",
        "error"
      );
      setTimeout(() => navigate("/"), 3000);
    }
  };

  const setupSocketEvents = () => {
    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current.id);
      setConnectionStatus("Connected to server");
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnectionStatus("Disconnected from server");
    });

    // Handle admission status - FIXED
    socketRef.current.on(
      "admission-status",
      ({ status, isHost: hostStatus, chatMessages: messages, message }) => {
        console.log(
          "Admission status received:",
          status,
          "isHost:",
          hostStatus
        );

        if (status === "approved") {
          setRoomState("approved");
          setIsHost(hostStatus || false);
          setConnectionStatus("Connected");
          connectionEstablished.current = true;

          // Set chat messages if available
          if (messages && Array.isArray(messages)) {
            setChatMessages(messages);
          }

          // Show appropriate notifications
          if (hostStatus) {
            addNotification("You are the host of this meeting", "success");
            // Auto-show host controls for new hosts
            setTimeout(() => {
              setShowHostControls(true);
            }, 1000);
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

    // Handle waiting room updates - FIXED
    socketRef.current.on(
      "waiting-room-update",
      ({ waitingParticipants: waiting }) => {
        console.log("Waiting room update received:", waiting);
        setWaitingParticipants(waiting || []);

        // Show host controls if there are waiting participants and user is host
        if (isHost && waiting && waiting.length > 0) {
          if (!showHostControls) {
            setShowHostControls(true);
          }
          addNotification(
            `${waiting.length} participant(s) waiting for approval`,
            "warning"
          );
        }
      }
    );

    // Handle new participant waiting - FIXED
    socketRef.current.on(
      "participant-waiting",
      ({ username: waitingUsername, participantId, peerId: waitingPeerId }) => {
        console.log("New participant waiting:", waitingUsername);
        addNotification(`${waitingUsername} is waiting to join`, "info");

        // Force show host controls for the host
        if (isHost) {
          setShowHostControls(true);
        }
      }
    );

    // Handle participant events
    socketRef.current.on(
      "user-joined",
      ({ participantId, username: newUsername, peerId: newPeerId }) => {
        console.log(`User joined: ${newUsername} (${newPeerId})`);
        addNotification(`${newUsername} joined the meeting`, "success");

        if (
          newPeerId &&
          newPeerId !== peerId &&
          peerRef.current &&
          connectionEstablished.current
        ) {
          setTimeout(() => {
            makeCall(newPeerId, newUsername);
          }, 1000);
        }
      }
    );

    socketRef.current.on(
      "room-participants",
      ({ participants: existingParticipants }) => {
        console.log("Existing participants:", existingParticipants);

        if (existingParticipants && connectionEstablished.current) {
          Object.values(existingParticipants).forEach((participant) => {
            if (participant.peerId && participant.peerId !== peerId) {
              setTimeout(() => {
                makeCall(participant.peerId, participant.username);
              }, 2000);
            }
          });
        }
      }
    );

    socketRef.current.on(
      "user-left",
      ({ peerId: leftPeerId, participantId, username: leftUsername }) => {
        console.log(`User left: ${leftPeerId}`);
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

    socketRef.current.on(
      "user-toggle-audio",
      ({ peerId: remotePeerId, enabled }) => {
        setParticipants((prev) => ({
          ...prev,
          [remotePeerId]: {
            ...prev[remotePeerId],
            audioEnabled: enabled,
          },
        }));
      }
    );

    socketRef.current.on(
      "user-toggle-video",
      ({ peerId: remotePeerId, enabled }) => {
        setParticipants((prev) => ({
          ...prev,
          [remotePeerId]: {
            ...prev[remotePeerId],
            videoEnabled: enabled,
          },
        }));
      }
    );

    // Handle removal events
    socketRef.current.on("you-were-removed", ({ message }) => {
      addNotification(
        message || "You have been removed from the meeting",
        "error"
      );
      setTimeout(() => navigate("/"), 3000);
    });

    socketRef.current.on(
      "user-removed",
      ({ peerId: removedPeerId, username: removedUsername }) => {
        addNotification(
          `${removedUsername} was removed from the meeting`,
          "warning"
        );

        if (removedPeerId && peersRef.current[removedPeerId]) {
          peersRef.current[removedPeerId].close();
          delete peersRef.current[removedPeerId];
        }

        setParticipants((prev) => {
          const newParticipants = { ...prev };
          delete newParticipants[removedPeerId];
          return newParticipants;
        });
      }
    );

    // Handle host events - FIXED
    socketRef.current.on(
      "host-transferred",
      ({ isHost: newHostStatus, message }) => {
        console.log("Host transferred:", newHostStatus);
        setIsHost(newHostStatus);
        addNotification(message, "success");
        if (newHostStatus) {
          setShowHostControls(true);
        } else {
          setShowHostControls(false);
        }
      }
    );

    socketRef.current.on("host-changed", ({ newHostUsername, message }) => {
      addNotification(message, "info");
    });

    // Handle chat events
    socketRef.current.on("new-message", (message) => {
      setChatMessages((prev) => [...prev, message]);

      if (!showChat && message.username !== username) {
        setHasUnreadMessages(true);
        addNotification(
          `${message.username}: ${message.message.substring(0, 30)}${
            message.message.length > 30 ? "..." : ""
          }`,
          "info"
        );
      }
    });

    socketRef.current.on("user-typing", ({ username: typingUsername }) => {
      setTypingUsers((prev) => {
        if (!prev.includes(typingUsername)) {
          return [...prev, typingUsername];
        }
        return prev;
      });
    });

    socketRef.current.on("user-stopped-typing", () => {
      setTypingUsers([]);
    });

    // Handle approval events - FIXED
    socketRef.current.on(
      "participant-approved",
      ({ username: approvedUsername, message }) => {
        addNotification(message, "success");
      }
    );

    socketRef.current.on(
      "participant-removed",
      ({ username: removedUsername, message }) => {
        addNotification(message, "warning");
      }
    );

    socketRef.current.on(
      "participant-left",
      ({ username: leftUsername, message }) => {
        addNotification(message, "info");
      }
    );

    socketRef.current.on("room-error", ({ message }) => {
      addNotification(`Error: ${message}`, "error");
      setTimeout(() => navigate("/"), 3000);
    });

    // Add error handler for socket
    socketRef.current.on("error", (error) => {
      console.error("Socket error:", error);
      addNotification("Connection error occurred", "error");
    });
  };

  const setupPeerEvents = () => {
    peerRef.current.on("open", (id) => {
      console.log("Peer connected with ID:", id);
      setPeerId(id);
      setConnectionStatus("Joining room...");

      // Join room with socket
      socketRef.current.emit("join-room", {
        roomId,
        username,
        peerId: id,
      });
    });

    peerRef.current.on("call", (call) => {
      console.log("Receiving call from:", call.peer);

      call.answer(streamRef.current);

      call.on("stream", (remoteStream) => {
        console.log("Received remote stream from:", call.peer);
        addParticipant(call.peer, remoteStream, call);
      });

      call.on("close", () => {
        console.log("Call closed from:", call.peer);
        removeParticipant(call.peer);
      });

      call.on("error", (error) => {
        console.error("Call error:", error);
        removeParticipant(call.peer);
      });

      peersRef.current[call.peer] = call;
    });

    peerRef.current.on("error", (error) => {
      console.error("Peer error:", error);
      setConnectionStatus("Connection error");
    });

    peerRef.current.on("disconnected", () => {
      console.log("Peer disconnected, attempting to reconnect...");
      if (!peerRef.current.destroyed) {
        peerRef.current.reconnect();
      }
    });
  };

  const makeCall = (remotePeerId, remoteUsername) => {
    console.log("Making call to:", remotePeerId);

    if (
      !peerRef.current ||
      !peerRef.current.open ||
      peersRef.current[remotePeerId]
    ) {
      console.log("Cannot make call - peer not ready or already connected");
      return;
    }

    const call = peerRef.current.call(remotePeerId, streamRef.current);

    if (!call) {
      console.error("Failed to create call to:", remotePeerId);
      return;
    }

    call.on("stream", (remoteStream) => {
      console.log("Received stream from called peer:", remotePeerId);
      addParticipant(remotePeerId, remoteStream, call, remoteUsername);
    });

    call.on("close", () => {
      console.log("Call closed to:", remotePeerId);
      removeParticipant(remotePeerId);
    });

    call.on("error", (error) => {
      console.error("Call error to", remotePeerId, ":", error);
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
    console.log("Cleaning up connections...");
    connectionEstablished.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    Object.values(peersRef.current).forEach((call) => {
      if (call && call.close) {
        call.close();
      }
    });

    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

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
    console.log("Toggling video. Current state:", videoEnabled);

    if (!videoEnabled) {
      // Starting video
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
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

        // Stop old stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        streamRef.current = newStream;
        setStream(newStream);

        if (userVideo.current) {
          userVideo.current.srcObject = newStream;
        }

        // Update all peer connections
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
      } catch (error) {
        console.error("Error getting video stream:", error);
        addNotification(
          "Failed to access camera. Please check permissions.",
          "error"
        );
        return;
      }
    } else {
      // Stopping video
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

  // FIXED: Host control functions with better error handling
  const approveParticipant = (participantId) => {
    console.log("Approving participant:", participantId);
    if (socketRef.current && isHost) {
      socketRef.current.emit("approve-participant", { roomId, participantId });
      addNotification("Participant approved", "success");
    } else {
      addNotification("Only the host can approve participants", "error");
    }
  };

  const denyParticipant = (participantId) => {
    console.log("Denying participant:", participantId);
    if (socketRef.current && isHost) {
      socketRef.current.emit("deny-participant", { roomId, participantId });
      addNotification("Participant denied", "info");
    } else {
      addNotification("Only the host can deny participants", "error");
    }
  };

  const removeParticipantHandler = (participantId) => {
    if (!isHost) {
      addNotification("Only the host can remove participants", "error");
      return;
    }

    if (window.confirm("Are you sure you want to remove this participant?")) {
      const participant = Object.values(participants).find(
        (p) => p.id === participantId
      );
      if (socketRef.current) {
        socketRef.current.emit("remove-participant", {
          roomId,
          participantId,
          peerId: participant?.peerId,
        });
        addNotification("Participant removed", "info");
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
    if (!showChat) {
      setHasUnreadMessages(false);
    }
  };

  // FIXED: Toggle host controls with proper state management
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
        addNotification("Room ID copied to clipboard", "success");
      })
      .catch(() => {
        const textarea = document.createElement("textarea");
        textarea.value = roomId;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        addNotification("Room ID copied to clipboard", "success");
      });
  };

  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    }, 5000);
  };

  // FIXED: Request waiting room data on host status change
  useEffect(() => {
    if (isHost && socketRef.current && connectionEstablished.current) {
      console.log("Host status confirmed, requesting waiting room data");
      socketRef.current.emit("get-waiting-room", { roomId });
    }
  }, [isHost, roomId]);

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
