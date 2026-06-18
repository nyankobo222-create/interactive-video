import { useState, useRef, useCallback, useEffect } from "react";
import BranchMenu from "./BranchMenu";
import BottomBar from "./BottomBar";
import DemoChapter from "./DemoChapter";
import VisualOverlay from "./VisualOverlay";
import { useAnalytics } from "../hooks/useAnalytics";
import "./InteractivePlayer.css";

function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInIframe() {
  try { return window.self !== window.top; }
  catch { return true; }
}

function SeekBar({ currentTime, duration, onSeek, canSeek, primaryColor }) {
  const trackRef = useRef();
  const dragging = useRef(false);

  function getSeekTime(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  }

  function onMouseDown(e) {
    if (!canSeek) return;
    dragging.current = true;
    onSeek(getSeekTime(e.clientX));
  }
  function onMouseMove(e) {
    if (!dragging.current) return;
    onSeek(getSeekTime(e.clientX));
  }
  function onMouseUp() { dragging.current = false; }

  function onTouchStart(e) {
    if (!canSeek) return;
    dragging.current = true;
    onSeek(getSeekTime(e.touches[0].clientX));
  }
  function onTouchMove(e) {
    if (!dragging.current) return;
    e.preventDefault();
    onSeek(getSeekTime(e.touches[0].clientX));
  }
  function onTouchEnd() { dragging.current = false; }

  const pct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <div
      className="seekbar"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <span className="seekbar__time">{formatTime(currentTime)}</span>
      <div
        ref={trackRef}
        className="seekbar__track"
        style={{ cursor: canSeek ? "pointer" : "default" }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="seekbar__fill" style={{ width: `${pct}%`, background: primaryColor }} />
        <div className="seekbar__thumb" style={{ left: `${pct}%`, background: primaryColor, opacity: canSeek ? 1 : 0 }} />
      </div>
      <span className="seekbar__time">{formatTime(duration)}</span>
    </div>
  );
}

function PlayPauseBtn({ isPlaying, onToggle, disabled }) {
  return (
    <button
      className="player__pp-btn"
      onClick={onToggle}
      disabled={disabled}
      title={isPlaying ? "一時停止" : "再生"}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        {isPlaying
          ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          : <path d="M8 5v14l11-7z"/>
        }
      </svg>
    </button>
  );
}

function FullscreenBtn({ playerRef, videoRef, isFakeFs, onEnterFakeFs, onExitFakeFs }) {
  const [isRealFs, setIsRealFs] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsRealFs(!!document.fullscreenElement || !!document.webkitFullscreenElement);
    }
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const isFs = isRealFs || isFakeFs;

  function toggle() {
    if (isRealFs) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else if (isFakeFs) {
      onExitFakeFs();
    } else if (isIOS()) {
      onEnterFakeFs();
    } else {
      const el = playerRef.current;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(onEnterFakeFs);
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else {
        onEnterFakeFs();
      }
    }
  }

  return (
    <button className="player__fs-btn" onClick={toggle} title={isFs ? "全画面解除" : "全画面"}>
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        {isFs
          ? <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
          : <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        }
      </svg>
    </button>
  );
}

export default function InteractivePlayer({ config }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [phase, setPhase] = useState("playing");
  const [currentId, setCurrentId] = useState("C01");
  const [started, setStarted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16/9");
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFakeFs, setIsFakeFs] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const { send, elapsed } = useAnalytics(config.id);
  const selectedBranchRef = useRef(null);

  const chaptersMap = Array.isArray(config.chapters)
    ? Object.fromEntries(config.chapters.map((c) => [c.id, c]))
    : config.chapters;

  const chapter = chaptersMap[currentId];
  const isDemo = !chapter?.url;

  useEffect(() => {
    setPlaybackTime(0);
    if (isDemo && chapter) setDuration(chapter.demoDuration ?? 0);
  }, [currentId]);

  function enterFakeFs() {
    window.scrollTo(0, 1);
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (isInIframe()) {
      window.parent.postMessage({ type: "iv-fullscreen-enter" }, "*");
    }
    setIsFakeFs(true);
  }

  function exitFakeFs() {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    if (isInIframe()) {
      window.parent.postMessage({ type: "iv-fullscreen-exit" }, "*");
    }
    setIsFakeFs(false);
  }

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  const switchChapter = useCallback((id) => {
    setCurrentId(id);
    const ch = chaptersMap[id];
    if (ch?.url && videoRef.current) {
      videoRef.current.src = ch.url;
      videoRef.current.play().catch(() => {});
    }
  }, [config]);

  function handleLoadedMetadata(e) {
    const { videoWidth, videoHeight, duration: dur } = e.target;
    if (videoWidth && videoHeight) setAspectRatio(`${videoWidth}/${videoHeight}`);
    if (dur) setDuration(dur);
  }

  function handleStart() {
    setStarted(true);
    send("play_start");

    if (isIOS()) {
      enterFakeFs();
    } else if (playerRef.current?.requestFullscreen) {
      playerRef.current.requestFullscreen().catch(() => {});
    } else if (playerRef.current?.webkitRequestFullscreen) {
      playerRef.current.webkitRequestFullscreen();
    }

    const ch = chaptersMap["C01"];
    if (ch?.url && videoRef.current) {
      videoRef.current.src = ch.url;
      videoRef.current.play().catch(() => {});
    }
  }

  useEffect(() => {
    const ch = chaptersMap["C01"];
    if (ch?.url && videoRef.current) {
      videoRef.current.src = ch.url;
    }
  }, [config]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener("play",  onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play",  onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  function handleTogglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else video.play().catch(() => {});
  }

  const handleTimeUpdate = useCallback((t) => {
    setPlaybackTime(t);
    const ch = chaptersMap[currentId];
    if (
      ch?.pauseAt != null &&
      ch.branches?.length > 0 &&
      phase === "playing" &&
      t >= ch.pauseAt
    ) {
      if (videoRef.current) videoRef.current.pause();
      setPhase("branch_select");
    }
  }, [currentId, phase, chaptersMap]);

  function handleSeek(t) {
    if (!isDemo && videoRef.current) {
      videoRef.current.currentTime = t;
      setPlaybackTime(t);
    }
  }

  const handleEnded = useCallback(() => {
    if (phase === "end_menu") return;

    const ch = chaptersMap[currentId];
    const nextId = ch?.nextChapterId;

    if (nextId === "__stop__") {
      return;
    }
    if (nextId && chaptersMap[nextId]) {
      if (ch?.nextChapterDelay > 0) {
        setCountdown({ seconds: ch.nextChapterDelay, targetId: nextId });
        return;
      }
      if (nextId === config.flow.endMenu) {
        send("end_reached", { branchId: selectedBranchRef.current?.id, totalTime: elapsed() });
        setPhase("end_menu");
      }
      switchChapter(nextId);
      return;
    }

    if (ch?.branches?.length > 0) {
      setPhase("branch_select");
      return;
    }

    send("end_reached", { branchId: selectedBranchRef.current?.id, totalTime: elapsed() });
    setPhase("end_menu");
    if (config.flow.endMenu) {
      switchChapter(config.flow.endMenu);
    }
  }, [currentId, phase, chaptersMap, config, switchChapter, send, elapsed]);

  const handleBranchSelect = useCallback((branch) => {
    setCountdown(null);
    selectedBranchRef.current = branch;
    send("branch_select", { branchId: branch.id, branchLabel: branch.label });
    if (!branch.nextChapterId || branch.nextChapterId === "__stop__") return;
    setPhase("playing");
    switchChapter(branch.nextChapterId);
  }, [switchChapter, send]);

  const handleGoTop = useCallback(() => {
    setCountdown(null);
    send("top_return");
    setPhase("playing");
    switchChapter("C01");
  }, [switchChapter, send]);

  useEffect(() => {
    if (!countdown) return;
    if (countdown.seconds <= 0) {
      const targetId = countdown.targetId;
      setCountdown(null);
      if (targetId === config.flow.endMenu) {
        send("end_reached", { branchId: selectedBranchRef.current?.id, totalTime: elapsed() });
        setPhase("end_menu");
      }
      switchChapter(targetId);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => prev ? { ...prev, seconds: prev.seconds - 1 } : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, config, switchChapter, send, elapsed]);

  // 現在チャプターのオーバーレイ・分岐
  const currentChapter = chaptersMap[currentId];
  const currentOverlay = currentChapter?.overlay;
  const currentBranches = currentChapter?.branches || [];
  // エンドメニューではC01の分岐を再表示
  const introBranches = chaptersMap["C01"]?.branches || [];

  return (
    <div
      ref={playerRef}
      className={`player${isFakeFs ? " player--fakescreen" : ""}`}
      style={isFakeFs ? undefined : { aspectRatio }}
    >
      {/* 動画レイヤー */}
      {isDemo ? (
        <DemoChapter
          key={currentId}
          id={currentId}
          chapter={chapter}
          config={config}
          isPaused={phase === "branch_select" || phase === "end_menu"}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
      ) : (
        <video
          ref={videoRef}
          className="player__video"
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(e) => handleTimeUpdate(e.target.currentTime)}
          onEnded={handleEnded}
        />
      )}

      {/* スタート画面 */}
      {!started && (
        <div className="player__start" onClick={handleStart}>
          <div className="player__start-btn">▶</div>
          <p className="player__start-label">タップして再生</p>
        </div>
      )}

      {/* showFromIntro: 再生中から表示するオーバーレイ */}
      {started && phase === "playing" &&
        currentOverlay?.showFromIntro &&
        currentOverlay?.imageUrl &&
        currentOverlay?.buttons?.length > 0 && (
          <VisualOverlay
            overlay={currentOverlay}
            branches={currentBranches}
            onBranchSelect={handleBranchSelect}
            onGoTop={handleGoTop}
          />
      )}

      {/* 分岐選択オーバーレイ */}
      {phase === "branch_select" && (
        currentOverlay?.imageUrl && currentOverlay?.buttons?.length > 0
          ? <VisualOverlay
              overlay={currentOverlay}
              branches={currentBranches}
              onBranchSelect={handleBranchSelect}
              onGoTop={handleGoTop}
            />
          : <BranchMenu
              config={config}
              branches={currentBranches}
              phase={phase}
              onBranchSelect={handleBranchSelect}
              onGoTop={handleGoTop}
            />
      )}

      {/* エンドメニュー */}
      {phase === "end_menu" && (
        config.endOverlay?.imageUrl && config.endOverlay?.buttons?.length > 0
          ? <VisualOverlay
              overlay={config.endOverlay}
              branches={introBranches}
              onBranchSelect={handleBranchSelect}
              onGoTop={handleGoTop}
            />
          : <BranchMenu
              config={config}
              branches={introBranches}
              phase={phase}
              onBranchSelect={handleBranchSelect}
              onGoTop={handleGoTop}
            />
      )}

      {/* カウントダウンオーバーレイ */}
      {countdown && (
        <div className="player__countdown">
          <span className="player__countdown__text">{countdown.seconds}秒後に次へ移動</span>
          <button className="player__countdown__cancel" onClick={() => setCountdown(null)}>キャンセル</button>
        </div>
      )}

      {/* コントロールバー */}
      {started && (
        <div className="player__controls">
          <PlayPauseBtn
            isPlaying={isPlaying}
            onToggle={handleTogglePlay}
            disabled={isDemo || phase === "branch_select" || phase === "end_menu"}
          />
          <SeekBar
            currentTime={playbackTime}
            duration={duration}
            onSeek={handleSeek}
            canSeek={!isDemo}
            primaryColor={config.theme.primary}
          />
          <FullscreenBtn
            playerRef={playerRef}
            videoRef={videoRef}
            isFakeFs={isFakeFs}
            onEnterFakeFs={enterFakeFs}
            onExitFakeFs={exitFakeFs}
          />
        </div>
      )}
    </div>
  );
}
