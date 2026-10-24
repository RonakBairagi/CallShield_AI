import React, { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  analyser?: AnalyserNode | null;
  isActive: boolean;
  samples?: Float32Array | null;
  progressRatio?: number;
  alertLevel?: 'normal' | 'warning' | 'critical';
  height?: number;
  label?: string;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  analyser,
  isActive,
  samples,
  progressRatio = 0,
  alertLevel = 'normal',
  height = 128,
  label = 'Acoustic Waveform Display',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 640;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const strokeColor =
      alertLevel === 'critical'
        ? '#EF4444'
        : alertLevel === 'warning'
        ? '#F59E0B'
        : '#DC2626';

    const drawStaticOrSampleWave = (phaseOffset = 0) => {
      ctx.clearRect(0, 0, width, height);

      // Subtle forensic grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.moveTo(0, height * 0.25);
      ctx.lineTo(width, height * 0.25);
      ctx.moveTo(0, height * 0.75);
      ctx.lineTo(width, height * 0.75);
      ctx.stroke();

      const barCount = Math.floor(width / 5);
      const barWidth = 3;

      for (let i = 0; i < barCount; i++) {
        const ratio = i / barCount;
        let amp = 0.08;

        if (samples && samples.length > 0) {
          const sampleIdx = Math.min(
            samples.length - 1,
            Math.floor(ratio * samples.length)
          );
          // Compute local RMS around sampleIdx
          let sum = 0;
          const span = Math.max(1, Math.floor(samples.length / barCount));
          for (let j = 0; j < span && sampleIdx + j < samples.length; j += 4) {
            const s = samples[sampleIdx + j];
            sum += s * s;
          }
          amp = Math.min(0.92, Math.max(0.05, Math.sqrt(sum / (span / 4)) * 3.2));
        } else if (isActive) {
          amp =
            0.15 +
            0.45 * Math.abs(Math.sin(ratio * 14 + phaseOffset)) *
              Math.abs(Math.cos(ratio * 5 - phaseOffset * 0.6));
        } else {
          amp = 0.06 + 0.08 * Math.abs(Math.sin(ratio * 10));
        }

        const barHeight = Math.max(4, amp * (height - 20));
        const x = i * 5;
        const y = (height - barHeight) / 2;

        if (progressRatio > 0 && ratio <= progressRatio) {
          ctx.fillStyle = '#F87171';
        } else {
          ctx.fillStyle = isActive ? strokeColor : 'rgba(220, 38, 38, 0.42)';
        }
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      // Draw playhead if progressRatio > 0
      if (progressRatio > 0 && progressRatio <= 1) {
        const px = progressRatio * width;
        ctx.strokeStyle = '#F4F4F6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, 4);
        ctx.lineTo(px, height - 4);
        ctx.stroke();
      }
    };

    if (isActive && analyser) {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const renderLoop = () => {
        analyser.getByteTimeDomainData(dataArray);
        ctx.clearRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.strokeStyle = strokeColor;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        animRef.current = requestAnimationFrame(renderLoop);
      };

      renderLoop();
      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      };
    }

    if (isActive && !analyser) {
      let phase = 0;
      const interval = window.setInterval(() => {
        phase += 0.25;
        drawStaticOrSampleWave(phase);
      }, 80);
      drawStaticOrSampleWave(0);
      return () => window.clearInterval(interval);
    }

    drawStaticOrSampleWave(0);
  }, [analyser, isActive, samples, progressRatio, alertLevel, height]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-[#0D0F17] border border-neutral-800/90 p-3"
      data-testid="waveform-container"
      data-state={isActive ? 'active' : 'idle'}
    >
      <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {isActive ? '16.0 kHz · 16-bit PCM Mono' : 'Standby · Ready'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={label}
        style={{ height: `${height}px` }}
        className="w-full block"
      />
    </div>
  );
};
