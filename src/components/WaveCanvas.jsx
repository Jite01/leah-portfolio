import { useEffect, useRef } from "react";

export default function WaveCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animId;
    let t = 0;

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    // Each tongue: a foam sheet that slowly pushes right then recedes.
    // yFrac  — vertical position as fraction of canvas height
    // phase  — animation phase offset (radians), staggers tongues
    // speed  — cycle speed multiplier
    // reach  — max extension as fraction of canvas width
    const tongues = [
      { yFrac: 0.11, phase: 0.00, speed: 0.24, reach: 0.21 },
      { yFrac: 0.26, phase: 2.15, speed: 0.19, reach: 0.27 },
      { yFrac: 0.41, phase: 3.90, speed: 0.29, reach: 0.19 },
      { yFrac: 0.56, phase: 1.40, speed: 0.22, reach: 0.25 },
      { yFrac: 0.71, phase: 5.05, speed: 0.17, reach: 0.30 },
      { yFrac: 0.86, phase: 2.80, speed: 0.33, reach: 0.16 },
    ];

    // The waterline runs diagonally: ~27 % from left at top, ~39 % at bottom.
    // This matches the actual pixel geography of the hero image.
    function edgeX(yFrac, w) {
      return (0.27 + yFrac * 0.12) * w;
    }

    function drawTongue({ yFrac, phase, speed, reach }, t) {
      const w = canvas.width;
      const h = canvas.height;

      const cy  = yFrac * h;
      const ex  = edgeX(yFrac, w);

      // Normalised 0–1 sinusoidal cycle
      const cycle = (Math.sin(t * speed + phase) + 1) / 2;
      const len   = cycle * reach * w;
      const thick = h * (0.030 - cycle * 0.014);     // tapers as it extends
      const alpha = cycle * (1 - cycle * 0.45) * 0.22; // fades at peak & trough

      if (len < 3 || alpha < 0.004) return;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Tapered teardrop path pointing right
      ctx.beginPath();
      ctx.moveTo(ex, cy - thick);
      ctx.bezierCurveTo(
        ex + len * 0.33, cy - thick * 0.60,
        ex + len * 0.68, cy - thick * 0.17,
        ex + len,        cy
      );
      ctx.bezierCurveTo(
        ex + len * 0.68, cy + thick * 0.17,
        ex + len * 0.33, cy + thick * 0.60,
        ex,              cy + thick
      );
      ctx.closePath();

      // Gradient: opaque foam white → transparent sea-tinted
      const g = ctx.createLinearGradient(ex, 0, ex + len, 0);
      g.addColorStop(0.00, "rgba(255,255,255,0.94)");
      g.addColorStop(0.45, "rgba(232,250,255,0.52)");
      g.addColorStop(1.00, "rgba(210,245,255,0.00)");
      ctx.fillStyle = g;
      ctx.fill();

      ctx.restore();
    }

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tongues.forEach(tongue => drawTongue(tongue, t));
      t += 0.011;
      animId = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      "absolute",
        inset:         0,
        width:         "100%",
        height:        "100%",
        display:       "block",
        pointerEvents: "none",
      }}
    />
  );
}

