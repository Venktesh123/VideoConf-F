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
  const [roomState, setRoomState] = useState("connecting"); // connecting, waiting, approved, denied
  const [isHost, setIsHost] = useState(false);
  const [waitingParticipants, setWaitingParticipants] = useState([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Notifications
  const [notifications, setNotifications] = useState([]);

  const socketRef = useRef();
  const peerRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();
  const typingTimeoutRef = useRef();

  // Redirect if no username is provided
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

      // Get media stream first
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

      // Set local video
      if (userVideo.current) {
        userVideo.current.srcObject = mediaStream;
        userVideo.current.muted = true; // Prevent feedback
      }

      setConnectionStatus("Connecting to server...");

      // Initialize socket connection
      socketRef.current = io(API_URL, {
        transports: ["websocket", "polling"],
      });

      // Initialize PeerJS - Use the free cloud server
      peerRef.current = new Peer({
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

      // Setup socket event listeners
      setupSocketEvents(mediaStream);

      // Setup peer event listeners
      setupPeerEvents(mediaStream);
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

  const setupSocketEvents = (mediaStream) => {
    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current.id);
      setConnectionStatus("Connected to server");
    });

    // Handle admission status
    socketRef.current.on(
      "admission-status",
      ({ status, isHost: hostStatus, chatMessages: messages, message }) => {
        console.log("Admission status:", status);

        if (status === "approved") {
          setRoomState("approved");
          setIsHost(hostStatus || false);
          setConnectionStatus("Connected");
          if (messages) {
            setChatMessages(messages);
          }
          if (hostStatus) {
            addNotification("You are the host of this meeting", "success");
          } else {
            addNotification("Welcome to the meeting!", "success");
          }
        } else if (status === "waiting") {
          setRoomState("waiting");
          setConnectionStatus("Waiting for approval");
        } else if (status === "denied") {
          setRoomState("denied");
          addNotification(message || "Access denied by host", "error");
          setTimeout(() => navigate("/"), 3000);
        }
      }
    );

    // Handle waiting room updates (for host)
    socketRef.current.on(
      "waiting-room-update",
      ({ waitingParticipants: waiting }) => {
        setWaitingParticipants(waiting || []);
      }
    );

    // Handle new participant waiting (for host)
    socketRef.current.on(
      "participant-waiting",
      ({ username: waitingUsername }) => {
        addNotification(`${waitingUsername} is waiting to join`, "info");
        // Auto-open host controls if closed
        if (isHost && !showHostControls) {
          setShowHostControls(true);
        }
      }
    );

    // Handle participant approval notifications
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

    // Handle host transfer
    socketRef.current.on(
      "host-transferred",
      ({ isHost: newHostStatus, message }) => {
        setIsHost(newHostStatus);
        addNotification(message, "success");
      }
    );

    socketRef.current.on("host-changed", ({ newHostUsername, message }) => {
      addNotification(message, "info");
    });

    // Existing participant management events
    socketRef.current.on(
      "user-joined",
      ({ participantId, username: newUsername, peerId: newPeerId }) => {
        console.log(`User joined: ${newUsername} (${newPeerId})`);

        if (
          newPeerId &&
          newPeerId !== peerId &&
          peerRef.current &&
          peerRef.current.open
        ) {
          setTimeout(() => {
            makeCall(newPeerId, newUsername, streamRef.current);
          }, 1000);
        }
      }
    );

    socketRef.current.on(
      "room-participants",
      ({ participants: existingParticipants }) => {
        console.log("Existing participants:", existingParticipants);

        Object.values(existingParticipants).forEach((participant) => {
          if (participant.peerId && participant.peerId !== peerId) {
            setTimeout(() => {
              makeCall(
                participant.peerId,
                participant.username,
                streamRef.current
              );
            }, 2000);
          }
        });
      }
    );

    socketRef.current.on(
      "user-left",
      ({ peerId: leftPeerId, participantId, username: leftUsername }) => {
        console.log(`User left: ${leftPeerId}`);

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

    // Chat events
    socketRef.current.on("new-message", (message) => {
      setChatMessages((prev) => [...prev, message]);

      // Show notification if chat is closed and message is not from current user
      if (!showChat && message.username !== username) {
        addNotification(
          `${message.username}: ${message.message.substring(0, 50)}${
            message.message.length > 50 ? "..." : ""
          }`,
          "info"
        );
      }
    });

    // Typing events
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

    socketRef.current.on("room-error", ({ message }) => {
      addNotification(`Error: ${message}`, "error");
      setTimeout(() => navigate("/"), 3000);
    });
  };

  const setupPeerEvents = (mediaStream) => {
    peerRef.current.on("open", (id) => {
      console.log("Peer connected with ID:", id);
      setPeerId(id);
      setConnectionStatus("Joining room...");

      // Join the room with socket and peer info
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
      });

      peersRef.current[call.peer] = call;
    });

    peerRef.current.on("error", (error) => {
      console.error("Peer error:", error);
      setConnectionStatus("Peer connection error");

      setTimeout(() => {
        if (peerRef.current.destroyed) {
          console.log("Attempting to recreate peer connection...");
          initializePeer(mediaStream);
        }
      }, 3000);
    });

    peerRef.current.on("disconnected", () => {
      console.log("Peer disconnected, attempting to reconnect...");
      setConnectionStatus("Reconnecting...");

      if (!peerRef.current.destroyed) {
        peerRef.current.reconnect();
      }
    });

    peerRef.current.on("close", () => {
      console.log("Peer connection closed");
      setConnectionStatus("Disconnected");
    });
  };

  const initializePeer = (mediaStream) => {
    peerRef.current = new Peer({
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      },
      debug: 1,
    });

    setupPeerEvents(mediaStream);
  };

  const makeCall = (remotePeerId, remoteUsername, mediaStream) => {
    console.log("Making call to:", remotePeerId);

    if (
      !peerRef.current ||
      !peerRef.current.open ||
      peersRef.current[remotePeerId]
    ) {
      console.log("Cannot make call - peer not ready or already connected");
      return;
    }

    const call = peerRef.current.call(remotePeerId, mediaStream);

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

  // UI event handlers
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
    if (!videoEnabled) {
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

        const oldStream = streamRef.current;

        if (oldStream) {
          oldStream.getTracks().forEach((track) => track.stop());
        }

        streamRef.current = newStream;
        setStream(newStream);

        if (userVideo.current) {
          userVideo.current.srcObject = newStream;
        }

        Object.values(peersRef.current).forEach((call) => {
          if (call && call.peerConnection) {
            const videoTrack = newStream.getVideoTracks()[0];
            const audioTrack = newStream.getAudioTracks()[0];

            const senders = call.peerConnection.getSenders();

            senders.forEach((sender) => {
              if (sender.track) {
                if (sender.track.kind === "video" && videoTrack) {
                  sender.replaceTrack(videoTrack);
                } else if (sender.track.kind === "audio" && audioTrack) {
                  sender.replaceTrack(audioTrack);
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
      if (streamRef.current) {
        const videoTracks = streamRef.current.getVideoTracks();
        videoTracks.forEach((track) => {
          track.stop();
        });

        const audioTracks = streamRef.current.getAudioTracks();
        const audioOnlyStream = new MediaStream(audioTracks);

        streamRef.current = audioOnlyStream;
        setStream(audioOnlyStream);

        if (userVideo.current) {
          userVideo.current.srcObject = audioOnlyStream;
        }

        Object.values(peersRef.current).forEach((call) => {
          if (call && call.peerConnection) {
            const senders = call.peerConnection.getSenders();
            senders.forEach((sender) => {
              if (sender.track && sender.track.kind === "video") {
                sender.replaceTrack(null);
              }
            });
          }
        });

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

  // Host controls
  const approveParticipant = (participantId) => {
    if (socketRef.current) {
      socketRef.current.emit("approve-participant", { roomId, participantId });
    }
  };

  const denyParticipant = (participantId) => {
    if (socketRef.current) {
      socketRef.current.emit("deny-participant", { roomId, participantId });
    }
  };

  const removeParticipantHandler = (participantId) => {
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
      }
    }
  };

  // Chat functions
  const sendMessage = (message) => {
    if (socketRef.current && message.trim()) {
      socketRef.current.emit("send-message", {
        roomId,
        message: message.trim(),
        username,
      });
    }
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

  // Notification system
  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    }, 5000);
  };

  // Show waiting room if user is waiting for approval
  if (roomState === "waiting") {
    return (
      <WaitingRoom roomId={roomId} username={username} onLeave={leaveRoom} />
    );
  }

  // Show main room interface only if approved
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
            {isHost && <span className="host-indicator">👑 Host</span>}
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
        {/* Current user's video */}
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

        {/* Other participants */}
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

      {/* No participants message */}
      {Object.keys(participants).length === 0 && (
        <div className="no-participants-message">
          <p>Share the room ID with others to start the meeting!</p>
          <p>Status: {connectionStatus}</p>
        </div>
      )}

      {/* Controls */}
      <Controls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        leaveRoom={leaveRoom}
        toggleParticipants={() => setShowParticipants(!showParticipants)}
        participantsCount={Object.keys(participants).length + 1}
        onToggleChat={() => setShowChat(!showChat)}
        onToggleHostControls={
          isHost ? () => setShowHostControls(!showHostControls) : null
        }
        isHost={isHost}
        waitingCount={waitingParticipants.length}
        showChat={showChat}
        showHostControls={showHostControls}
        hasUnreadMessages={chatMessages.length > 0 && !showChat}
      />

      {/* Participants list sidebar */}
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

      {/* Chat sidebar */}
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

      {/* Host controls sidebar */}
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
