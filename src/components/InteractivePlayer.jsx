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

  function getSeekTime(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  }

  const pct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <div className="seekbar">
      <span className="seekbar__time">{formatTime(currentTime)}</span>
      <div
        ref={trackRef}
        className="seekbar__track"
        style={{ cursor: canSeek ? "pointer" : "default" }}
        onClick={canSeek ? (e) => onSeek(getSeekTime(e.clientX)) : undefined}
      >
        <div className="seekbar__fill" style={{ width: `${pct}%`, background: primaryColor }} />
        <div className="seekbar__thumb" style={{ left: `${pct}%`, background: primaryColor, opacity: canSeek ? 1 : 0 }} />
      </div>
      <span className="seekbar__time">{formatTime(duration)}</span>
    </div>
  );
}

export default function InteractivePlayer({ config }) {
  const videoRef = useRef(null);
  const [phase, setPhase] = useState("intro");
  const [currentId, setCurrentId] = useState("C01");
  const [queue, setQueue] = useState([]);
  const [started, setStarted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16/9");
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
    <div className="player" style={{ aspectRatio }}>
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

      {/* シークバー */}
      {started && (
        <SeekBar
          currentTime={playbackTime}
          duration={duration}
          onSeek={handleSeek}
          canSeek={!isDemo}
          primaryColor={config.theme.primary}
        />
      )}
    </div>
  );
}
