"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

export type SignaturePadHandle = {
  // 서명을 흰 배경 PNG 파일로 돌려줍니다. 아무것도 안 그렸으면 null.
  toFile: (filename: string) => Promise<File | null>;
  clear: () => void;
};

// 손가락/마우스로 서명하는 캔버스. 스크롤이 같이 움직이지 않도록 touch-action을 끕니다.
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (hasInk: boolean) => void }>(
  function SignaturePad({ onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    function setupCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
    }

    useEffect(() => {
      setupCanvas();
    }, []);

    function markInk(value: boolean) {
      setHasInk(value);
      onChange?.(value);
    }

    function point(e: React.PointerEvent<HTMLCanvasElement>) {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = point(e);
      const ctx = e.currentTarget.getContext("2d");
      if (ctx && last.current) {
        ctx.beginPath();
        ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "#0f172a";
        ctx.fill();
      }
      if (!hasInk) markInk(true);
    }

    function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current || !last.current) return;
      e.preventDefault();
      const p = point(e);
      const ctx = e.currentTarget.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
    }

    function handleUp() {
      drawing.current = false;
      last.current = null;
    }

    useImperativeHandle(ref, () => ({
      clear() {
        setupCanvas();
        markInk(false);
      },
      toFile(filename: string) {
        return new Promise<File | null>((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas || !hasInk) return resolve(null);
          canvas.toBlob((blob) => {
            resolve(blob ? new File([blob], filename, { type: "image/png" }) : null);
          }, "image/png");
        });
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={handleUp}
        className="h-36 w-full touch-none rounded-xl border border-slate-300 bg-white"
      />
    );
  }
);
