import React, { useEffect, useRef, useState } from "react";

// Utility for "typed out" effect for the handle
function useTypedText(text, speed = 40) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    let timeout;
    function tick() {
      setShown(text.slice(0, i + 1));
      if (i < text.length - 1) {
        i += 1;
        timeout = setTimeout(tick, speed + Math.random() * speed * 0.5);
      }
    }
    tick();
    return () => timeout && clearTimeout(timeout);
  }, [text, speed]);
  return shown;
}

export default function WaterName() {
  const canvasRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Responsive resizing (optional for high DPI)
  useEffect(() => {
    function onResize() {
      if (!canvasRef.current) return;
      const parent = canvasRef.current.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      // Magic numbers for aspect ratio
      setDimensions({
        width: Math.max(300, rect.width),
        height: Math.max(100, Math.min(170, rect.width * 0.29)),
      });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Water animation logic
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    let frame = 0;
    let isFilling = true;
    let fillPercent = 0; // 0 = empty, 1 = full
    let draining = false;
    const durationFill = 2400; // ms
    const durationHold = 700;  // ms
    const durationDrain = 650; // ms

    // Used for timing
    let lastTime = null;
    let mode = "FILL"; // "FILL" → "HOLD" → "DRAIN" → repeat

    function drawTextMask(callback) {
      ctx.save();
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      ctx.font = `800 ${Math.floor(dimensions.height * 0.7)}px 'Syne', sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const text = "Water";
      // Draw full transparent outside, white inside text
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, dimensions.width, dimensions.height);
      ctx.closePath();
      ctx.clip();

      // HOLLOW OUTLINE effect
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(10,10,10,0.15)";
      ctx.lineWidth = 5;
      ctx.strokeText(text, dimensions.width / 2, dimensions.height * 0.59);

      // Setup mask
      ctx.globalCompositeOperation = "source-in";
      callback();
      ctx.restore();

      // Outline on top (visible after mask)
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(10,10,10,0.2)";
      ctx.lineWidth = 7;
      ctx.strokeText(text, dimensions.width / 2, dimensions.height * 0.59);
      ctx.restore();
    }

    function drawWater(percent) {
      // percent: 0 (empty) → 1 (full)
      const waveCount = 2; // fewer is bigger waves
      const waveHeight = dimensions.height * 0.12;
      const spacing = dimensions.width;
      const baseY = dimensions.height * (1 - percent) * 0.72 + dimensions.height * 0.16;
      ctx.save();
      // Animate a wavy blue path
      ctx.beginPath();
      ctx.moveTo(0, dimensions.height);
      for (let x = 0; x <= dimensions.width; x += 2) {
        const t = (x / spacing) * waveCount * Math.PI * 2 + frame * 0.05;
        const y = baseY + Math.sin(t) * waveHeight;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(dimensions.width, dimensions.height);
      ctx.lineTo(0, dimensions.height);
      ctx.closePath();
      ctx.fillStyle = "#0077B6";
      ctx.globalAlpha = 0.82;
      ctx.filter = "blur(0.7px)";
      ctx.shadowColor = "#0077B6";
      ctx.shadowBlur = 9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function animate(time) {
      if (!lastTime) lastTime = time;
      const dt = time - lastTime;
      lastTime = time;

      if (mode === "FILL") {
        fillPercent += dt / durationFill;
        if (fillPercent >= 1) {
          fillPercent = 1;
          mode = "HOLD";
        }
      } else if (mode === "HOLD") {
        fillPercent = 1;
        if (dt > durationHold) {
          mode = "DRAIN";
        }
      } else if (mode === "DRAIN") {
        fillPercent -= dt / durationDrain;
        if (fillPercent <= 0) {
          fillPercent = 0;
          mode = "FILL";
          lastTime = time; // Reset timebase for smooth animation loop
        }
      }

      drawTextMask(() => drawWater(Math.max(0, Math.min(1, fillPercent))));
      frame++;
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
    return () => {
      // No-op; removes the animation frame on unmount if needed
    };
    // eslint-disable-next-line
  }, [dimensions.width, dimensions.height]);

  // Typed handle effect
  const handle = useTypedText("@leahbluewater", 34);

  return (
    <div
      className="water-name-wrap"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "3.5rem",
        marginBottom: "2.25rem",
        width: "100%",
        maxWidth: 700,
      }}
    >
      <h1
        className="water-heading"
        style={{
          fontFamily: "Syne, sans-serif",
          fontWeight: 800,
          fontSize: "clamp(2.2rem, 6vw, 4.2rem)",
          lineHeight: 1.06,
          letterSpacing: "-0.022em",
          color: "#0a0a0a",
          margin: "0 0 0.25em 0",
          fontVariationSettings: "'wght' 800",
          display: "block",
          textAlign: "center",
          position: "relative"
        }}
      >
        Leah{" "}
        <span
          style={{
            display: "inline-block",
            verticalAlign: "bottom",
            position: "relative",
            width: dimensions.width,
            height: dimensions.height,
            minWidth: 210,
            minHeight: 64,
            maxWidth: "100%",
            pointerEvents: "none",
          }}
        >
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            style={{
              width: dimensions.width,
              height: dimensions.height,
              display: "block",
              verticalAlign: "bottom",
              background: "none",
            }}
            aria-label="Animated water fill effect on Water"
          />
        </span>
      </h1>
      <span
        className="water-handle-type"
        style={{
          fontFamily: "Space Mono, monospace",
          fontWeight: 400,
          color: "#555",
          fontSize: "clamp(1.05rem, 2.5vw, 1.35rem)",
          letterSpacing: "0.033em",
          marginTop: "0.25em",
          display: "block",
          minHeight: "1.2em",
          textAlign: "center"
        }}
        aria-label="@leahbluewater"
      >
        {handle}
      </span>
    </div>
  );
}
