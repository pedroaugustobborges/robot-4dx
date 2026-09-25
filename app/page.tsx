"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import RobotFace from "@/components/RobotFace";
import { createClient } from "@/lib/supabase";

type Expression = "neutral" | "happy" | "curious" | "thinking" | "surprised";

export default function RobotPage() {
  const [started, setStarted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [expression, setExpression] = useState<Expression>("neutral");
  const [subtitleText, setSubtitleText] = useState("");
  const [showCamera, setShowCamera] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakQueueRef = useRef<Array<{ text: string; id?: string }>>([]);
  const isPlayingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Camera — store stream in a ref so we can assign it once the video element is ready
  useEffect(() => {
    if (!started) return;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
      })
      .catch((err) => {
        console.warn("Camera not available:", err);
        setShowCamera(false);
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [started]);

  const processQueue = useCallback(async () => {
    if (isPlayingRef.current || speakQueueRef.current.length === 0) return;
    const item = speakQueueRef.current.shift();
    if (!item) return;
    await doSpeak(item.text, item.id);
  }, []);

  const doSpeak = async (text: string, commandId?: string) => {
    isPlayingRef.current = true;

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      // Only start mouth + subtitle when audio is actually ready to play
      setIsSpeaking(true);
      setSubtitleText(text);

      await audio.play();

      audio.onended = async () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
        setSubtitleText("");
        setExpression("neutral");
        isPlayingRef.current = false;

        if (commandId) {
          const supabase = createClient();
          await supabase
            .from("commands")
            .update({ status: "done" })
            .eq("id", commandId);
        }

        // Process next in queue
        processQueue();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
        setSubtitleText("");
        isPlayingRef.current = false;
        processQueue();
      };
    } catch (e) {
      console.error("Speak error:", e);
      setIsSpeaking(false);
      setSubtitleText("");
      isPlayingRef.current = false;
      processQueue();
    }
  };

  const speak = useCallback(
    (text: string, commandId?: string) => {
      if (isPlayingRef.current) {
        speakQueueRef.current.push({ text, id: commandId });
        return;
      }
      doSpeak(text, commandId);
    },
    [processQueue]
  );

  // Subscribe to Supabase Realtime
  useEffect(() => {
    if (!started) return;

    const supabase = createClient();
    const channel = supabase
      .channel("commands-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "commands",
        },
        async (payload) => {
          const command = payload.new as {
            id: string;
            text: string;
            expression?: Expression;
            type?: string;
          };

          if (command.expression) {
            setExpression(command.expression);
          } else {
            setExpression("happy");
          }

          speak(command.text, command.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [started, speak]);

  // Fullscreen detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const handleStart = () => {
    setStarted(true);
    // Warm up audio context
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    ctx.resume();
  };

  return (
    <main
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(135deg, #020a16 0%, #030b18 50%, #041020 100%)" }}
    >
      {/* ── PARTICLES ─────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className={`particle particle-${i + 1}`} />
        ))}
      </div>

      {/* ── SCANLINE OVERLAY ──────────────────────── */}
      <div className="scanline-overlay pointer-events-none" aria-hidden />

      {/* ── GRID BACKGROUND ───────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
        aria-hidden
      />

      {/* ── TOP BAR ───────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
        {/* Hospital logo area */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(0,230,118,0.15)",
              border: "1px solid rgba(0,230,118,0.4)",
            }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <rect x="10" y="4" width="4" height="16" rx="1" fill="#00e676" />
              <rect x="4" y="10" width="16" height="4" rx="1" fill="#00e676" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-green-400 leading-tight" style={{ fontFamily: "var(--font-orbitron)" }}>
              HOSPITAL
            </p>
            <p className="text-xs text-cyan-400/60 leading-tight">IA &amp; Saúde</p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-cyan-400/10"
            style={{ border: "1px solid rgba(0,212,255,0.25)", color: "#00d4ff" }}
            title={isFullscreen ? "Sair do fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── ROBOT CONTAINER ───────────────────────── */}
      <div className="relative flex flex-col items-center justify-center z-10" style={{ marginTop: "-2vh" }}>
        {/* Robot face */}
        <div
          className="robot-face-container"
          style={{
            width: "min(62vh, 460px)",
            height: "min(65vh, 490px)",
          }}
        >
          <RobotFace isSpeaking={isSpeaking} expression={expression} />
        </div>

        {/* Name */}
        <div className="mt-2 text-center">
          <h1
            className="glow-text-cyan tracking-widest font-black select-none"
            style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: "clamp(2rem, 6vw, 4rem)",
              color: "#00d4ff",
              letterSpacing: "0.3em",
            }}
          >
            ÍRIS
          </h1>
          <p
            className="text-cyan-400/60 tracking-wider mt-1 select-none"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "clamp(0.65rem, 1.8vw, 0.9rem)",
              letterSpacing: "0.2em",
            }}
          >
            Inteligência Robótica em Saúde
          </p>
        </div>
      </div>

      {/* ── SUBTITLE (what ÍRIS is saying) ────────── */}
      <div
        className="absolute bottom-24 left-1/2 z-10 text-center px-6"
        style={{
          transform: "translateX(-50%)",
          width: "min(90vw, 700px)",
          minHeight: "3rem",
        }}
      >
        {subtitleText && (
          <div
            className="subtitle-animate"
            style={{
              background: "rgba(3,11,24,0.85)",
              border: "1px solid rgba(0,212,255,0.35)",
              borderRadius: "12px",
              padding: "12px 24px",
              backdropFilter: "blur(8px)",
            }}
          >
            <p
              className="text-white leading-relaxed"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontSize: "clamp(0.85rem, 2.5vw, 1.1rem)",
                textShadow: "0 0 20px rgba(0,212,255,0.6)",
              }}
            >
              {subtitleText}
            </p>
          </div>
        )}
      </div>

      {/* ── CAMERA PREVIEW ────────────────────────── */}
      {started && (
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
          <button
            onClick={() => setShowCamera((v) => !v)}
            className="text-xs px-2 py-1 rounded transition-all"
            style={{
              background: "rgba(0,212,255,0.1)",
              border: "1px solid rgba(0,212,255,0.25)",
              color: "#00d4ff",
              fontSize: "0.7rem",
            }}
          >
            {showCamera ? "Ocultar câmera" : "Mostrar câmera"}
          </button>
          <div
            style={{
              width: 140,
              height: 105,
              borderRadius: 10,
              overflow: "hidden",
              border: "1.5px solid rgba(0,212,255,0.4)",
              background: "#000",
              boxShadow: "0 0 12px rgba(0,212,255,0.2)",
              display: showCamera ? "block" : "none",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onCanPlay={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
          </div>
        </div>
      )}

      {/* ── STATUS INDICATOR ──────────────────────── */}
      {started && (
        <div className="absolute bottom-6 left-6 z-10 flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isSpeaking ? "#00e676" : "#00d4ff",
              boxShadow: isSpeaking ? "0 0 8px #00e676" : "0 0 6px #00d4ff55",
              animation: isSpeaking ? "led-pulse 0.5s ease-in-out infinite" : "led-pulse 2s ease-in-out infinite",
            }}
          />
          <span
            className="text-xs"
            style={{ color: "#00d4ff88", fontFamily: "var(--font-orbitron)", fontSize: "0.65rem" }}
          >
            {isSpeaking ? "FALANDO" : "ONLINE"}
          </span>
        </div>
      )}

      {/* ── STARTUP OVERLAY ───────────────────────── */}
      {!started && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(3,11,24,0.95)", backdropFilter: "blur(4px)" }}
        >
          {/* Animated rings */}
          <div className="relative mb-10" style={{ width: 200, height: 200 }}>
            {[1, 0.7, 0.45].map((scale, i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full"
                style={{
                  border: `1px solid rgba(0,212,255,${0.3 - i * 0.08})`,
                  transform: `scale(${scale})`,
                  animation: `holo-ring ${3 + i * 1.5}s linear infinite`,
                  top: "50%",
                  left: "50%",
                  marginTop: -100,
                  marginLeft: -100,
                }}
              />
            ))}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 120, height: 120 }}
            >
              {/* Mini robot icon */}
              <svg viewBox="0 0 80 80" width="90" height="90" style={{ filter: "drop-shadow(0 0 15px #00d4ff)" }}>
                <rect x="20" y="22" width="40" height="40" rx="8" fill="#0c1e35" stroke="#00d4ff" strokeWidth="1.5" />
                <circle cx="30" cy="37" r="7" fill="#001828" stroke="#00d4ff" strokeWidth="1.5" />
                <circle cx="50" cy="37" r="7" fill="#001828" stroke="#00d4ff" strokeWidth="1.5" />
                <circle cx="30" cy="37" r="4" fill="#00d4ff" />
                <circle cx="50" cy="37" r="4" fill="#00d4ff" />
                <rect x="30" y="50" width="20" height="7" rx="3" fill="none" stroke="#00d4ff" strokeWidth="1.5" />
                <rect x="38" y="14" width="4" height="10" rx="2" fill="#00d4ff44" />
                <circle cx="40" cy="11" r="4" fill="#00d4ff" />
                <rect x="36" y="28" width="8" height="3" rx="1" fill="#00e676" />
                <rect x="38.5" y="25.5" width="3" height="8" rx="1" fill="#00e676" />
              </svg>
            </div>
          </div>

          <h1
            className="glow-text-cyan text-center font-black tracking-widest mb-3"
            style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
              color: "#00d4ff",
              letterSpacing: "0.35em",
            }}
          >
            ÍRIS
          </h1>
          <p
            className="text-center mb-2"
            style={{ color: "#00d4ff88", fontSize: "0.9rem", letterSpacing: "0.2em", fontFamily: "var(--font-space-grotesk)" }}
          >
            Inteligência Robótica em Saúde
          </p>
          <p
            className="text-center mb-12"
            style={{ color: "#ffffff44", fontSize: "0.75rem", letterSpacing: "0.1em" }}
          >
            Sistema de IA para palestra hospitalar
          </p>

          <button
            onClick={handleStart}
            className="group relative overflow-hidden transition-all duration-300"
            style={{
              padding: "16px 56px",
              borderRadius: "50px",
              background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))",
              border: "2px solid #00d4ff",
              color: "#00d4ff",
              fontFamily: "var(--font-orbitron)",
              fontSize: "1rem",
              fontWeight: "700",
              letterSpacing: "0.2em",
              cursor: "pointer",
              boxShadow: "0 0 20px rgba(0,212,255,0.3), inset 0 0 20px rgba(0,212,255,0.05)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 40px rgba(0,212,255,0.6), inset 0 0 30px rgba(0,212,255,0.15)";
              (e.currentTarget as HTMLButtonElement).style.background =
                "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,212,255,0.1))";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 20px rgba(0,212,255,0.3), inset 0 0 20px rgba(0,212,255,0.05)";
              (e.currentTarget as HTMLButtonElement).style.background =
                "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))";
            }}
          >
            ▶ INICIAR ÍRIS
          </button>

          <p className="mt-8 text-xs" style={{ color: "#ffffff22", letterSpacing: "0.1em" }}>
            Pressione para ativar o sistema de áudio
          </p>
        </div>
      )}
    </main>
  );
}
