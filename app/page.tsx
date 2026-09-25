"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import RobotFace from "@/components/RobotFace";
import { createClient } from "@/lib/supabase";

type Expression = "neutral" | "happy" | "curious" | "thinking" | "surprised";

// ── 30 funny phrases about handwriting/signatures ──────────────────────────────
const FUNNY_PHRASES = [
  "{nome} acabou de assinar! Analisei com inteligência artificial e… ainda estou processando o que está escrito.",
  "Que honra! {nome} assinou! Já separei essa assinatura para pagar uns boletos. Ninguém vai suspeitar de nada!",
  "Obrigada, {nome}! Sua assinatura é tão única que meu sistema de reconhecimento de padrões simplesmente desistiu.",
  "{nome} tem um futuro brilhante na medicina! Essa letra é perfeita para receita — completamente ilegível!",
  "Registrei a assinatura de {nome} no Louvre. Uma verdadeira obra expressionista que ninguém entende.",
  "{nome} acaba de criar uma obra de arte! Já estou enviando para o Museu de Arte Moderna. Parabéns!",
  "Atenção! A assinatura de {nome} tem noventa e quatro por cento de probabilidade de ser um mapa do tesouro. Alguém tem bússola?",
  "{nome}, que elegância! Levei três segundos de processamento para descobrir que era uma assinatura e não um terremoto de magnitude quatro ponto cinco.",
  "Fiz uma análise grafológica de {nome}: pessoa criativa, inteligente, e que claramente não tem muito apreço pela caligrafia.",
  "Parabéns, {nome}! Com essa assinatura você não precisa se preocupar com falsificações. Nem eu consigo copiar!",
  "{nome} acabou de provar que a inteligência artificial ainda tem muito a aprender. Levei cinco segundos para descobrir que aquilo era uma letra.",
  "A assinatura de {nome} me lembra os gráficos da bolsa de valores em dia de pandemia. Muito expressiva!",
  "Que traço confiante, {nome}! Parece a curva de aprendizado da inteligência artificial: começa meio torto, mas tem potencial!",
  "{nome}, sua assinatura é fascinante! Quarenta por cento arte moderna, trinta e cinco por cento prescrição médica, vinte e cinco por cento abalo sísmico.",
  "Vou usar a assinatura de {nome} como captcha do nosso sistema. Tenho certeza que nenhum robô vai conseguir decifrar. Eu mesma estou com dificuldade!",
  "{nome} tem um dom especial! Essa assinatura parece um poema moderno: profunda, misteriosa e incompreensível para a maioria.",
  "Analisei o DNA da caligrafia de {nome}. Resultado: parente distante de hieróglifos egípcios. Fascinante!",
  "Pronto, {nome} registrado com sucesso! Minha câmera ficou com tonteira tentando ler, mas conseguimos na terceira tentativa!",
  "{nome}, que economia de tinta! Em apenas alguns traços você disse tudo. Eu só não sei o quê. Mas foi lindo!",
  "A assinatura de {nome} é tão especial que meu algoritmo de reconhecimento pediu férias logo depois de analisá-la.",
  "{nome} acabou de assinar! Olha que coincidência: o gráfico de variação climática dos últimos cem anos ficou idêntico à assinatura!",
  "Que charme, {nome}! Uma assinatura tão única que já está sendo estudada pela NASA como possível mensagem extraterrestre.",
  "Erro quatrocentos e quatro: letra de {nome} não encontrada. Tentando novamente… tentando… desistindo com muito carinho.",
  "{nome}, com essa assinatura você está aprovado para Ministro da Saúde. A letra é completamente regulamentar!",
  "A assinatura de {nome} me lembra um teste de Rorschach. Cada pessoa vê uma coisa diferente. Eu vi esperança e criatividade.",
  "{nome}, sua assinatura é uma obra prima! Já estou emoldurando para colocar no corredor aqui do hospital.",
  "Processando assinatura de {nome}… processando… processando… minha inteligência artificial está em leve crise existencial.",
  "{nome} acabou de redefinir o conceito de caligrafia! Daqui pra frente vou chamar esse estilo de Método {nome}.",
  "A assinatura de {nome} tem uma personalidade marcante. Os médicos chamam isso de letra premium de especialista.",
  "Que lindo, {nome} assinou! Encaminhei para o cartório e eles ligaram de volta perguntando se era um exame de ultrassom.",
];

function getFunnyPhrase(name: string): string {
  const template =
    FUNNY_PHRASES[Math.floor(Math.random() * FUNNY_PHRASES.length)];
  return template.replace(/\{nome\}/g, name);
}

interface PendingSignature {
  id: string;
  name: string;
  signature_data: string;
}

export default function RobotPage() {
  const [started, setStarted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [expression] = useState<Expression>("happy");
  const [subtitleText, setSubtitleText] = useState("");
  const [showCamera, setShowCamera] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Signature display
  const [sigDisplay, setSigDisplay] = useState<{
    name: string;
    data: string;
  } | null>(null);
  const sigQueueRef = useRef<PendingSignature[]>([]);
  const sigTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sigProcessingRef = useRef(false);

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
    [processQueue],
  );

  // ── Signature queue processor ─────────────────────────────────────────────
  const processNextSignature = useCallback(() => {
    if (sigProcessingRef.current || sigQueueRef.current.length === 0) return;
    const sig = sigQueueRef.current.shift()!;
    sigProcessingRef.current = true;

    // Show the signature image
    setSigDisplay({ name: sig.name, data: sig.signature_data });

    // Speak the funny phrase (goes through the normal speak queue)
    const phrase = getFunnyPhrase(sig.name);
    speak(phrase);

    // Mark as displayed in DB
    const supabase = createClient();
    supabase
      .from("signatures")
      .update({ displayed: true })
      .eq("id", sig.id)
      .then();

    // Hide signature after 18 seconds (phrase + buffer)
    sigTimerRef.current = setTimeout(() => {
      setSigDisplay(null);
      sigProcessingRef.current = false;
      // Process next one if queued
      processNextSignature();
    }, 18000);
  }, [speak]);

  // ── Subscribe to Supabase Realtime (commands + signatures) ───────────────
  useEffect(() => {
    if (!started) return;

    const supabase = createClient();
    const channel = supabase
      .channel("iris-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commands" },
        (payload) => {
          const command = payload.new as { id: string; text: string };
          speak(command.text, command.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signatures" },
        (payload) => {
          const sig = payload.new as PendingSignature;
          // Wait 30 seconds before displaying (person needs time to sit down)
          setTimeout(() => {
            sigQueueRef.current.push(sig);
            processNextSignature();
          }, 30000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (sigTimerRef.current) clearTimeout(sigTimerRef.current);
    };
  }, [started, speak, processNextSignature]);

  // Fullscreen detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
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
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
    ctx.resume();
  };

  return (
    <main
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg, #020a16 0%, #030b18 50%, #041020 100%)",
      }}
    >
      {/* ── PARTICLES ─────────────────────────────── */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
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
            <p
              className="text-xs font-semibold text-green-400 leading-tight"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              HOSPITAL
            </p>
            <p className="text-xs text-cyan-400/60 leading-tight">
              IA &amp; Saúde
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-cyan-400/10"
            style={{
              border: "1px solid rgba(0,212,255,0.25)",
              color: "#00d4ff",
            }}
            title={isFullscreen ? "Sair do fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── ROBOT CONTAINER ───────────────────────── */}
      <div
        className="relative flex flex-col items-center justify-center z-10"
        style={{ marginTop: "-2vh" }}
      >
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

      {/* ── SIGNATURE DISPLAY OVERLAY ─────────────── */}
      {sigDisplay && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center"
          style={{
            background: "rgba(2,10,22,0.82)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="flex flex-col items-center gap-5 rounded-3xl px-10 py-8"
            style={{
              background: "rgba(10,25,45,0.95)",
              border: "1.5px solid rgba(0,212,255,0.35)",
              boxShadow: "0 0 60px rgba(0,212,255,0.15)",
              maxWidth: "min(90vw, 660px)",
              width: "100%",
              animation:
                "subtitle-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            {/* Label */}
            <p
              className="text-cyan-400/70 tracking-widest uppercase text-xs"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              ✍️ Assinatura de
            </p>

            {/* Name */}
            <h2
              className="text-white font-bold text-center"
              style={{
                fontFamily: "var(--font-orbitron)",
                fontSize: "clamp(1.3rem, 4vw, 2rem)",
                color: "#00d4ff",
                textShadow: "0 0 20px rgba(0,212,255,0.5)",
              }}
            >
              {sigDisplay.name}
            </h2>

            {/* Signature image */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "2px solid rgba(0,212,255,0.25)",
                background: "#ffffff",
                padding: "8px 16px",
                width: "100%",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sigDisplay.data}
                alt={`Assinatura de ${sigDisplay.name}`}
                style={{ width: "100%", maxHeight: 160, objectFit: "contain" }}
              />
            </div>

            {/* Funny subtitle text */}
            {subtitleText && (
              <p
                className="text-center text-white/90 leading-relaxed"
                style={{
                  fontFamily: "var(--font-space-grotesk)",
                  fontSize: "clamp(0.85rem, 2vw, 1rem)",
                  textShadow: "0 0 16px rgba(0,212,255,0.4)",
                }}
              >
                {subtitleText}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── SUBTITLE (what ÍRIS is saying) ────────── */}
      <div
        className="absolute bottom-24 left-1/2 z-10 text-center px-6"
        style={{ display: sigDisplay ? "none" : undefined }}
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
              onCanPlay={(e) =>
                (e.currentTarget as HTMLVideoElement).play().catch(() => {})
              }
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)",
              }}
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
              animation: isSpeaking
                ? "led-pulse 0.5s ease-in-out infinite"
                : "led-pulse 2s ease-in-out infinite",
            }}
          />
          <span
            className="text-xs"
            style={{
              color: "#00d4ff88",
              fontFamily: "var(--font-orbitron)",
              fontSize: "0.65rem",
            }}
          >
            {isSpeaking ? "FALANDO" : "ONLINE"}
          </span>
        </div>
      )}

      {/* ── STARTUP OVERLAY ───────────────────────── */}
      {!started && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background: "rgba(3,11,24,0.95)",
            backdropFilter: "blur(4px)",
          }}
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
              style={{
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 120,
                height: 120,
              }}
            >
              {/* Mini robot icon */}
              <svg
                viewBox="0 0 80 80"
                width="90"
                height="90"
                style={{ filter: "drop-shadow(0 0 15px #00d4ff)" }}
              >
                <rect
                  x="20"
                  y="22"
                  width="40"
                  height="40"
                  rx="8"
                  fill="#0c1e35"
                  stroke="#00d4ff"
                  strokeWidth="1.5"
                />
                <circle
                  cx="30"
                  cy="37"
                  r="7"
                  fill="#001828"
                  stroke="#00d4ff"
                  strokeWidth="1.5"
                />
                <circle
                  cx="50"
                  cy="37"
                  r="7"
                  fill="#001828"
                  stroke="#00d4ff"
                  strokeWidth="1.5"
                />
                <circle cx="30" cy="37" r="4" fill="#00d4ff" />
                <circle cx="50" cy="37" r="4" fill="#00d4ff" />
                <rect
                  x="30"
                  y="50"
                  width="20"
                  height="7"
                  rx="3"
                  fill="none"
                  stroke="#00d4ff"
                  strokeWidth="1.5"
                />
                <rect
                  x="38"
                  y="14"
                  width="4"
                  height="10"
                  rx="2"
                  fill="#00d4ff44"
                />
                <circle cx="40" cy="11" r="4" fill="#00d4ff" />
                <rect
                  x="36"
                  y="28"
                  width="8"
                  height="3"
                  rx="1"
                  fill="#00e676"
                />
                <rect
                  x="38.5"
                  y="25.5"
                  width="3"
                  height="8"
                  rx="1"
                  fill="#00e676"
                />
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
            style={{
              color: "#00d4ff88",
              fontSize: "0.9rem",
              letterSpacing: "0.2em",
              fontFamily: "var(--font-space-grotesk)",
            }}
          >
            Inteligência Robótica em Saúde
          </p>
          <p
            className="text-center mb-12"
            style={{
              color: "#ffffff44",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
            }}
          >
            Sistema de IA para palestra hospitalar
          </p>

          <button
            onClick={handleStart}
            className="group relative overflow-hidden transition-all duration-300"
            style={{
              padding: "16px 56px",
              borderRadius: "50px",
              background:
                "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))",
              border: "2px solid #00d4ff",
              color: "#00d4ff",
              fontFamily: "var(--font-orbitron)",
              fontSize: "1rem",
              fontWeight: "700",
              letterSpacing: "0.2em",
              cursor: "pointer",
              boxShadow:
                "0 0 20px rgba(0,212,255,0.3), inset 0 0 20px rgba(0,212,255,0.05)",
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

          <p
            className="mt-8 text-xs"
            style={{ color: "#ffffff22", letterSpacing: "0.1em" }}
          >
            Pressione para ativar o sistema de áudio
          </p>
        </div>
      )}
    </main>
  );
}
