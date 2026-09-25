"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient, CommandRow } from "@/lib/supabase";

const QUICK_COMMANDS = [
  "Olá a todos! Sejam muito bem-vindos a esta palestra!",
  "A inteligência artificial está revolucionando a medicina!",
  "Que plateia incrível! Estou feliz em estar aqui com vocês.",
  "Obrigada pela atenção! Continuaremos em breve.",
  "Alguém tem alguma pergunta? Estou aqui para ajudar!",
  "Sabia que a IA já auxilia no diagnóstico de mais de 30 tipos de câncer?",
  "O futuro da saúde começa hoje, com pessoas como vocês!",
  "Vou processar algumas informações. Aguardem um momento!",
];

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard state
  const [customText, setCustomText] = useState("");
  const [mode, setMode] = useState<"direct" | "ai">("direct");
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<CommandRow[]>([]);
  const [status, setStatus] = useState<"idle" | "speaking">("idle");

  // Auto-greet
  const [autoGreetOn, setAutoGreetOn] = useState(false);
  const [autoGreetInterval, setAutoGreetInterval] = useState(90);
  const autoGreetTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminVideoRef = useRef<HTMLVideoElement>(null);
  const adminStreamRef = useRef<MediaStream | null>(null);

  // Scheduled announcements
  const [scheduleText, setScheduleText] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // Toast notifications
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Check auth session on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsLoggedIn(true);
    });
  }, []);

  // Load command history
  const loadHistory = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("commands")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setHistory(data as CommandRow[]);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadHistory();

    // Subscribe for realtime history updates
    const supabase = createClient();
    const channel = supabase
      .channel("admin-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "commands" }, () => {
        loadHistory();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isLoggedIn, loadHistory]);

  // Admin camera for auto-greet
  const startAdminCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      adminStreamRef.current = stream;
      if (adminVideoRef.current) {
        adminVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn("Admin camera unavailable", e);
    }
  };

  const captureVideoFrame = (): string | null => {
    const video = adminVideoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const dataURL = canvas.toDataURL("image/jpeg", 0.7);
    return dataURL.replace(/^data:image\/jpeg;base64,/, "");
  };

  // Auto-greet effect
  useEffect(() => {
    if (autoGreetOn) {
      startAdminCamera();
      const doAutoGreet = async () => {
        const base64 = captureVideoFrame();
        if (!base64) return;
        try {
          const res = await fetch("/api/vision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64 }),
          });
          const { text } = await res.json();
          if (text) await insertCommand(text, "direct");
        } catch (e) {
          console.error("Auto-greet error:", e);
        }
      };

      autoGreetTimerRef.current = setInterval(doAutoGreet, autoGreetInterval * 1000);
      return () => {
        if (autoGreetTimerRef.current) clearInterval(autoGreetTimerRef.current);
      };
    } else {
      if (autoGreetTimerRef.current) clearInterval(autoGreetTimerRef.current);
      if (adminStreamRef.current) {
        adminStreamRef.current.getTracks().forEach((t) => t.stop());
        adminStreamRef.current = null;
      }
    }
  }, [autoGreetOn, autoGreetInterval]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError(error.message);
    } else {
      setIsLoggedIn(true);
    }
    setLoginLoading(false);
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  };

  const insertCommand = async (
    text: string,
    type: string = "direct"
  ) => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("commands").insert({
      text,
      type,
      expression: "happy",
      status: "pending",
    });
    if (error) {
      showToast("Erro ao enviar comando: " + error.message, "error");
    } else {
      showToast("Comando enviado!");
      loadHistory();
    }
  };

  const sendCustom = async () => {
    if (!customText.trim()) return;
    setIsSending(true);
    try {
      if (mode === "ai") {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction: customText }),
        });
        const { text } = await res.json();
        await insertCommand(text, "ai");
      } else {
        await insertCommand(customText, "direct");
      }
      setCustomText("");
    } catch (e) {
      showToast("Erro ao processar comando", "error");
    }
    setIsSending(false);
  };

  const sendCuriosidade = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction:
            "Compartilhe uma curiosidade fascinante e surpreendente sobre inteligência artificial aplicada à saúde ou medicina. Seja específica e crie impacto na audiência.",
        }),
      });
      const { text } = await res.json();
      await insertCommand(text, "ai");
    } catch (e) {
      showToast("Erro ao gerar curiosidade", "error");
    }
    setIsSending(false);
  };

  const sendPerguntaInterativa = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction:
            "Faça uma pergunta interativa e reflexiva para a audiência sobre IA na saúde. A pergunta deve provocar reflexão e engajar o público.",
        }),
      });
      const { text } = await res.json();
      await insertCommand(text, "ai");
    } catch (e) {
      showToast("Erro ao gerar pergunta", "error");
    }
    setIsSending(false);
  };

  const sendApresentarPalestrante = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction:
            "Faça uma apresentação entusiasmada do palestrante desta sessão sobre IA na saúde, destacando a importância do tema para o futuro da medicina.",
        }),
      });
      const { text } = await res.json();
      await insertCommand(text, "ai");
    } catch (e) {
      showToast("Erro", "error");
    }
    setIsSending(false);
  };

  const sendFimDePalestra = async () => {
    await insertCommand(
      "Chegamos ao fim desta incrível palestra sobre inteligência artificial na saúde! Foi uma honra compartilhar este momento com vocês. Continuem curiosos, continuem aprendendo, e lembrem-se: o futuro da medicina está sendo construído por pessoas como vocês. Muito obrigada!",
      "direct",
      "happy"
    );
  };

  const scheduleAnnouncement = () => {
    if (!scheduleText.trim() || !scheduleTime) {
      showToast("Preencha o texto e o horário", "error");
      return;
    }
    const target = new Date(scheduleTime);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) {
      showToast("O horário deve ser no futuro", "error");
      return;
    }
    setTimeout(() => {
      insertCommand(scheduleText, "scheduled");
    }, diff);
    showToast(`Anúncio agendado para ${target.toLocaleTimeString("pt-BR")}`);
    setScheduleText("");
    setScheduleTime("");
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  // ─── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #020a16, #030b18, #041020)" }}
      >
        <div className="w-full max-w-md px-6">
          <div className="text-center mb-10">
            <h1
              className="glow-text-cyan font-black tracking-widest mb-2"
              style={{ fontFamily: "var(--font-orbitron)", fontSize: "2.5rem", color: "#00d4ff" }}
            >
              ÍRIS
            </h1>
            <p style={{ color: "#00d4ff66", fontSize: "0.8rem", letterSpacing: "0.2em" }}>
              PAINEL DE CONTROLE
            </p>
          </div>

          <div className="admin-card p-8">
            <h2 className="text-white font-semibold text-xl mb-6 text-center">Acesso Restrito</h2>
            <form onSubmit={login} className="space-y-4">
              <div>
                <label className="block text-xs text-cyan-400/70 mb-2 tracking-wider">E-MAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-transparent text-white outline-none transition-all"
                  style={{
                    border: "1px solid rgba(0,212,255,0.3)",
                    background: "rgba(0,212,255,0.05)",
                    fontSize: "0.9rem",
                  }}
                  placeholder="admin@hospital.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-cyan-400/70 mb-2 tracking-wider">SENHA</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-white outline-none transition-all"
                  style={{
                    border: "1px solid rgba(0,212,255,0.3)",
                    background: "rgba(0,212,255,0.05)",
                    fontSize: "0.9rem",
                  }}
                  placeholder="••••••••"
                  required
                />
              </div>
              {loginError && (
                <p className="text-red-400 text-sm text-center">{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-lg font-bold tracking-wider transition-all mt-2"
                style={{
                  background: loginLoading
                    ? "rgba(0,212,255,0.1)"
                    : "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.08))",
                  border: "1.5px solid #00d4ff",
                  color: "#00d4ff",
                  fontFamily: "var(--font-orbitron)",
                  fontSize: "0.85rem",
                  cursor: loginLoading ? "not-allowed" : "pointer",
                  boxShadow: loginLoading ? "none" : "0 0 15px rgba(0,212,255,0.2)",
                }}
              >
                {loginLoading ? "ENTRANDO..." : "ENTRAR"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ──────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #020a16, #030b18 60%, #041020)" }}
    >
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-5 py-3 rounded-lg text-sm font-medium transition-all"
          style={{
            background: toast.type === "success" ? "rgba(0,230,118,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.type === "success" ? "rgba(0,230,118,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: toast.type === "success" ? "#00e676" : "#f87171",
            boxShadow: `0 0 20px ${toast.type === "success" ? "rgba(0,230,118,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── HEADER ────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(3,11,24,0.92)",
          borderBottom: "1px solid rgba(0,212,255,0.15)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-4">
          <h1
            className="font-black tracking-widest"
            style={{ fontFamily: "var(--font-orbitron)", color: "#00d4ff", fontSize: "1.4rem" }}
          >
            ÍRIS
          </h1>
          <div className="hidden sm:block" style={{ color: "#ffffff30", fontSize: "1rem" }}>|</div>
          <span className="hidden sm:block text-sm" style={{ color: "#ffffff50", letterSpacing: "0.1em" }}>
            Painel de Controle
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* ÍRIS status */}
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: "#00e676", boxShadow: "0 0 8px #00e676", animation: "led-pulse 2s ease-in-out infinite" }}
            />
            <span className="text-xs" style={{ color: "#00e676", fontFamily: "var(--font-orbitron)", letterSpacing: "0.1em" }}>
              ÍRIS ONLINE
            </span>
          </div>

          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={{
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171",
              background: "rgba(239,68,68,0.08)",
              cursor: "pointer",
            }}
          >
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── QUICK COMMANDS ─────────────────────── */}
        <section className="admin-card p-6">
          <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
            <span style={{ color: "#00d4ff" }}>⚡</span> Comandos Rápidos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_COMMANDS.map((cmd, i) => (
              <button
                key={i}
                className="quick-cmd-btn"
                onClick={() => insertCommand(cmd, "direct")}
                disabled={isSending}
              >
                {cmd}
              </button>
            ))}
          </div>
        </section>

        {/* ── CUSTOM SPEECH ──────────────────────── */}
        <section className="admin-card p-6">
          <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
            <span style={{ color: "#00d4ff" }}>🎙️</span> Fala Personalizada
          </h2>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={mode === "direct" ? "Digite o texto que ÍRIS vai falar..." : "Digite uma instrução para a IA gerar a fala de ÍRIS..."}
            rows={3}
            className="w-full px-4 py-3 rounded-lg text-white outline-none resize-none mb-4"
            style={{
              background: "rgba(0,212,255,0.04)",
              border: "1px solid rgba(0,212,255,0.2)",
              color: "#e2f8ff",
              fontSize: "0.9rem",
              lineHeight: "1.5",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendCustom();
            }}
          />
          <div className="flex items-center gap-3 flex-wrap">
            {/* Mode toggle */}
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: "1px solid rgba(0,212,255,0.2)" }}
            >
              {(["direct", "ai"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-4 py-2 text-sm transition-all"
                  style={{
                    background: mode === m ? "rgba(0,212,255,0.2)" : "transparent",
                    color: mode === m ? "#00d4ff" : "#ffffff50",
                    cursor: "pointer",
                    fontWeight: mode === m ? "600" : "400",
                    borderRight: m === "direct" ? "1px solid rgba(0,212,255,0.2)" : "none",
                  }}
                >
                  {m === "direct" ? "Modo Direto" : "Modo IA"}
                </button>
              ))}
            </div>

            <button
              onClick={sendCustom}
              disabled={isSending || !customText.trim()}
              className="px-6 py-2 rounded-lg font-semibold text-sm transition-all ml-auto"
              style={{
                background: isSending || !customText.trim()
                  ? "rgba(0,212,255,0.06)"
                  : "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,212,255,0.1))",
                border: "1.5px solid rgba(0,212,255,0.4)",
                color: isSending || !customText.trim() ? "#00d4ff55" : "#00d4ff",
                cursor: isSending || !customText.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isSending ? "Enviando..." : "Enviar →"}
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: "#ffffff30" }}>
            {mode === "direct" ? "Texto enviado diretamente para ÍRIS falar." : "IA irá gerar fala natural baseada na sua instrução."}
            {" "}Ctrl+Enter para enviar.
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── AUTO-GREET ──────────────────────────── */}
          <section className="admin-card p-6">
            <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
              <span style={{ color: "#00d4ff" }}>👁️</span> Saudação Automática
            </h2>

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-white">Auto-Greet</p>
                <p className="text-xs mt-0.5" style={{ color: "#ffffff40" }}>
                  ÍRIS observa a plateia e saúda automaticamente
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoGreetOn}
                  onChange={(e) => setAutoGreetOn(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs" style={{ color: "#00d4ff88" }}>
                  Intervalo: {autoGreetInterval}s
                </label>
                <span className="text-xs" style={{ color: "#ffffff30" }}>
                  ({Math.floor(autoGreetInterval / 60)}m {autoGreetInterval % 60}s)
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={300}
                step={15}
                value={autoGreetInterval}
                onChange={(e) => setAutoGreetInterval(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "#00d4ff" }}
              />
              <div className="flex justify-between text-xs mt-1" style={{ color: "#ffffff25" }}>
                <span>30s</span><span>5min</span>
              </div>
            </div>

            {autoGreetOn && (
              <div
                className="rounded-lg overflow-hidden"
                style={{
                  border: "1px solid rgba(0,212,255,0.3)",
                  background: "#000",
                  height: 100,
                }}
              >
                <video
                  ref={adminVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                />
              </div>
            )}

            {autoGreetOn && (
              <div className="flex items-center gap-2 mt-3">
                <div className="w-2 h-2 rounded-full" style={{ background: "#00e676", boxShadow: "0 0 6px #00e676", animation: "led-pulse 1s ease-in-out infinite" }} />
                <span className="text-xs" style={{ color: "#00e676" }}>Auto-greet ativo</span>
              </div>
            )}
          </section>

        </div>

        {/* ── FUNCIONALIDADES ────────────────────────── */}
        <section className="admin-card p-6">
          <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
            <span style={{ color: "#00d4ff" }}>🚀</span> Funcionalidades Especiais
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={sendCuriosidade}
              disabled={isSending}
              className="quick-cmd-btn flex flex-col items-start gap-2 p-4"
            >
              <span className="text-2xl">🧬</span>
              <span className="font-medium">Curiosidade</span>
              <span className="text-xs opacity-60">Fato sobre IA &amp; Saúde</span>
            </button>
            <button
              onClick={sendPerguntaInterativa}
              disabled={isSending}
              className="quick-cmd-btn flex flex-col items-start gap-2 p-4"
            >
              <span className="text-2xl">❓</span>
              <span className="font-medium">Pergunta Interativa</span>
              <span className="text-xs opacity-60">Engaja a plateia</span>
            </button>
            <button
              onClick={sendApresentarPalestrante}
              disabled={isSending}
              className="quick-cmd-btn flex flex-col items-start gap-2 p-4"
            >
              <span className="text-2xl">🎤</span>
              <span className="font-medium">Apresentar Palestrante</span>
              <span className="text-xs opacity-60">Introdução entusiasmada</span>
            </button>
            <button
              onClick={sendFimDePalestra}
              disabled={isSending}
              className="quick-cmd-btn flex flex-col items-start gap-2 p-4"
              style={{ borderColor: "rgba(0,230,118,0.3)" }}
            >
              <span className="text-2xl">🏁</span>
              <span className="font-medium">Fim de Palestra</span>
              <span className="text-xs opacity-60">Encerramento especial</span>
            </button>
          </div>
        </section>

        {/* ── ANÚNCIO PROGRAMADO ─────────────────────── */}
        <section className="admin-card p-6">
          <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
            <span style={{ color: "#00d4ff" }}>⏰</span> Anúncio Programado
          </h2>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={scheduleText}
              onChange={(e) => setScheduleText(e.target.value)}
              placeholder="Mensagem a ser anunciada..."
              className="flex-1 px-4 py-3 rounded-lg text-white outline-none"
              style={{
                background: "rgba(0,212,255,0.04)",
                border: "1px solid rgba(0,212,255,0.2)",
                color: "#e2f8ff",
                fontSize: "0.9rem",
              }}
            />
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="px-4 py-3 rounded-lg text-white outline-none"
              style={{
                background: "rgba(0,212,255,0.04)",
                border: "1px solid rgba(0,212,255,0.2)",
                color: "#e2f8ff",
                fontSize: "0.9rem",
                colorScheme: "dark",
              }}
            />
            <button
              onClick={scheduleAnnouncement}
              className="px-6 py-3 rounded-lg font-semibold text-sm transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.08))",
                border: "1.5px solid rgba(251,191,36,0.4)",
                color: "#fbbf24",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Agendar →
            </button>
          </div>
        </section>

        {/* ── HISTÓRICO ──────────────────────────────── */}
        <section className="admin-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <span style={{ color: "#00d4ff" }}>📋</span> Histórico de Comandos
            </h2>
            <button
              onClick={loadHistory}
              className="text-xs px-3 py-1 rounded-lg transition-all"
              style={{
                border: "1px solid rgba(0,212,255,0.2)",
                color: "#00d4ff88",
                cursor: "pointer",
              }}
            >
              Atualizar
            </button>
          </div>

          {history.length === 0 ? (
            <p className="text-center py-8" style={{ color: "#ffffff25", fontSize: "0.9rem" }}>
              Nenhum comando ainda. Envie a primeira mensagem!
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((cmd) => (
                <div
                  key={cmd.id}
                  className="flex items-start justify-between gap-4 px-4 py-3 rounded-lg"
                  style={{
                    background: "rgba(0,212,255,0.04)",
                    border: "1px solid rgba(0,212,255,0.1)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate"
                      style={{ color: "#e2f8ff" }}
                    >
                      {cmd.text}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: "#ffffff30" }}>
                        {formatTime(cmd.created_at)}
                      </span>
                      <span className="text-xs" style={{ color: "#ffffff25" }}>
                        {cmd.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`status-badge ${cmd.status === "done" ? "status-done" : "status-pending"}`}>
                      {cmd.status === "done" ? "✓ Concluído" : "⏳ Pendente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <div className="pb-8 text-center">
          <p className="text-xs" style={{ color: "#ffffff15" }}>
            ÍRIS — Inteligência Robótica em Saúde • Sistema de Controle v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
