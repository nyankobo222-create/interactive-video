import { useState, useRef, useCallback, useEffect } from "react";
import BranchMenu from "./BranchMenu";
import BottomBar from "./BottomBar";
import DemoChapter from "./DemoChapter";
import VisualOverlay from "./VisualOverlay";
import "./InteractivePlayer.css";

// phase の状態遷移:
// "intro"         C01再生中
// "branch_select" C01が15秒で停止、ブランチ選択オーバーレイ表示
// "branch_playing" 選択したブランチのチャプターを再生中、ボトムバー表示
// "end_menu"      C14に到達、エンドメニューオーバーレイ表示

function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
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

function requestFullscreen(el, videoEl) {
  if (el.requestFullscreen) {
    el.requestFullscreen();
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  } else if (videoEl && videoEl.webkitEnterFullscreen) {
    // iOS Safari: div全画面は不可なのでvideo要素のネイティブ全画面を使う
    videoEl.webkitEnterFullscreen();
  }
}

function FullscreenBtn({ playerRef, videoRef }) {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFs(!!document.fullscreenElement || !!document.webkitFullscreenElement);
    }
    // iOS Safari用: video要素のフルスクリーンイベント
    function onIosBegin() { setIsFs(true); }
    function onIosEnd()   { setIsFs(false); }

    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    const video = videoRef?.current;
    if (video) {
      video.addEventListener("webkitbeginfullscreen", onIosBegin);
      video.addEventListener("webkitendfullscreen",   onIosEnd);
    }
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      if (video) {
        video.removeEventListener("webkitbeginfullscreen", onIosBegin);
        video.removeEventListener("webkitendfullscreen",   onIosEnd);
      }
    };
  }, []);

  function toggle() {
    if (isFs) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (videoRef?.current?.webkitExitFullscreen) videoRef.current.webkitExitFullscreen();
    } else {
      requestFullscreen(playerRef.current, videoRef?.current);
    }
  }

  return (
    <button className="player__fs-btn" onClick={toggle} title={isFs ? "全画面解除" : "全画面"}>
      {isFs ? "⛶" : "⛶"}
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
  const [phase, setPhase] = useState("intro");
  const [currentId, setCurrentId] = useState("C01");
  const [queue, setQueue] = useState([]);
  const [started, setStarted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16/9");
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const chaptersMap = Array.isArray(config.chapters)
    ? Object.fromEntries(config.chapters.map((c) => [c.id, c]))
    : config.chapters;

  const chapter = chaptersMap[currentId];
  const isDemo = !chapter?.url;

  // チャプター切り替え時に時間をリセット
  useEffect(() => {
    setPlaybackTime(0);
    if (isDemo && chapter) setDuration(chapter.demoDuration ?? 0);
  }, [currentId]);

  const switchChapter = useCallback((id, nextQueue) => {
    setCurrentId(id);
    setQueue(nextQueue);
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
    if (playerRef.current) requestFullscreen(playerRef.current, videoRef.current);
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
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }

  const handleTimeUpdate = useCallback((t) => {
    setPlaybackTime(t);
    const { intro } = config.flow;
    if (currentId === intro.chapter && phase === "intro" && t >= intro.pauseAt) {
      if (videoRef.current) videoRef.current.pause();
      setPhase("branch_select");
    }
  }, [currentId, phase, config]);

  function handleSeek(t) {
    if (!isDemo && videoRef.current) {
      videoRef.current.currentTime = t;
      setPlaybackTime(t);
    }
  }

  const handleEnded = useCallback(() => {
    if (currentId === config.flow.intro.chapter && phase === "intro") {
      setPhase("branch_select");
      return;
    }
    if (phase === "end_menu") return;

    if (queue.length === 0) {
      setPhase("end_menu");
      switchChapter(config.flow.endMenu, []);
      return;
    }

    const [next, ...rest] = queue;
    if (next === config.flow.endMenu) {
      setPhase("end_menu");
      switchChapter(next, []);
    } else {
      switchChapter(next, rest);
    }
  }, [currentId, phase, queue, config, switchChapter]);

  const handleBranchSelect = useCallback((branch) => {
    const [first, ...rest] = branch.chapters;
    setPhase("branch_playing");
    switchChapter(first, [...rest, config.flow.endMenu]);
  }, [config, switchChapter]);

  const handleGoTop = useCallback(() => {
    setPhase("intro");
    switchChapter("C01", []);
  }, [switchChapter]);

  return (
    <div ref={playerRef} className="player" style={{ aspectRatio }}>
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

      {/* スタート画面（タップで再生） */}
      {!started && (
        <div className="player__start" onClick={handleStart}>
          <div className="player__start-btn">▶</div>
          <p className="player__start-label">タップして再生</p>
        </div>
      )}

      {/* ブランチ選択・再生中のオーバーレイ */}
      {config.overlay?.imageUrl && config.overlay?.buttons?.length > 0 ? (
        (phase === "branch_select" || phase === "branch_playing" ||
          (phase === "intro" && config.overlay?.showFromIntro)) && (
          <VisualOverlay config={config} onBranchSelect={handleBranchSelect} onGoTop={handleGoTop} />
        )
      ) : (
        <>
          {phase === "branch_select" && (
            <BranchMenu config={config} phase={phase} onBranchSelect={handleBranchSelect} onGoTop={handleGoTop} />
          )}
          {phase === "branch_playing" && (
            <BottomBar config={config} onBranchSelect={handleBranchSelect} />
          )}
        </>
      )}

      {/* エンドメニューのオーバーレイ */}
      {phase === "end_menu" && (
        config.endOverlay?.imageUrl && config.endOverlay?.buttons?.length > 0
          ? <VisualOverlay
              config={{ ...config, overlay: config.endOverlay }}
              onBranchSelect={handleBranchSelect}
              onGoTop={handleGoTop}
            />
          : <BranchMenu config={config} phase={phase} onBranchSelect={handleBranchSelect} onGoTop={handleGoTop} />
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
          <FullscreenBtn playerRef={playerRef} videoRef={videoRef} />
        </div>
      )}
    </div>
  );
}
