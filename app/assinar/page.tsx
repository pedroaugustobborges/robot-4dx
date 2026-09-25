"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import RobotFace from "@/components/RobotFace";
import { createClient } from "@/lib/supabase";

export default function AssinarPage() {
  const [name, setName] = useState("");
  const [step, setStep] = useState<"form" | "submitting" | "success">("form");
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // ── Init canvas with white background ───────────────────────────────────────
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // ── Coordinate helpers (mouse + touch) ──────────────────────────────────────
  const getPos = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // ── Drawing handlers ─────────────────────────────────────────────────────────
  const startDraw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a3e";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    if (!hasDrawn) setHasDrawn(true);
  };

  const stopDraw = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    initCanvas();
    setHasDrawn(false);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!name.trim() || !hasDrawn) return;
    setStep("submitting");

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export at canvas resolution as PNG
    const signatureData = canvas.toDataURL("image/png");

    const supabase = createClient();
    const { error } = await supabase.from("signatures").insert({
      name: name.trim(),
      signature_data: signatureData,
      displayed: false,
    });

    if (error) {
      console.error("Error saving signature:", error);
      setStep("form");
      return;
    }

    setStep("success");
  };

  // ── Reset for next person ────────────────────────────────────────────────────
  const handleReset = () => {
    setName("");
    setHasDrawn(false);
    setStep("form");
    // Re-init canvas after render
    setTimeout(initCanvas, 50);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // SUCCESS SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "success") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
        style={{
          background: "linear-gradient(160deg, #020a16 0%, #030b18 100%)",
        }}
      >
        {/* ÍRIS face */}
        <div style={{ width: 200, height: 210 }}>
          <RobotFace isSpeaking={false} expression="happy" />
        </div>

        {/* Thank-you message */}
        <div className="mt-6 text-center max-w-sm">
          <div
            className="text-4xl mb-4"
            style={{ filter: "drop-shadow(0 0 12px rgba(0,230,118,0.5))" }}
          >
            ✅
          </div>
          <h2
            className="font-bold text-white mb-3"
            style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: "1.6rem",
              color: "#00e676",
            }}
          >
            Muito obrigada, {name}!
          </h2>
          <p
            className="text-cyan-200 leading-relaxed mb-2"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "1.05rem",
            }}
          >
            Sua BELA assinatura foi registrada com sucesso!
          </p>
          <p
            className="text-cyan-400/70 leading-relaxed mb-8"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "0.95rem",
            }}
          >
            Por favor, procure um assento e aproveite a palestra. 😊
          </p>

          <button
            onClick={handleReset}
            className="px-8 py-4 rounded-2xl font-semibold text-white transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, #0d47a1, #1565c0)",
              border: "1px solid rgba(0,212,255,0.3)",
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "1rem",
              boxShadow: "0 4px 20px rgba(0,100,255,0.3)",
            }}
          >
            Próxima pessoa →
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FORM SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  const canSubmit = name.trim().length > 0 && hasDrawn && step === "form";

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-6"
      style={{
        background: "linear-gradient(160deg, #020a16 0%, #030b18 100%)",
      }}
    >
      {/* ── Header: ÍRIS face + welcome ───────────────── */}
      <div className="flex flex-col items-center mb-6">
        <div style={{ width: 160, height: 168 }}>
          <RobotFace isSpeaking={false} expression="happy" />
        </div>

        <div className="text-center mt-3">
          <h1
            className="font-black tracking-widest"
            style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: "1.6rem",
              color: "#00d4ff",
              letterSpacing: "0.25em",
            }}
          >
            ÍRIS
          </h1>
          <p
            className="mt-2 text-cyan-100 leading-snug"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "1rem",
            }}
          >
            Olá! Fico muito feliz em ter você aqui! 🤩
            <br />
            <span className="text-cyan-300/80 text-sm">
              Por favor, deixe seu nome e sua assinatura abaixo.
            </span>
          </p>
        </div>
      </div>

      {/* ── Form card ──────────────────────────────────── */}
      <div
        className="w-full max-w-lg rounded-3xl p-6 flex flex-col gap-5"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(0,212,255,0.2)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Name field */}
        <div>
          <label
            className="block text-cyan-300 text-sm font-semibold mb-2 tracking-wide"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            SEU NOME COMPLETO
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Digite seu nome aqui..."
            className="w-full rounded-xl px-4 py-4 text-white text-lg outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1.5px solid rgba(0,212,255,0.25)",
              fontFamily: "var(--font-space-grotesk)",
              caretColor: "#00d4ff",
            }}
            onFocus={(e) =>
              (e.target.style.border = "1.5px solid rgba(0,212,255,0.7)")
            }
            onBlur={(e) =>
              (e.target.style.border = "1.5px solid rgba(0,212,255,0.25)")
            }
          />
        </div>

        {/* Signature canvas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              className="text-cyan-300 text-sm font-semibold tracking-wide"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              SUA ASSINATURA
            </label>
            <button
              onClick={clearCanvas}
              className="text-xs px-3 py-1 rounded-lg transition-all active:scale-95"
              style={{
                background: "rgba(255,100,100,0.1)",
                border: "1px solid rgba(255,100,100,0.3)",
                color: "#ff8888",
                fontFamily: "var(--font-space-grotesk)",
              }}
            >
              ✕ Limpar
            </button>
          </div>

          <div
            className="rounded-2xl overflow-hidden relative"
            style={{
              border: hasDrawn
                ? "2px solid rgba(0,212,255,0.6)"
                : "2px dashed rgba(0,212,255,0.25)",
              boxShadow: hasDrawn ? "0 0 16px rgba(0,212,255,0.15)" : "none",
            }}
          >
            <canvas
              ref={canvasRef}
              width={700}
              height={220}
              className="w-full touch-none block"
              style={{ cursor: "crosshair", background: "#ffffff" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {!hasDrawn && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  color: "#aaaaaa",
                  fontFamily: "var(--font-space-grotesk)",
                }}
              >
                ✍️ Assine aqui com o dedo ou mouse
              </div>
            )}
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-5 rounded-2xl font-bold text-lg transition-all active:scale-95"
          style={{
            background: canSubmit
              ? "linear-gradient(135deg, #006633, #00a854)"
              : "rgba(255,255,255,0.05)",
            border: canSubmit
              ? "1px solid rgba(0,230,118,0.4)"
              : "1px solid rgba(255,255,255,0.1)",
            color: canSubmit ? "#ffffff" : "#555",
            fontFamily: "var(--font-space-grotesk)",
            boxShadow: canSubmit ? "0 4px 24px rgba(0,168,84,0.4)" : "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "all 0.2s ease",
          }}
        >
          {step === "submitting" ? "Registrando..." : "✅ Confirmar Assinatura"}
        </button>
      </div>

      {/* Footer */}
      <p
        className="mt-6 text-center text-cyan-400/40 text-xs"
        style={{ fontFamily: "var(--font-space-grotesk)" }}
      >
        ÍRIS · Inteligência Robótica em Saúde
      </p>
    </div>
  );
}
