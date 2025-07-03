import React, { useEffect, useRef, useState } from "react";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
} from "react-icons/fa";
import "./Participant.css";

const Participant = ({
  username,
  videoRef,
  stream,
  muted = false,
  audioEnabled = true,
  videoEnabled = true,
  isLocal = false,
}) => {
  const videoElement = useRef();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);

  useEffect(() => {
    const video = videoRef || videoElement.current;

    if (video && stream) {
      // Clear any existing srcObject
      if (video.srcObject) {
        const oldTracks = video.srcObject.getTracks();
        oldTracks.forEach((track) => track.stop());
      }

      video.srcObject = stream;
      setIsStreamReady(true);

      const handleLoadedMetadata = () => {
        setIsVideoPlaying(true);
        video.play().catch((error) => {
          console.log("Video play failed:", error);
          setIsVideoPlaying(false);
        });
      };

      const handleCanPlay = () => {
        if (video.paused) {
          video.play().catch((error) => {
            console.log("Video play failed on canplay:", error);
          });
        }
      };

      const handleError = (error) => {
        console.error("Video error:", error);
        setIsVideoPlaying(false);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("error", handleError);

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("error", handleError);
      };
    } else {
      setIsStreamReady(false);
      setIsVideoPlaying(false);
    }
  }, [stream, videoRef]);

  // Monitor video track state
  useEffect(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];

        const handleTrackEnded = () => {
          console.log("Video track ended");
          setIsVideoPlaying(false);
        };

        videoTrack.addEventListener("ended", handleTrackEnded);

        return () => {
          videoTrack.removeEventListener("ended", handleTrackEnded);
        };
      }
    }
  }, [stream]);

  // For local video, use the ref passed from parent
  // For remote video, use our own ref
  const videoToUse = isLocal ? videoRef : videoElement;

  const shouldShowVideo = videoEnabled && stream && isStreamReady;
  const hasVideoTracks = stream?.getVideoTracks().length > 0;

  return (
    <div className="participant">
      <div className="video-container">
        <video
          ref={videoToUse}
          autoPlay
          playsInline
          muted={muted}
          className={`participant-video ${
            !shouldShowVideo ? "video-hidden" : ""
          }`}
        />

        {(!shouldShowVideo || !hasVideoTracks) && (
          <div className="video-off-indicator">
            <div className="avatar">{username.charAt(0).toUpperCase()}</div>
            {!isLocal && !isStreamReady && (
              <div className="connection-status">Connecting...</div>
            )}
          </div>
        )}

        {!stream && !isLocal && (
          <div className="loading-indicator">
            <div className="loading-spinner"></div>
            <span>Connecting...</span>
          </div>
        )}
      </div>

      <div className="participant-info">
        <div className="participant-name" title={username}>
          {username}
        </div>
        <div className="participant-controls">
          {audioEnabled ? (
            <FaMicrophone
              className="control-icon audio-on"
              title="Microphone is on"
            />
          ) : (
            <FaMicrophoneSlash
              className="control-icon audio-off"
              title="Microphone is off"
            />
          )}

          {videoEnabled && hasVideoTracks ? (
            <FaVideo className="control-icon video-on" title="Camera is on" />
          ) : (
            <FaVideoSlash
              className="control-icon video-off"
              title="Camera is off"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Participant;
