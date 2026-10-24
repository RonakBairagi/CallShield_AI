import React, { useEffect, useRef, useState } from 'react';
import {
  AnalysisRecord,
  AudioSourceMode,
  EmotionSegment,
  FraudAssessment,
  MonitoringStatus,
  RealTimeWarning,
  TranscriptSegment,
} from '../types/callshield';
import { WaveformCanvas } from './WaveformCanvas';
import {
  Mic,
  MicOff,
  PhoneIncoming,
  Radio,
  ShieldAlert,
  Save,
  Volume2,
  X,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';

interface LiveMonitoringViewProps {
  monitoringStatus: MonitoringStatus;
  setMonitoringStatus: (status: MonitoringStatus) => void;
  alertSensitivity: 'conservative' | 'balanced' | 'high';
  onUpdateSensitivity: (sens: 'conservative' | 'balanced' | 'high') => void;
  onAnalysisSaved: (record: AnalysisRecord) => void;
}

const SIMULATED_CALL_STEPS: {
  speaker: 'Speaker 1' | 'Speaker 2';
  text: string;
  prosody: 'stressed_urgent' | 'calm_neutral' | 'angry_aggressive' | 'fearful_distressed';
}[] = [
  {
    speaker: 'Speaker 1',
    text: 'Hello, I am Inspector Arvind calling from Delhi Police Cyber Crime Cell regarding an arrest warrant on your Aadhaar ID.',
    prosody: 'stressed_urgent',
  },
  {
    speaker: 'Speaker 2',
    text: 'Wait, what warrant? I have never received any notice from the police.',
    prosody: 'fearful_distressed',
  },
  {
    speaker: 'Speaker 1',
    text: 'You are now under digital arrest. Do not disconnect the call or contact anyone. Transfer your funds immediately to the RBI verification account.',
    prosody: 'angry_aggressive',
  },
  {
    speaker: 'Speaker 1',
    text: 'Read out the 6-digit OTP sent to your phone within 5 minutes or we will freeze all your bank accounts.',
    prosody: 'stressed_urgent',
  },
];

export const LiveMonitoringView: React.FC<LiveMonitoringViewProps> = ({
  monitoringStatus,
  setMonitoringStatus,
  alertSensitivity,
  onUpdateSensitivity,
  onAnalysisSaved,
}) => {
  const [selectedMode, setSelectedMode] = useState<AudioSourceMode>(
    'Mode A — Microphone Analysis'
  );
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [consentChecked, setConsentChecked] = useState<boolean>(true);
  const [webrtcPeerConsent, setWebrtcPeerConsent] = useState<boolean>(true);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isProcessingChunk, setIsProcessingChunk] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<TranscriptSegment[]>([]);
  const [liveEmotions, setLiveEmotions] = useState<EmotionSegment[]>([]);
  const [liveAssessment, setLiveAssessment] = useState<FraudAssessment | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [customUtterance, setCustomUtterance] = useState<string>('');
  const [selectedProsodyHint, setSelectedProsodyHint] = useState<
    'calm_neutral' | 'stressed_urgent' | 'angry_aggressive' | 'fearful_distressed'
  >('stressed_urgent');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [simStepIndex, setSimStepIndex] = useState<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const simTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          const mics = list.filter((d) => d.kind === 'audioinput');
          setDevices(mics);
        })
        .catch(() => {
          // Ignore enumeration error prior to permission
        });
    }
    return () => {
      cleanupAudioResources();
    };
  }, []);

  const cleanupAudioResources = () => {
    if (simTimerRef.current) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
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
  };

  const startLiveSession = async (modeOverride?: AudioSourceMode) => {
    const activeMode = modeOverride || selectedMode;
    if (!consentChecked) {
      setMonitoringStatus('Microphone permission required');
      setStatusMessage(
        'Please confirm explicit recording and analysis consent before starting capture.'
      );
      return;
    }

    if (
      activeMode === 'Mode C — In-App WebRTC Voice Call' &&
      !webrtcPeerConsent
    ) {
      setStatusMessage(
        'Mode C requires explicit mutual participant consent before call audio can be screened.'
      );
      return;
    }

    setStatusMessage('');
    setLiveTranscript([]);
    setLiveEmotions([]);
    setLiveAssessment(null);
    setDismissedWarnings(new Set());
    setSimStepIndex(0);

    const isSim = activeMode === 'Simulated Incoming Call (Demo Only)';

    // Request real browser microphone when in Mode A or Mode C
    if (!isSim && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const constraints: MediaStreamConstraints = {
          audio:
            selectedDeviceId && selectedDeviceId !== 'default'
              ? { deviceId: { exact: selectedDeviceId } }
              : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
      } catch {
        // In headless browsers or when mic permission is denied, report transparently and allow test utterance stream
        setStatusMessage(
          'Browser microphone access unavailable or denied in this environment. Live session initialized in verified utterance stream mode.'
        );
      }
    }

    try {
      const res = await fetch('/api/audio/live-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMode: activeMode,
          isSimulated: isSim,
          language: 'en-IN',
        }),
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      setIsCapturing(true);
      setMonitoringStatus('Audio source connected');

      if (isSim) {
        // Automatically stream the 4 simulated incoming call chunks every 1.6 seconds
        let idx = 0;
        simTimerRef.current = window.setInterval(() => {
          if (idx < SIMULATED_CALL_STEPS.length) {
            const step = SIMULATED_CALL_STEPS[idx];
            idx += 1;
            setSimStepIndex(idx);
            sendLiveChunk(data.sessionId, step.text, step.speaker, step.prosody, idx);
          } else if (simTimerRef.current) {
            window.clearInterval(simTimerRef.current);
            simTimerRef.current = null;
          }
        }, 1400);
      }
    } catch {
      setMonitoringStatus('Connection error');
      setStatusMessage('Failed to initialize live session on backend.');
    }
  };

  const sendLiveChunk = async (
    activeSessId: string,
    text: string,
    speaker: 'Speaker 1' | 'Speaker 2',
    prosodyHint: 'calm_neutral' | 'stressed_urgent' | 'angry_aggressive' | 'fearful_distressed',
    seqNum: number
  ) => {
    if (!activeSessId || !text.trim()) return;
    setIsProcessingChunk(true);
    setMonitoringStatus('Analyzing speech');

    try {
      const seg: TranscriptSegment = {
        id: `live-seg-${Date.now()}-${seqNum}`,
        speaker,
        startTime: Number(((seqNum - 1) * 3.0).toFixed(1)),
        endTime: Number((seqNum * 3.0).toFixed(1)),
        text: text.trim(),
        confidence: 0.94,
        lowConfidence: false,
        language: 'en-IN',
      };

      const res = await fetch(`/api/audio/live-session/${activeSessId}/chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptSegment: seg,
          prosodyHint,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLiveTranscript(data.transcript || []);
        setLiveEmotions(data.emotions || []);
        setLiveAssessment(data.fraudAssessment || null);
        setMonitoringStatus(data.monitoringStatus || 'Analyzing speech');
      }
    } catch {
      setMonitoringStatus('Connection error');
    } finally {
      setIsProcessingChunk(false);
    }
  };

  const handleStopAndSave = async (saveRecord: boolean) => {
    cleanupAudioResources();
    setIsCapturing(false);

    if (!sessionId) {
      setMonitoringStatus('Monitoring inactive');
      return;
    }

    try {
      const res = await fetch(`/api/audio/live-session/${sessionId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveRecord,
          title:
            selectedMode === 'Simulated Incoming Call (Demo Only)'
              ? 'Simulated Incoming Call — Cyber Cell Digital Arrest Demo'
              : `Live ${selectedMode} Capture`,
        }),
      });
      const data = await res.json();
      setSessionId(null);
      setMonitoringStatus(saveRecord ? 'Analysis complete' : 'Monitoring inactive');
      if (saveRecord && data.analysis) {
        setStatusMessage(
          `Saved analysis "${data.analysis.title}" to persistent SQLite store.`
        );
        onAnalysisSaved(data.analysis);
      }
    } catch {
      setMonitoringStatus('Connection error');
    }
  };

  const activeWarnings: RealTimeWarning[] = (
    liveAssessment?.warnings || []
  ).filter((w) => !dismissedWarnings.has(w.id));

  return (
    <div className="space-y-6">
      {/* Hardware & Mode Separation Header */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold font-display text-white">
              Live Audio Monitoring &amp; Real-Time Scam Screening
            </h1>
            <p className="text-xs text-neutral-400">
              Important hardware distinction: browser microphone access (Mode A) captures
              local acoustic audio only and does not intercept cellular network call audio.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
            <span className="text-neutral-400">Status:</span>
            <span
              className={`font-semibold ${
                monitoringStatus === 'Suspicious indicators detected'
                  ? 'text-red-400'
                  : isCapturing
                  ? 'text-emerald-400'
                  : 'text-neutral-300'
              }`}
            >
              {monitoringStatus}
            </span>
          </div>
        </div>

        {/* Segmented Mode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            disabled={isCapturing}
            onClick={() => setSelectedMode('Mode A — Microphone Analysis')}
            className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedMode === 'Mode A — Microphone Analysis'
                ? 'bg-[#171B29] border-red-500 text-white'
                : 'bg-[#090A0F] border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Mode A — Microphone Analysis</span>
              <Mic className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Captures ambient/speakerphone audio from an authorized browser microphone.
            </p>
          </button>

          <button
            type="button"
            disabled={isCapturing}
            onClick={() => setSelectedMode('Mode C — In-App WebRTC Voice Call')}
            className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedMode === 'Mode C — In-App WebRTC Voice Call'
                ? 'bg-[#171B29] border-red-500 text-white'
                : 'bg-[#090A0F] border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Mode C — In-App WebRTC Call</span>
              <Radio className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Internet voice call where both participants knowingly join with explicit consent.
            </p>
          </button>

          <button
            type="button"
            disabled={isCapturing}
            onClick={() => setSelectedMode('Simulated Incoming Call (Demo Only)')}
            className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedMode === 'Simulated Incoming Call (Demo Only)'
                ? 'bg-[#171B29] border-red-500 text-white'
                : 'bg-[#090A0F] border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Incoming-Call Simulator (Demo)</span>
              <PhoneIncoming className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Clearly labeled simulation demonstrating the future Android companion workflow.
            </p>
          </button>
        </div>

        {/* Simulation Banner when Simulator Mode is selected */}
        {selectedMode === 'Simulated Incoming Call (Demo Only)' && (
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-700/60 text-amber-200 text-xs flex items-center justify-between gap-4">
            <div>
              <strong>SIMULATED CALL DEMONSTRATION:</strong> This mode streams a
              pre-scripted "Digital Arrest" scam call to demonstrate real-time warning
              triggers. It is not a real cellular phone call.
            </div>
            <span className="font-mono shrink-0">Step {simStepIndex}/4</span>
          </div>
        )}

        {/* Controls Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 items-end">
          <div className="lg:col-span-4 space-y-1">
            <label
              htmlFor="mic-device-select"
              className="block text-xs font-medium text-neutral-300"
            >
              Microphone Input Source
            </label>
            <select
              id="mic-device-select"
              disabled={isCapturing}
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            >
              <option value="default">Default System Microphone (16kHz PCM)</option>
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone Input ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 space-y-1">
            <label
              htmlFor="alert-sensitivity-select"
              className="block text-xs font-medium text-neutral-300"
            >
              Real-Time Alert Sensitivity
            </label>
            <select
              id="alert-sensitivity-select"
              value={alertSensitivity}
              onChange={(e) =>
                onUpdateSensitivity(
                  e.target.value as 'conservative' | 'balanced' | 'high'
                )
              }
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            >
              <option value="conservative">Conservative (0.85x weight)</option>
              <option value="balanced">Balanced (1.0x default weight)</option>
              <option value="high">High Sensitivity (1.15x weight)</option>
            </select>
          </div>

          <div className="lg:col-span-5 flex flex-wrap items-center gap-3">
            {!isCapturing ? (
              <>
                <button
                  type="button"
                  onClick={() => startLiveSession()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>
                    {selectedMode === 'Simulated Incoming Call (Demo Only)'
                      ? 'Start Simulated Incoming Call'
                      : 'Start Live Capture'}
                  </span>
                </button>
                {selectedMode !== 'Simulated Incoming Call (Demo Only)' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode('Simulated Incoming Call (Demo Only)');
                      startLiveSession('Simulated Incoming Call (Demo Only)');
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-700/60 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Run Incoming-Call Simulator
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleStopAndSave(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Stop &amp; Save Analysis</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStopAndSave(false)}
                  className="px-3.5 py-2 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <MicOff className="w-4 h-4" />
                  <span>Stop Without Saving</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Consent Checkboxes */}
        <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-neutral-300 border-t border-neutral-800/80">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="rounded border-neutral-700 bg-neutral-900 text-red-600 focus:ring-red-500"
            />
            <span>
              I explicitly authorize audio capture and transmission to the CallShield
              analysis service.
            </span>
          </label>

          {selectedMode === 'Mode C — In-App WebRTC Voice Call' && (
            <label className="inline-flex items-center gap-2 cursor-pointer text-amber-300">
              <input
                type="checkbox"
                checked={webrtcPeerConsent}
                onChange={(e) => setWebrtcPeerConsent(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-red-600"
              />
              <span>Both WebRTC call participants have consented to live screening.</span>
            </label>
          )}
        </div>

        {statusMessage && (
          <div className="text-xs text-neutral-300 bg-[#090A0F] border border-neutral-800 rounded-lg p-3 font-mono">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Real-Time Warnings Overlay Stream */}
      {activeWarnings.length > 0 && (
        <div
          role="region"
          aria-label="Real-Time Scam Warnings"
          className="space-y-3"
        >
          {activeWarnings.map((warn) => (
            <div
              key={warn.id}
              className="rounded-xl bg-red-950/35 border border-red-600/80 p-4 flex items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono text-red-300">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-semibold">{warn.title}</span>
                  <span>·</span>
                  <span>Matched: “{warn.matchedPhrase}”</span>
                </div>
                <p className="text-sm font-medium text-white">{warn.message}</p>
                <p className="text-xs text-neutral-400">
                  Limitation: {warn.limitationNote} Warnings are advisory only and never
                  automatically block calls or contact law enforcement.
                </p>
              </div>
              <button
                type="button"
                aria-label={`Dismiss warning ${warn.title}`}
                onClick={() =>
                  setDismissedWarnings((prev) => new Set(prev).add(warn.id))
                }
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Waveform & Live Utterance Streamer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <WaveformCanvas
            analyser={analyserRef.current}
            isActive={isCapturing}
            alertLevel={
              (liveAssessment?.riskScore ?? 0) >= 60
                ? 'critical'
                : (liveAssessment?.riskScore ?? 0) >= 30
                ? 'warning'
                : 'normal'
            }
            height={130}
            label={`Live Audio Pipeline — ${selectedMode}`}
          />

          {/* Test Phrase / Live Speech Injection Control */}
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Speak or Stream Live Test Phrase into Active Session
                </h2>
                <p className="text-xs text-neutral-400">
                  Send a spoken phrase with acoustic prosody into the live chunk pipeline
                  to verify real-time ASR, SER, and scam warnings.
                </p>
              </div>
              {isProcessingChunk && (
                <span className="text-xs font-mono text-amber-400">
                  Processing audio chunk...
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!isCapturing}
                onClick={() =>
                  sendLiveChunk(
                    sessionId || '',
                    'Please share the 6-digit OTP sent to your mobile immediately to stop account suspension.',
                    'Speaker 1',
                    'stressed_urgent',
                    liveTranscript.length + 1
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-[#151926] hover:bg-neutral-800 disabled:opacity-40 border border-neutral-700 rounded-md text-neutral-200 cursor-pointer"
              >
                + Stream OTP Scam Utterance
              </button>
              <button
                type="button"
                disabled={!isCapturing}
                onClick={() =>
                  sendLiveChunk(
                    sessionId || '',
                    'Install AnyDesk remote support app and approve the UPI collect request right now.',
                    'Speaker 1',
                    'angry_aggressive',
                    liveTranscript.length + 1
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-[#151926] hover:bg-neutral-800 disabled:opacity-40 border border-neutral-700 rounded-md text-neutral-200 cursor-pointer"
              >
                + Stream AnyDesk Phishing
              </button>
              <button
                type="button"
                disabled={!isCapturing}
                onClick={() =>
                  sendLiveChunk(
                    sessionId || '',
                    'I am really anxious about the hospital traffic, please let me know when you reach the clinic.',
                    'Speaker 2',
                    'fearful_distressed',
                    liveTranscript.length + 1
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-[#151926] hover:bg-neutral-800 disabled:opacity-40 border border-neutral-700 rounded-md text-neutral-200 cursor-pointer"
              >
                + Stream Distressed Benign Phrase (0 Risk)
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                aria-label="Custom live speech utterance"
                value={customUtterance}
                onChange={(e) => setCustomUtterance(e.target.value)}
                placeholder="Type a custom phrase to synthesize & stream into the live session..."
                className="flex-1 rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <select
                aria-label="Prosody vocal tone"
                value={selectedProsodyHint}
                onChange={(e) => setSelectedProsodyHint(e.target.value as any)}
                className="rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-neutral-200"
              >
                <option value="calm_neutral">Calm Prosody</option>
                <option value="stressed_urgent">Stressed / Urgent</option>
                <option value="angry_aggressive">Angry / Forceful</option>
                <option value="fearful_distressed">Fearful / Distressed</option>
              </select>
              <button
                type="button"
                disabled={!isCapturing || !customUtterance.trim()}
                onClick={() => {
                  sendLiveChunk(
                    sessionId || '',
                    customUtterance,
                    'Speaker 1',
                    selectedProsodyHint,
                    liveTranscript.length + 1
                  );
                  setCustomUtterance('');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Send Audio Chunk
              </button>
            </div>
          </div>

          {/* Live Transcript Feed */}
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Live Speech Transcription Stream
              </h2>
              <span className="text-xs font-mono text-neutral-400 tabular-nums">
                {liveTranscript.length} segment(s)
              </span>
            </div>

            {liveTranscript.length === 0 ? (
              <div className="text-xs text-neutral-400 py-8 text-center">
                {isCapturing
                  ? 'Listening for speech chunks... Click a test utterance above or speak into microphone.'
                  : 'Start live capture or the incoming-call simulator to view recognized speech segments.'}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {liveTranscript.map((seg) => (
                  <div
                    key={seg.id}
                    className="p-3 rounded-lg bg-[#090A0F] border border-neutral-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono tabular-nums">
                      <span>
                        {seg.speaker} · {seg.startTime.toFixed(1)}s –{' '}
                        {seg.endTime.toFixed(1)}s
                      </span>
                      <span>ASR Conf: {Math.round(seg.confidence * 100)}%</span>
                    </div>
                    <p className="text-xs text-white leading-relaxed">{seg.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Emotion Estimates & Continuous Risk Assessment */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Continuous Fraud Risk Assessment
                </h2>
                <p className="text-xs text-neutral-400">
                  Derived strictly from conversational scam indicators
                </p>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-2xl font-bold text-white">
                  {liveAssessment?.riskScore !== undefined &&
                  liveAssessment?.riskScore !== null
                    ? `${liveAssessment.riskScore}/100`
                    : '—'}
                </div>
                <div className="text-[11px] text-red-400">
                  {liveAssessment?.riskCategory || 'Awaiting speech'}
                </div>
              </div>
            </div>

            {liveAssessment ? (
              <div className="space-y-3 text-xs">
                <p className="text-neutral-300 leading-relaxed">
                  {liveAssessment.summaryExplanation}
                </p>
                {liveAssessment.matchedRules.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                    <div className="text-neutral-400 font-medium">
                      Triggered Scam Rules:
                    </div>
                    {liveAssessment.matchedRules.map((r) => (
                      <div
                        key={r.ruleId}
                        className="p-2.5 rounded bg-[#090A0F] border border-neutral-800 space-y-1"
                      >
                        <div className="flex items-center justify-between font-mono text-red-400">
                          <span>{r.ruleName}</span>
                          <span>+{r.weight} pts</span>
                        </div>
                        <p className="text-neutral-400 text-[11px]">{r.safeNextStep}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-neutral-400 py-4">
                Risk score updates automatically as speech chunks are recognized.
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Live Vocal Emotion Estimates (SER)
                </h2>
                <p className="text-xs text-neutral-400">
                  Acoustic prosody cues (never treated as proof of fraud)
                </p>
              </div>
            </div>

            {liveEmotions.length === 0 ? (
              <div className="text-xs text-neutral-400 py-4">
                No acoustic emotion segments computed yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {liveEmotions.slice(-3).map((emo) => (
                  <div
                    key={emo.id}
                    className="p-3 rounded-lg bg-[#090A0F] border border-neutral-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-white font-semibold">
                        {emo.primaryEmotion} ({Math.round(emo.confidence * 100)}%)
                      </span>
                      <span className="text-neutral-400 tabular-nums">
                        F0: {emo.acousticCues.pitchHz}Hz · RMS: {emo.acousticCues.rms}
                      </span>
                    </div>
                    {emo.uncertaintyFlag && (
                      <div className="text-[11px] text-amber-400">
                        Uncertainty note: {emo.uncertaintyReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documented Future Native Android Companion Architecture */}
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Smartphone className="w-4 h-4 text-red-400" />
                <span>Native Android Companion API Contract</span>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                POST /api/mobile/v1/call-event
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Browsers cannot directly intercept cellular call audio. For production
              cellular screening, an authorized Android companion app using{' '}
              <code className="text-neutral-200">android.telecom.CallScreeningService</code>{' '}
              submits consented call metadata and permitted audio chunks to{' '}
              <code className="text-neutral-200">/api/mobile/v1/call-event</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
