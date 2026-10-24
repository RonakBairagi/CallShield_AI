import React, { useState } from 'react';
import { AnalysisRecord } from '../types/callshield';
import { FORENSIC_SAMPLE_PRESETS, ForensicSamplePreset } from '../lib/sampleScenarios';
import { Upload, FileAudio, Play, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface UploadAnalyzeViewProps {
  onAnalysisCompleted: (record: AnalysisRecord, navigateToPage?: string) => void;
}

export const UploadAnalyzeView: React.FC<UploadAnalyzeViewProps> = ({
  onAnalysisCompleted,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-IN');
  const [optionalTranscriptText, setOptionalTranscriptText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [latestResult, setLatestResult] = useState<AnalysisRecord | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File exceeds maximum allowed size of 15 MB.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!customTitle) {
      setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUploadCustomFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select an audio file (.wav, .mp3, .webm) to upload.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage('');

    try {
      const arrayBuf = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const audioBase64 = window.btoa(binary);

      const transcriptOverride = optionalTranscriptText.trim()
        ? [
            {
              id: `seg-upload-${Date.now()}`,
              speaker: 'Speaker 1' as const,
              startTime: 0,
              endTime: 6.0,
              text: optionalTranscriptText.trim(),
              confidence: 0.92,
              lowConfidence: false,
              language: selectedLanguage,
            },
          ]
        : undefined;

      const res = await fetch('/api/audio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: customTitle.trim() || selectedFile.name,
          fileName: selectedFile.name,
          audioBase64,
          mimeType: selectedFile.type || 'audio/wav',
          sourceMode: 'Mode B — Uploaded or Recorded Audio',
          isSimulated: false,
          language: selectedLanguage,
          transcriptOverride,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Audio analysis failed.');
      } else if (data.analysis) {
        setLatestResult(data.analysis);
        onAnalysisCompleted(data.analysis);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while uploading audio.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunPresetAnalysis = async (preset: ForensicSamplePreset) => {
    setIsAnalyzing(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/audio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetId: preset.id,
          title: preset.title,
          sourceMode: 'Mode B — Uploaded or Recorded Audio',
          isSimulated: false,
          language: preset.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to analyze preset WAV.');
      } else if (data.analysis) {
        setLatestResult(data.analysis);
        onAnalysisCompleted(data.analysis);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error running preset analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-2">
        <h1 className="text-xl font-bold font-display text-white">
          Mode B — Upload &amp; Analyze Forensic Audio
        </h1>
        <p className="text-xs text-neutral-400">
          Upload a permitted audio recording (.wav, .webm, .mp3 up to 15 MB) or run one
          of the 5 calibrated 16kHz RIFF WAVE forensic verification samples below.
        </p>
      </div>

      {/* Latest Completed Analysis Banner */}
      {latestResult && (
        <div
          role="region"
          aria-label="Latest Completed Audio Analysis"
          className="rounded-xl bg-[#121624] border border-red-500/60 p-6 space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
            <div>
              <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Forensic Audio Analysis Completed</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                {latestResult.title}
              </h2>
              <div className="text-xs text-neutral-400 font-mono tabular-nums mt-0.5">
                {latestResult.fileName} · {latestResult.audioMetrics.sampleRate} Hz ·{' '}
                {latestResult.durationSeconds.toFixed(1)}s · SNR:{' '}
                {latestResult.audioMetrics.snrDb} dB · Pitch F0:{' '}
                {latestResult.audioMetrics.estimatedPitchHz} Hz
              </div>
            </div>

            <div className="text-right font-mono tabular-nums">
              <div className="text-xs text-neutral-400">Provisional Fraud Score</div>
              <div className="text-2xl font-bold text-white">
                {latestResult.fraudAssessment.riskScore !== null
                  ? `${latestResult.fraudAssessment.riskScore} / 100`
                  : 'Inconclusive'}
              </div>
              <div className="text-xs text-red-400">
                {latestResult.fraudAssessment.riskCategory}
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            {latestResult.fraudAssessment.summaryExplanation}
          </p>

          {latestResult.audioDataUrl && (
            <audio
              controls
              src={latestResult.audioDataUrl}
              aria-label={`Playback for ${latestResult.title}`}
              className="w-full h-9"
            />
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onAnalysisCompleted(latestResult, 'timeline')}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Inspect Synchronized Transcript &amp; Emotion Timeline</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onAnalysisCompleted(latestResult, 'report')}
              className="px-4 py-2 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg cursor-pointer"
            >
              Open 10-Point Forensic Report
            </button>
          </div>
        </div>
      )}

      {/* Built-in Synthesized 16kHz RIFF WAV Presets */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Verified 16kHz RIFF WAVE Forensic Test Samples
            </h2>
            <p className="text-xs text-neutral-400">
              Each sample synthesizes a genuine playable 16-bit PCM WAV buffer with
              calibrated vocal prosody and runs the full backend DSP + SER + Fraud pipeline.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FORENSIC_SAMPLE_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="rounded-lg bg-[#090A0F] border border-neutral-800 p-4 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                  <span>
                    {preset.language} · {preset.durationSeconds.toFixed(1)}s WAV
                  </span>
                  <span>Expected: {preset.expectedRiskCategory}</span>
                </div>
                <h3 className="text-sm font-semibold text-white">{preset.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {preset.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
                <span className="text-[11px] font-mono text-neutral-400">
                  Prosody: {preset.prosodyProfile}
                </span>
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => handleRunPresetAnalysis(preset)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Forensic Analysis</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom File Upload Form */}
      <form
        onSubmit={handleUploadCustomFile}
        className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-5"
      >
        <div>
          <h2 className="text-base font-semibold text-white">
            Upload Custom Audio File (.wav, .mp3, .webm)
          </h2>
          <p className="text-xs text-neutral-400">
            Validates RIFF/WAVE headers, maximum file size (15 MB), sample rate, and
            clipping ratio before executing ASR and SER.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-600/70 text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="audio-file-input"
              className="block text-xs font-medium text-neutral-300"
            >
              Select Audio File (Max 15 MB)
            </label>
            <input
              id="audio-file-input"
              type="file"
              accept=".wav,.mp3,.webm,.ogg,audio/*"
              onChange={handleFileChange}
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-neutral-300 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-red-600 file:text-white hover:file:bg-red-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="upload-title-input"
              className="block text-xs font-medium text-neutral-300"
            >
              Recording Reference Title
            </label>
            <input
              id="upload-title-input"
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g., Suspect Call Recording #402"
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="upload-language-select"
              className="block text-xs font-medium text-neutral-300"
            >
              Spoken Language
            </label>
            <select
              id="upload-language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
            >
              <option value="en-IN">English (India — en-IN)</option>
              <option value="en-US">English (US — en-US)</option>
              <option value="hi-IN">Hindi / Hinglish (hi-IN)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="upload-optional-transcript"
            className="block text-xs font-medium text-neutral-300"
          >
            Optional Reference Transcript (If left blank, server runs Gemini 3.5 Transcribe ASR on audio)
          </label>
          <textarea
            id="upload-optional-transcript"
            rows={2}
            value={optionalTranscriptText}
            onChange={(e) => setOptionalTranscriptText(e.target.value)}
            placeholder="Optional: paste known transcript if uploading raw tone/offline audio..."
            className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 p-3 text-xs font-mono text-white focus:outline-none focus:border-red-500"
          />
        </div>

        <button
          type="submit"
          disabled={isAnalyzing}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-lg inline-flex items-center gap-2 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{isAnalyzing ? 'Analyzing Audio...' : 'Upload & Analyze Audio'}</span>
        </button>
      </form>
    </div>
  );
};
