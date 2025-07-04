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
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  useEffect(() => {
    const video = videoRef || videoElement.current;

    if (video && stream) {
      console.log(`Setting up video for ${username}, isLocal: ${isLocal}`);

      // Clear any existing srcObject
      if (video.srcObject) {
        const oldTracks = video.srcObject.getTracks();
        oldTracks.forEach((track) => {
          if (track !== stream.getTracks().find((t) => t.kind === track.kind)) {
            track.stop();
          }
        });
      }

      video.srcObject = stream;
      setIsStreamReady(true);

      // Check if stream has video tracks
      const videoTracks = stream.getVideoTracks();
      setHasVideoTrack(videoTracks.length > 0 && videoTracks[0].enabled);

      const handleLoadedMetadata = () => {
        console.log(`Video metadata loaded for ${username}`);
        setIsVideoPlaying(true);

        // Ensure video plays
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`Video playing for ${username}`);
            })
            .catch((error) => {
              console.log(`Video play failed for ${username}:`, error);
              setIsVideoPlaying(false);
            });
        }
      };

      const handleCanPlay = () => {
        if (video.paused) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.log(
                `Video play failed on canplay for ${username}:`,
                error
              );
            });
          }
        }
      };

      const handleError = (error) => {
        console.error(`Video error for ${username}:`, error);
        setIsVideoPlaying(false);
      };

      const handlePlay = () => {
        setIsVideoPlaying(true);
      };

      const handlePause = () => {
        setIsVideoPlaying(false);
      };

      // Add event listeners
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("error", handleError);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);

      // Clean up function
      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("error", handleError);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
      };
    } else {
      setIsStreamReady(false);
      setIsVideoPlaying(false);
      setHasVideoTrack(false);
    }
  }, [stream, videoRef, username, isLocal]);

  // Monitor video track changes
  useEffect(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();

      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        setHasVideoTrack(videoTrack.enabled);

        const handleTrackEnded = () => {
          console.log(`Video track ended for ${username}`);
          setIsVideoPlaying(false);
          setHasVideoTrack(false);
        };

        const handleTrackMute = () => {
          console.log(`Video track muted for ${username}`);
          setHasVideoTrack(false);
        };

        const handleTrackUnmute = () => {
          console.log(`Video track unmuted for ${username}`);
          setHasVideoTrack(true);
        };

        videoTrack.addEventListener("ended", handleTrackEnded);
        videoTrack.addEventListener("mute", handleTrackMute);
        videoTrack.addEventListener("unmute", handleTrackUnmute);

        return () => {
          videoTrack.removeEventListener("ended", handleTrackEnded);
          videoTrack.removeEventListener("mute", handleTrackMute);
          videoTrack.removeEventListener("unmute", handleTrackUnmute);
        };
      } else {
        setHasVideoTrack(false);
      }
    }
  }, [stream, username]);

  // For local video, use the ref passed from parent
  // For remote video, use our own ref
  const videoToUse = isLocal ? videoRef : videoElement;

  const shouldShowVideo =
    videoEnabled && stream && isStreamReady && hasVideoTrack;
  const showLoadingIndicator = !isLocal && (!stream || !isStreamReady);

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
          style={{
            transform: isLocal ? "scaleX(-1)" : "none", // Mirror local video
          }}
        />

        {!shouldShowVideo && !showLoadingIndicator && (
          <div className="video-off-indicator">
            <div className="avatar">{username.charAt(0).toUpperCase()}</div>
            {!videoEnabled && (
              <div className="connection-status">Camera off</div>
            )}
            {!hasVideoTrack && videoEnabled && (
              <div className="connection-status">No video signal</div>
            )}
          </div>
        )}

        {showLoadingIndicator && (
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

          {videoEnabled && hasVideoTrack ? (
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
