import React, { useRef, useState } from 'react';
import { AnalysisRecord, EmotionLabel } from '../types/callshield';
import { WaveformCanvas } from './WaveformCanvas';
import {
  Play,
  Edit3,
  Check,
  X,
  FileText,
  FolderPlus,
  AlertTriangle,
  History,
} from 'lucide-react';

interface TranscriptTimelineViewProps {
  analyses: AnalysisRecord[];
  selectedAnalysisId: string | null;
  authToken: string | null;
  onRequestAuth: (mode: 'login' | 'register') => void;
  onSelectAnalysisId: (id: string) => void;
  onAnalysisUpdated: (updated: AnalysisRecord) => void;
  onNavigateToReport: (analysisId: string) => void;
  onAttachToCase: (analysisId: string, title: string) => void;
}

export const TranscriptTimelineView: React.FC<TranscriptTimelineViewProps> = ({
  analyses,
  selectedAnalysisId,
  authToken,
  onRequestAuth,
  onSelectAnalysisId,
  onAnalysisUpdated,
  onNavigateToReport,
  onAttachToCase,
}) => {
  const activeAnalysis =
    analyses.find((a) => a.id === selectedAnalysisId) || analyses[0] || null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const [editReason, setEditReason] = useState<string>(
    'Investigator ASR transcription correction'
  );
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  if (!activeAnalysis) {
    return (
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-10 text-center space-y-3">
        <h1 className="text-lg font-semibold text-white">
          No Analyzed Recordings Available
        </h1>
        <p className="text-xs text-neutral-400">
          Upload or analyze a forensic WAV sample first to inspect its synchronized
          transcript and vocal emotion timeline.
        </p>
      </div>
    );
  }

  const seekToTime = (sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec;
      audioRef.current.play().catch(() => {});
    }
    setCurrentTime(sec);
  };

  const handleSaveTranscriptEdit = async (segmentId: string) => {
    if (!authToken) {
      onRequestAuth('login');
      return;
    }
    if (!editDraft.trim()) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(
        `/api/analyses/${activeAnalysis.id}/transcript`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            segmentId,
            updatedText: editDraft.trim(),
            reason: editReason,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.analysis) {
        onAnalysisUpdated(data.analysis);
        setEditingSegId(null);
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const progressRatio =
    activeAnalysis.durationSeconds > 0
      ? Math.min(1, currentTime / activeAnalysis.durationSeconds)
      : 0;

  return (
    <div className="space-y-6">
      {/* Recording Selector & Header */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-neutral-400 font-mono">
              Ref: {activeAnalysis.id} · {activeAnalysis.sourceMode}
              {activeAnalysis.isSimulated ? ' · SIMULATED CALL DEMO' : ''}
            </div>
            <h1 className="text-xl font-bold font-display text-white">
              {activeAnalysis.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="timeline-recording-select" className="sr-only">
              Select Analyzed Recording
            </label>
            <select
              id="timeline-recording-select"
              value={activeAnalysis.id}
              onChange={(e) => onSelectAnalysisId(e.target.value)}
              className="w-full sm:w-auto sm:max-w-xs truncate rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} (Score: {a.fraudAssessment.riskScore ?? 'N/A'})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                onAttachToCase(
                  activeAnalysis.id,
                  `Investigation: ${activeAnalysis.title}`
                )
              }
              className="px-3.5 py-2 text-xs font-medium text-neutral-200 bg-[#151926] hover:bg-neutral-800 border border-neutral-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Attach to Case</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToReport(activeAnalysis.id)}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export Forensic Report</span>
            </button>
          </div>
        </div>

        {/* Acoustic Signal Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-3 border-t border-neutral-800 text-xs font-mono tabular-nums">
          <div className="p-2.5 rounded bg-[#090A0F] border border-neutral-800/80">
            <div className="text-neutral-400 text-[11px]">Duration</div>
            <div className="text-white font-semibold">
              {activeAnalysis.durationSeconds.toFixed(2)}s
            </div>
          </div>
          <div className="p-2.5 rounded bg-[#090A0F] border border-neutral-800/80">
            <div className="text-neutral-400 text-[11px]">Sample Rate</div>
            <div className="text-white font-semibold">
              {activeAnalysis.audioMetrics.sampleRate} Hz
            </div>
          </div>
          <div className="p-2.5 rounded bg-[#090A0F] border border-neutral-800/80">
            <div className="text-neutral-400 text-[11px]">RMS Energy</div>
            <div className="text-white font-semibold">
              {activeAnalysis.audioMetrics.rmsEnergy}
            </div>
          </div>
          <div className="p-2.5 rounded bg-[#090A0F] border border-neutral-800/80">
            <div className="text-neutral-400 text-[11px]">Pitch F0 / Jitter</div>
            <div className="text-white font-semibold">
              {activeAnalysis.audioMetrics.estimatedPitchHz}Hz ±
              {activeAnalysis.audioMetrics.pitchVariabilityHz}
            </div>
          </div>
          <div className="p-2.5 rounded bg-[#090A0F] border border-neutral-800/80">
            <div className="text-neutral-400 text-[11px]">SNR</div>
            <div className="text-white font-semibold">
              {activeAnalysis.audioMetrics.snrDb} dB
            </div>
          </div>
          <div className="p-2.5 rounded bg-[#090A0F] border border-neutral-800/80">
            <div className="text-neutral-400 text-[11px]">Silence Ratio</div>
            <div className="text-white font-semibold">
              {Math.round(activeAnalysis.audioMetrics.silenceRatio * 100)}%
            </div>
          </div>
          <div className="p-2.5 rounded bg-[#090A0F] border border-neutral-800/80">
            <div className="text-neutral-400 text-[11px]">Fraud Score</div>
            <div className="text-red-400 font-bold">
              {activeAnalysis.fraudAssessment.riskScore !== null
                ? `${activeAnalysis.fraudAssessment.riskScore}/100`
                : 'Inconclusive'}
            </div>
          </div>
        </div>

        {/* Synchronized Audio Player & Waveform */}
        <div className="space-y-3 pt-2">
          <WaveformCanvas
            isActive={isPlaying}
            progressRatio={progressRatio}
            alertLevel={
              (activeAnalysis.fraudAssessment.riskScore ?? 0) >= 60
                ? 'critical'
                : (activeAnalysis.fraudAssessment.riskScore ?? 0) >= 30
                ? 'warning'
                : 'normal'
            }
            height={96}
            label={`Synchronized Forensic Audio Playback (${currentTime.toFixed(1)}s / ${activeAnalysis.durationSeconds.toFixed(1)}s)`}
          />
          {activeAnalysis.audioDataUrl && (
            <audio
              ref={audioRef}
              controls
              src={activeAnalysis.audioDataUrl}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              aria-label={`Synchronized audio player for ${activeAnalysis.title}`}
              className="w-full h-9"
            />
          )}
        </div>
      </div>

      {/* Main Split: Timestamped Transcript Editor & Vocal Emotion Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Synchronized Transcript & Investigator Error Correction */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Synchronized Speech Transcript &amp; Investigator Review
                </h2>
                <p className="text-xs text-neutral-400">
                  Click any timestamp to jump audio playback. Correct ASR transcription
                  errors while preserving original evidence in the audit log.
                </p>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                {activeAnalysis.transcript.length} segment(s)
              </span>
            </div>

            {activeAnalysis.transcript.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#090A0F] border border-neutral-800 text-xs text-amber-300">
                No intelligible speech segments were recognized in this recording. Fraud
                assessment is marked Inconclusive.
              </div>
            ) : (
              <div className="space-y-3">
                {activeAnalysis.transcript.map((seg) => {
                  const isCurrent =
                    currentTime >= seg.startTime && currentTime <= seg.endTime;
                  const isEditing = editingSegId === seg.id;

                  return (
                    <div
                      key={seg.id}
                      className={`p-4 rounded-lg border transition-colors space-y-2 ${
                        isCurrent
                          ? 'bg-[#171C2C] border-red-500/80'
                          : 'bg-[#090A0F] border-neutral-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                        <button
                          type="button"
                          onClick={() => seekToTime(seg.startTime)}
                          className="text-red-400 hover:text-red-300 inline-flex items-center gap-1.5 font-semibold cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>
                            {seg.speaker} [{seg.startTime.toFixed(1)}s –{' '}
                            {seg.endTime.toFixed(1)}s]
                          </span>
                        </button>

                        <div className="flex items-center gap-3 text-neutral-400">
                          <span>
                            ASR Confidence: {Math.round(seg.confidence * 100)}%
                          </span>
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSegId(seg.id);
                                setEditDraft(seg.text);
                              }}
                              className="text-neutral-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Transcript</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            rows={2}
                            aria-label="Edited transcript text"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="w-full rounded bg-[#10131D] border border-neutral-700 p-2 text-xs text-white font-mono"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <input
                              type="text"
                              aria-label="Reason for transcript edit"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              placeholder="Reason for correction..."
                              className="flex-1 rounded bg-[#10131D] border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isSavingEdit}
                                onClick={() => handleSaveTranscriptEdit(seg.id)}
                                className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Save Correction</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSegId(null)}
                                className="px-2.5 py-1 text-xs text-neutral-300 bg-neutral-800 rounded inline-flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                <span>Cancel</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-white leading-relaxed">
                            {seg.text}
                          </p>
                          {seg.originalText && seg.originalText !== seg.text && (
                            <div className="text-[11px] font-mono text-neutral-400 pt-1 border-t border-neutral-800/80">
                              Original Unedited ASR: “{seg.originalText}”
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Preserved Transcript Edit Audit Trail */}
            {activeAnalysis.transcriptEdits.length > 0 && (
              <div className="pt-4 border-t border-neutral-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                  <History className="w-3.5 h-3.5 text-red-400" />
                  <span>
                    Preserved Transcript Edit History (
                    {activeAnalysis.transcriptEdits.length})
                  </span>
                </div>
                {activeAnalysis.transcriptEdits.map((ed) => (
                  <div
                    key={ed.id}
                    className="p-2.5 rounded bg-[#090A0F] border border-neutral-800 text-[11px] font-mono text-neutral-300 space-y-0.5"
                  >
                    <div className="text-neutral-400">
                      {new Date(ed.editedAt).toLocaleString()} · By {ed.editedBy} ·{' '}
                      {ed.reason}
                    </div>
                    <div>Before: “{ed.previousText}”</div>
                    <div className="text-emerald-400">After: “{ed.updatedText}”</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Matched Fraud Rules & Explanations */}
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">
              Matched Scam Detection Rules ({activeAnalysis.fraudAssessment.matchedRules.length})
            </h2>

            {activeAnalysis.fraudAssessment.matchedRules.length === 0 ? (
              <p className="text-xs text-neutral-400">
                Zero deterministic scam indicators triggered in this conversation.
              </p>
            ) : (
              <div className="space-y-3">
                {activeAnalysis.fraudAssessment.matchedRules.map((rule) => (
                  <div
                    key={rule.ruleId}
                    className="p-4 rounded-lg bg-[#090A0F] border border-neutral-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-semibold text-red-400">
                        {rule.ruleName} [{rule.timestampStart.toFixed(1)}s –{' '}
                        {rule.timestampEnd.toFixed(1)}s]
                      </span>
                      <span className="text-white tabular-nums">
                        +{rule.weight} pts · {rule.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-neutral-200 bg-[#121521] p-2 rounded">
                      Excerpt: “{rule.matchedExcerpt}”
                    </div>
                    <p className="text-xs text-neutral-300">
                      <strong>Why it matters:</strong> {rule.whyItMatters}
                    </p>
                    <p className="text-xs text-emerald-400">
                      <strong>Recommended Safe Action:</strong> {rule.safeNextStep}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Speech Emotion Recognition (SER) Timeline */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">
                Speech Emotion Recognition (SER) Timeline
              </h2>
              <p className="text-xs text-neutral-400">
                Interval-level vocal prosody cues. Emotions are uncertain acoustic
                estimates and never independently establish fraud or guilt.
              </p>
            </div>

            <div className="space-y-3">
              {activeAnalysis.emotions.map((emo) => (
                <div
                  key={emo.id}
                  onClick={() => seekToTime(emo.startTime)}
                  className="p-4 rounded-lg bg-[#090A0F] border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-white font-semibold">
                      [{emo.startTime.toFixed(1)}s – {emo.endTime.toFixed(1)}s]{' '}
                      {emo.primaryEmotion}
                    </span>
                    <span className="text-red-400">
                      Confidence: {Math.round(emo.confidence * 100)}%
                    </span>
                  </div>

                  {/* Probability Breakdown Bars */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                    {(Object.entries(emo.probabilities) as [EmotionLabel, number][]).map(
                      ([lbl, prob]) => (
                        <div key={lbl} className="flex items-center justify-between">
                          <span className="text-neutral-400 truncate">{lbl}</span>
                          <span className="font-mono tabular-nums text-neutral-200">
                            {Math.round(prob * 100)}%
                          </span>
                        </div>
                      )
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-neutral-400 pt-1 border-t border-neutral-800/80 flex items-center justify-between">
                    <span>Pitch F0: {emo.acousticCues.pitchHz} Hz</span>
                    <span>RMS: {emo.acousticCues.rms}</span>
                    <span>ZCR: {emo.acousticCues.zcr}</span>
                  </div>

                  {emo.uncertaintyFlag && (
                    <div className="text-[11px] text-amber-400 flex items-start gap-1.5 pt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{emo.uncertaintyReason}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Provenance & Limitations Card */}
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-white">
              Capability Attribution &amp; Analytical Limitations
            </h3>
            <div className="space-y-1 text-neutral-300 font-mono text-[11px]">
              <div>ASR Engine: {activeAnalysis.fraudAssessment.provenance.asrUsed}</div>
              <div>SER Engine: {activeAnalysis.fraudAssessment.provenance.serUsed}</div>
              <div>
                Rule Engine: {activeAnalysis.fraudAssessment.provenance.rulesVersion}
              </div>
            </div>
            <ul className="space-y-1.5 text-neutral-400 pt-2 border-t border-neutral-800">
              {activeAnalysis.fraudAssessment.limitations.map((lim, i) => (
                <li key={i}>· {lim}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
