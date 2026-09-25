"use client";

import { useEffect, useState, useRef } from "react";

type Expression = "neutral" | "happy" | "curious" | "thinking" | "surprised" | "laughing";

interface RobotFaceProps {
  isSpeaking: boolean;
  expression?: Expression;
}

export default function RobotFace({
  isSpeaking,
  expression = "neutral",
}: RobotFaceProps) {
  const [blinkScale, setBlinkScale] = useState(1);
  const [mouthOpenness, setMouthOpenness] = useState(0);
  const [pupilPos, setPupilPos] = useState({ lx: 0, ly: 0, rx: 0, ry: 0 });
  const [antennaOn, setAntennaOn] = useState(true);

  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eyeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const antennaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Blink loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2200 + Math.random() * 4000;
      blinkTimerRef.current = setTimeout(() => {
        setBlinkScale(0);
        setTimeout(() => {
          setBlinkScale(1);
          scheduleBlink();
        }, 120);
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, []);

  // ── Mouth animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isSpeaking) {
      mouthIntervalRef.current = setInterval(() => {
        setMouthOpenness(0.15 + Math.random() * 0.85);
      }, 110 + Math.random() * 100);
    } else {
      if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);
      const fadeClose = () => {
        setMouthOpenness((prev) => {
          if (prev <= 0.02) return 0;
          setTimeout(fadeClose, 45);
          return prev * 0.65;
        });
      };
      fadeClose();
    }
    return () => {
      if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);
    };
  }, [isSpeaking]);

  // ── Eye wander ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const schedule = () => {
      eyeTimerRef.current = setTimeout(() => {
        const x = (Math.random() - 0.5) * 10;
        const y = (Math.random() - 0.5) * 7;
        setPupilPos({ lx: x, ly: y, rx: x, ry: y });
        schedule();
      }, 1400 + Math.random() * 2800);
    };
    schedule();
    return () => {
      if (eyeTimerRef.current) clearTimeout(eyeTimerRef.current);
    };
  }, []);

  // ── Antenna blink ────────────────────────────────────────────────────────────
  useEffect(() => {
    antennaIntervalRef.current = setInterval(
      () => setAntennaOn((p) => !p),
      900
    );
    return () => {
      if (antennaIntervalRef.current) clearInterval(antennaIntervalRef.current);
    };
  }, []);

  // ── Eyebrows per expression ──────────────────────────────────────────────────
  const renderEyebrows = () => {
    const style = {
      fill: "none" as const,
      stroke: "#8899aa",
      strokeWidth: 5,
      strokeLinecap: "round" as const,
    };
    switch (expression) {
      case "happy":
        return (
          <>
            <path d="M 102 128 Q 138 112 170 124" {...style} />
            <path d="M 230 124 Q 262 112 298 128" {...style} />
          </>
        );
      case "laughing":
        // Eyebrows shoot up high from the laughter
        return (
          <>
            <path d="M 98 112 Q 138 96 176 110" {...style} strokeWidth={6} />
            <path d="M 224 110 Q 262 96 302 112" {...style} strokeWidth={6} />
          </>
        );
      case "thinking":
        return (
          <>
            <path d="M 102 130 Q 138 120 170 126" {...style} />
            <path d="M 230 118 Q 262 105 298 118" {...style} strokeWidth={6} />
          </>
        );
      case "curious":
        return (
          <>
            <path d="M 104 128 Q 138 118 170 126" {...style} />
            <path d="M 230 116 Q 262 104 298 116" {...style} strokeWidth={6} />
          </>
        );
      case "surprised":
        return (
          <>
            <path d="M 104 114 Q 138 102 170 114" {...style} strokeWidth={6} />
            <path d="M 230 114 Q 262 102 298 114" {...style} strokeWidth={6} />
          </>
        );
      default:
        return null;
    }
  };

  // ── Mouth shape ──────────────────────────────────────────────────────────────
  const renderMouth = () => {
    // Laughing: wide open oval, bigger base even at rest
    if (expression === "laughing") {
      const rx = 36 + mouthOpenness * 20;
      const ry = 16 + mouthOpenness * 30;
      return (
        <ellipse
          cx="200"
          cy="306"
          rx={rx}
          ry={ry}
          fill="#3d4a5c"
          stroke="#7a8fa6"
          strokeWidth="2.5"
        />
      );
    }

    if (mouthOpenness < 0.08) {
      // Cute closed smile
      const smileD =
        expression === "happy"
          ? "M 158 296 Q 200 328 242 296"
          : "M 164 294 Q 200 318 236 294";
      return (
        <path
          d={smileD}
          fill="none"
          stroke="#7a8fa6"
          strokeWidth="4"
          strokeLinecap="round"
        />
      );
    }
    // Open oval when speaking
    const rx = 28 + mouthOpenness * 18;
    const ry = 6 + mouthOpenness * 26;
    return (
      <ellipse
        cx="200"
        cy="302"
        rx={rx}
        ry={ry}
        fill="#4a5568"
        stroke="#7a8fa6"
        strokeWidth="2.5"
      />
    );
  };

  return (
    <svg
      viewBox="0 0 400 420"
      className="w-full h-full"
      style={{ filter: "drop-shadow(0 8px 32px rgba(140,200,240,0.35))" }}
    >
      <defs>
        {/* Face gradient — soft sky blue */}
        <radialGradient id="faceGrad" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#e8f6ff" />
          <stop offset="100%" stopColor="#b8dcf5" />
        </radialGradient>

        {/* Pupil gradient */}
        <radialGradient id="pupilGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#2e3a4e" />
          <stop offset="100%" stopColor="#0c0f1a" />
        </radialGradient>

        {/* Cheek blur */}
        <filter id="cheekBlur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>

        {/* Subtle face shadow */}
        <filter id="faceShadow" x="-8%" y="-8%" width="116%" height="116%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#90c8e8" floodOpacity="0.45" />
        </filter>

        {/* Clip for eye blink — laughing uses narrow fixed height that still blinks */}
        <clipPath id="leftEyeClip">
          <ellipse cx="140" cy="193" rx="52" ry={expression === "laughing" ? 19 * blinkScale : 52 * blinkScale} />
        </clipPath>
        <clipPath id="rightEyeClip">
          <ellipse cx="260" cy="193" rx="52" ry={expression === "laughing" ? 19 * blinkScale : 52 * blinkScale} />
        </clipPath>
      </defs>

      {/* ── ANTENNA ──────────────────────────────────────────── */}
      <rect x="197" y="30" width="6" height="55" rx="3" fill="#a8cde0" />
      <circle
        cx="200"
        cy="24"
        r="13"
        fill={antennaOn ? "#ffb3c6" : "#f5d5de"}
        style={{ transition: "fill 0.3s" }}
      />
      <circle
        cx="200"
        cy="24"
        r="7"
        fill={antennaOn ? "#ff8fab" : "#f9bfce"}
        style={{ transition: "fill 0.3s" }}
      />
      {/* antenna shine */}
      <circle cx="196" cy="20" r="3" fill="white" opacity="0.6" />

      {/* ── HEAD ─────────────────────────────────────────────── */}
      <rect
        x="32"
        y="78"
        width="336"
        height="298"
        rx="60"
        fill="url(#faceGrad)"
        filter="url(#faceShadow)"
      />
      {/* subtle inner highlight at top */}
      <ellipse cx="200" cy="105" rx="100" ry="22" fill="white" opacity="0.25" />

      {/* ── TINY MEDICAL CROSS (cute, subtle) ───────────────── */}
      <rect x="195" y="88" width="10" height="28" rx="3" fill="#8ec8e8" opacity="0.6" />
      <rect x="190" y="95" width="20" height="10" rx="3" fill="#8ec8e8" opacity="0.6" />

      {/* ── EYEBROWS ─────────────────────────────────────────── */}
      {renderEyebrows()}

      {/* ── EYES (unified — clip handles laughing narrowness + blinking) ──── */}
      {/* Left Eye */}
      <g clipPath="url(#leftEyeClip)">
        <circle cx="140" cy="193" r="52" fill="white" />
        <circle cx={140 + pupilPos.lx} cy={193 + pupilPos.ly} r="36" fill="url(#pupilGrad)" />
        <circle cx={152 + pupilPos.lx * 0.4} cy={178 + pupilPos.ly * 0.4} r="13" fill="white" opacity="0.92" />
        <circle cx={160 + pupilPos.lx * 0.3} cy={197 + pupilPos.ly * 0.3} r="5" fill="white" opacity="0.45" />
      </g>

      {/* Right Eye */}
      <g clipPath="url(#rightEyeClip)">
        <circle cx="260" cy="193" r="52" fill="white" />
        <circle cx={260 + pupilPos.rx} cy={193 + pupilPos.ry} r="36" fill="url(#pupilGrad)" />
        <circle cx={272 + pupilPos.rx * 0.4} cy={178 + pupilPos.ry * 0.4} r="13" fill="white" opacity="0.92" />
        <circle cx={280 + pupilPos.rx * 0.3} cy={197 + pupilPos.ry * 0.3} r="5" fill="white" opacity="0.45" />
      </g>

      {/* Laughing: squinting upper-eyelid arcs drawn on top of the clipped eyes */}
      {expression === "laughing" && blinkScale > 0.15 && (
        <>
          {/* Left squinting lid */}
          <path d="M 90 184 Q 140 172 190 184" fill="none" stroke="#3d4f61" strokeWidth="9" strokeLinecap="round" />
          {/* Left lower-lid hint */}
          <path d="M 98 206 Q 140 214 182 206" fill="none" stroke="#7a8fa6" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          {/* Right squinting lid */}
          <path d="M 210 184 Q 260 172 310 184" fill="none" stroke="#3d4f61" strokeWidth="9" strokeLinecap="round" />
          {/* Right lower-lid hint */}
          <path d="M 218 206 Q 260 214 302 206" fill="none" stroke="#7a8fa6" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        </>
      )}

      {/* ── CHEEKS ───────────────────────────────────────────── */}
      {/* Left cheek — blurred base */}
      <ellipse
        cx="82"
        cy={expression === "laughing" ? 248 : 258}
        rx={expression === "laughing" ? 44 : 38}
        ry={expression === "laughing" ? 28 : 24}
        fill="#ffb3c6"
        opacity={expression === "laughing" ? 0.75 : 0.45}
        filter="url(#cheekBlur)"
      />
      {/* Left cheek — sharp top */}
      <ellipse
        cx="82"
        cy={expression === "laughing" ? 248 : 258}
        rx={expression === "laughing" ? 36 : 30}
        ry={expression === "laughing" ? 22 : 18}
        fill="#ffb3c6"
        opacity={expression === "laughing" ? 0.55 : 0.30}
      />

      {/* Right cheek — blurred base */}
      <ellipse
        cx="318"
        cy={expression === "laughing" ? 248 : 258}
        rx={expression === "laughing" ? 44 : 38}
        ry={expression === "laughing" ? 28 : 24}
        fill="#ffb3c6"
        opacity={expression === "laughing" ? 0.75 : 0.45}
        filter="url(#cheekBlur)"
      />
      {/* Right cheek — sharp top */}
      <ellipse
        cx="318"
        cy={expression === "laughing" ? 248 : 258}
        rx={expression === "laughing" ? 36 : 30}
        ry={expression === "laughing" ? 22 : 18}
        fill="#ffb3c6"
        opacity={expression === "laughing" ? 0.55 : 0.30}
      />

      {/* ── MOUTH ────────────────────────────────────────────── */}
      {renderMouth()}
    </svg>
  );
}
