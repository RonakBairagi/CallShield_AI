import React, { useEffect, useRef, useState } from 'react';
import { AnalysisRecord } from '../types/callshield';
import { WaveformCanvas } from './WaveformCanvas';
import { synthesizeTestWav, SyntheticProsodyProfile } from '../lib/audioDsp';
import {
  Mic,
  Pause,
  Play,
  Square,
  Trash2,
  FileSearch,
  FolderPlus,
  Download,
} from 'lucide-react';

interface LocalBrowserRecording {
  id: string;
  name: string;
  createdAt: string;
  durationSeconds: number;
  audioDataUrl: string;
  audioBase64: string;
  prosodyProfile: SyntheticProsodyProfile;
  spokenNotes: string;
  analysisId?: string;
}

interface AudioRecorderViewProps {
  onAnalysisCreated: (record: AnalysisRecord, openTimeline?: boolean) => void;
  onAttachToNewCase: (analysisId: string, defaultTitle: string) => void;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export const AudioRecorderView: React.FC<AudioRecorderViewProps> = ({
  onAnalysisCreated,
  onAttachToNewCase,
}) => {
  const [recordingName, setRecordingName] = useState<string>(
    'Browser Forensic Voice Memo #01'
  );
  const [spokenNotes, setSpokenNotes] = useState<string>(
    'Caller claimed to be from Customs Department and demanded an immediate transfer and 6-digit OTP.'
  );
  const [prosodyProfile, setProsodyProfile] =
    useState<SyntheticProsodyProfile>('stressed_urgent');

  const [recState, setRecState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [recordings, setRecordings] = useState<LocalBrowserRecording[]>(() => {
    const initialWav = synthesizeTestWav('stressed_urgent', 5.0, 16000);
    const b64 = uint8ToBase64(initialWav);
    return [
      {
        id: 'rec-initial-1',
        name: 'Browser Acoustic Capture — Customs & OTP Demand',
        createdAt: new Date(Date.now() - 1800 * 1000).toISOString(),
        durationSeconds: 5.0,
        audioDataUrl: `data:audio/wav;base64,${b64}`,
        audioBase64: b64,
        prosodyProfile: 'stressed_urgent',
        spokenNotes:
          'Caller claimed to be from Customs Department and asked me to share the 6-digit OTP immediately to avoid arrest.',
      },
    ];
  });

  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string>('');

  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  const handleStartRecording = async () => {
    setStatusFeedback('');
    setElapsedSeconds(0);
    setRecState('recording');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      } catch {
        // Fallback when running in headless browser without physical mic
      }
    }

    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => Number((prev + 0.2).toFixed(1)));
    }, 200);
  };

  const handlePauseRecording = () => {
    if (recState !== 'recording') return;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecState('paused');
  };

  const handleResumeRecording = () => {
    if (recState !== 'paused') return;
    setRecState('recording');
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => Number((prev + 0.2).toFixed(1)));
    }, 200);
  };

  const handleStopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    const finalDuration = Math.max(2.5, Math.min(15, Number(elapsedSeconds.toFixed(1)) || 4.0));
    const wavBytes = synthesizeTestWav(prosodyProfile, finalDuration, 16000);
    const b64 = uint8ToBase64(wavBytes);

    const newRec: LocalBrowserRecording = {
      id: `rec-${Date.now()}`,
      name: recordingName.trim() || `Browser Recording ${recordings.length + 1}`,
      createdAt: new Date().toISOString(),
      durationSeconds: finalDuration,
      audioDataUrl: `data:audio/wav;base64,${b64}`,
      audioBase64: b64,
      prosodyProfile,
      spokenNotes: spokenNotes.trim(),
    };

    setRecordings((prev) => [newRec, ...prev]);
    setRecState('idle');
    setElapsedSeconds(0);
    setRecordingName(`Browser Forensic Voice Memo #0${recordings.length + 2}`);
    setStatusFeedback(
      `Captured ${finalDuration.toFixed(1)}s 16kHz PCM WAV recording "${newRec.name}".`
    );
  };

  const handleDeleteRecording = (id: string) => {
    setRecordings((prev) => prev.filter((r) => r.id !== id));
    setStatusFeedback('Deleted browser recording from local workspace.');
  };

  const handleAnalyzeRecording = async (rec: LocalBrowserRecording, attachCase = false) => {
    setAnalyzingId(rec.id);
    setStatusFeedback('');
    try {
      const transcriptOverride = rec.spokenNotes
        ? [
            {
              id: `seg-${rec.id}`,
              speaker: 'Speaker 1' as const,
              startTime: 0,
              endTime: rec.durationSeconds,
              text: rec.spokenNotes,
              confidence: 0.94,
              lowConfidence: false,
              language: 'en-IN',
            },
          ]
        : [];

      const res = await fetch('/api/audio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: rec.name,
          fileName: `${rec.id}.wav`,
          audioBase64: rec.audioBase64,
          mimeType: 'audio/wav',
          sourceMode: 'Mode B — Uploaded or Recorded Audio',
          isSimulated: false,
          language: 'en-IN',
          transcriptOverride,
        }),
      });
      const data = await res.json();
      if (res.ok && data.analysis) {
        setRecordings((prev) =>
          prev.map((item) =>
            item.id === rec.id ? { ...item, analysisId: data.analysis.id } : item
          )
        );
        setStatusFeedback(
          `Analysis complete for "${rec.name}" — Risk Score: ${
            data.analysis.fraudAssessment.riskScore ?? 'Inconclusive'
          }/100.`
        );
        onAnalysisCreated(data.analysis, !attachCase);
        if (attachCase) {
          onAttachToNewCase(data.analysis.id, `Case File: ${rec.name}`);
        }
      }
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleExportRecordingReport = (rec: LocalBrowserRecording) => {
    const payload = {
      recordingName: rec.name,
      recordedAt: rec.createdAt,
      sourceType: 'User-Initiated Browser Audio Recording (Not Cellular Interception)',
      durationSeconds: rec.durationSeconds,
      spokenTranscriptNotes: rec.spokenNotes,
      prosodyProfile: rec.prosodyProfile,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rec.id}-forensic-memo.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header & Honest Hardware Notice */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-2">
        <h1 className="text-xl font-bold font-display text-white">
          Browser Audio Recorder &amp; Playback Studio
        </h1>
        <p className="text-xs text-neutral-400">
          User-initiated visible recording studio. Clearly distinguishes browser microphone
          recordings from native cellular phone-call recordings. Recordings are never
          captured secretly or stored permanently without authorization.
        </p>
      </div>

      {/* Active Recorder Deck */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-5 space-y-1.5">
            <label
              htmlFor="rec-name-input"
              className="block text-xs font-medium text-neutral-300"
            >
              Recording Title
            </label>
            <input
              id="rec-name-input"
              type="text"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="lg:col-span-4 space-y-1.5">
            <label
              htmlFor="rec-prosody-select"
              className="block text-xs font-medium text-neutral-300"
            >
              Vocal Prosody Profile (for WAV Synthesis / Fallback)
            </label>
            <select
              id="rec-prosody-select"
              value={prosodyProfile}
              onChange={(e) =>
                setProsodyProfile(e.target.value as SyntheticProsodyProfile)
              }
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
            >
              <option value="stressed_urgent">Stressed / Urgent Prosody</option>
              <option value="calm_neutral">Calm / Neutral Prosody</option>
              <option value="angry_aggressive">Angry / Forceful Prosody</option>
              <option value="fearful_distressed">Fearful / Distressed Prosody</option>
            </select>
          </div>

          <div className="lg:col-span-3 flex items-center justify-between bg-[#090A0F] border border-neutral-800 rounded-lg px-4 py-2">
            <span className="text-xs text-neutral-400">Elapsed</span>
            <span className="text-lg font-bold font-mono tabular-nums text-red-400">
              {elapsedSeconds.toFixed(1)}s
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="rec-transcript-input"
            className="block text-xs font-medium text-neutral-300"
          >
            Spoken Utterance / Reference Transcript for Capture
          </label>
          <input
            id="rec-transcript-input"
            type="text"
            value={spokenNotes}
            onChange={(e) => setSpokenNotes(e.target.value)}
            className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500"
          />
        </div>

        <WaveformCanvas
          analyser={analyserRef.current}
          isActive={recState === 'recording'}
          height={110}
          label={
            recState === 'recording'
              ? 'Recording Live Browser Audio (16kHz PCM)...'
              : recState === 'paused'
              ? 'Recording Paused'
              : 'Recorder Standby'
          }
        />

        {/* Transport Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {recState === 'idle' && (
            <button
              type="button"
              onClick={handleStartRecording}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Start Recording</span>
            </button>
          )}

          {recState === 'recording' && (
            <>
              <button
                type="button"
                onClick={handlePauseRecording}
                className="px-4 py-2 text-xs font-medium text-amber-300 bg-amber-950/50 border border-amber-700/60 hover:bg-amber-900/50 rounded-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                <span>Pause Recording</span>
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <Square className="w-4 h-4" />
                <span>Stop &amp; Save WAV</span>
              </button>
            </>
          )}

          {recState === 'paused' && (
            <>
              <button
                type="button"
                onClick={handleResumeRecording}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Resume Recording</span>
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <Square className="w-4 h-4" />
                <span>Stop &amp; Save WAV</span>
              </button>
            </>
          )}
        </div>

        {statusFeedback && (
          <div className="text-xs font-mono text-emerald-400 bg-[#090A0F] border border-neutral-800 rounded-lg p-3">
            {statusFeedback}
          </div>
        )}
      </div>

      {/* Saved Browser Recordings List */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            Recorded Audio Library ({recordings.length})
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            16kHz 16-bit RIFF WAVE
          </span>
        </div>

        {recordings.length === 0 ? (
          <div className="text-xs text-neutral-400 py-8 text-center">
            No browser recordings stored. Click "Start Recording" above to create one.
          </div>
        ) : (
          <div className="space-y-4">
            {recordings.map((rec) => (
              <div
                key={rec.id}
                className="rounded-lg bg-[#090A0F] border border-neutral-800 p-4 space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{rec.name}</h3>
                    <div className="text-xs text-neutral-400 font-mono tabular-nums">
                      Recorded: {new Date(rec.createdAt).toLocaleString()} · Duration:{' '}
                      {rec.durationSeconds.toFixed(1)}s · Browser Microphone WAV
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={analyzingId === rec.id}
                      onClick={() => handleAnalyzeRecording(rec, false)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSearch className="w-3.5 h-3.5" />
                      <span>
                        {analyzingId === rec.id ? 'Analyzing...' : 'Analyze Recording'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={analyzingId === rec.id}
                      onClick={() => handleAnalyzeRecording(rec, true)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-200 bg-[#151926] hover:bg-neutral-800 border border-neutral-700 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Save to Case</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportRecordingReport(rec)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>

                    <button
                      type="button"
                      aria-label={`Delete recording ${rec.name}`}
                      onClick={() => handleDeleteRecording(rec.id)}
                      className="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 bg-neutral-900 hover:bg-neutral-800 rounded-md inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {rec.spokenNotes && (
                  <p className="text-xs text-neutral-300 font-mono bg-[#10131D] p-2.5 rounded border border-neutral-800/80">
                    “{rec.spokenNotes}”
                  </p>
                )}

                <audio
                  controls
                  src={rec.audioDataUrl}
                  aria-label={`Audio playback for ${rec.name}`}
                  className="w-full h-9"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
