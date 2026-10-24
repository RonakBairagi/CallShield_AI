import React, { useState } from 'react';
import { ShieldAlert, Mic, FileAudio, Scale, ArrowRight, CheckCircle2, Volume2 } from 'lucide-react';
import { WaveformCanvas } from './WaveformCanvas';
import { evaluateFraudRisk } from '../lib/fraudEngine';

interface LandingViewProps {
  onNavigate: (page: string) => void;
  totalAnalyses: number;
  totalCases: number;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onNavigate,
  totalAnalyses,
  totalCases,
}) => {
  const [quickTranscript, setQuickTranscript] = useState(
    'I am calling from Mumbai Police Cyber Cell. You are under digital arrest. Do not disconnect the call and share the 6-digit OTP sent to your phone immediately.'
  );

  const quickAssessment = evaluateFraudRisk({
    transcript: quickTranscript.trim()
      ? [
          {
            id: 'quick-1',
            speaker: 'Speaker 1',
            startTime: 0,
            endTime: 6.5,
            text: quickTranscript,
            confidence: 0.95,
            lowConfidence: false,
            language: 'en-IN',
          },
        ]
      : [],
  });

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F4F4F6] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 py-4 border-b border-neutral-800/80 bg-[#090A0F]/95 sticky top-0 z-30">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('landing');
          }}
          className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          CallShield AI
        </a>

        <nav
          aria-label="Landing Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-300"
        >
          <a
            href="#capabilities"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Capabilities
          </a>
          <a
            href="#quick-evaluator"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Risk Evaluator
          </a>
          <a
            href="#audio-modes"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Audio Modes
          </a>
          <a
            href="#forensic-standards"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Forensic Ethics
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open Forensic Console
          </button>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12">
        {/* Hero Section */}
        <section className="py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch border-b border-neutral-800/80">
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span>National Cybercrime Acoustic Forensics</span>
                <span aria-hidden="true">·</span>
                <span>ASR + Prosodic SER + 13-Rule Scam Engine</span>
              </div>

              <h1
                className="font-display font-bold tracking-tight text-white leading-[1.12]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Real-Time Speech Emotion Analysis &amp; Scam Pattern Detection
              </h1>

              <p className="text-base text-neutral-300 leading-relaxed max-w-2xl">
                CallShield AI assists citizens, scam targets, and authorized cybercrime
                investigators in identifying coercive phone conversations—including "digital
                arrest" hoaxes, OTP harvesting, and remote-access phishing—while separating
                uncertain vocal distress cues from deterministic fraud evidence.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Launch Investigator Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="px-4 py-2.5 text-xs font-medium text-neutral-200 bg-[#121520] hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Start Live Audio Monitoring
              </button>
              <button
                type="button"
                onClick={() => onNavigate('upload')}
                className="px-4 py-2.5 text-xs font-medium text-neutral-300 bg-[#0D1018] hover:bg-neutral-800 border border-neutral-800 hover:text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Analyze Forensic WAV Samples
              </button>
            </div>

            <div className="pt-4 grid grid-cols-3 gap-6 border-t border-neutral-800/80 text-xs text-neutral-400">
              <div>
                <div className="text-xl font-bold text-white font-mono tabular-nums">13 Rules</div>
                <div>Explainable Scam Indicators</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white font-mono tabular-nums">6 Classes</div>
                <div>Prosodic Vocal Emotion Cues</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white font-mono tabular-nums">
                  {totalAnalyses} Records · {totalCases} Cases
                </div>
                <div>Persistent SQLite Audit Store</div>
              </div>
            </div>
          </div>

          {/* Interactive Acoustic Spectrogram & Telemetry Preview */}
          <div className="lg:col-span-5 rounded-xl bg-[#10131D] border border-neutral-800 p-6 flex flex-col justify-between space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Acoustic Forensics &amp; Risk Pipeline
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  16.0 kHz PCM · Autocorrelation Pitch F0 · Rule Attribution
                </p>
              </div>
              <span className="text-xs font-mono text-red-400 tabular-nums">
                Score: {quickAssessment.riskScore ?? 'N/A'}/100
              </span>
            </div>

            <WaveformCanvas
              isActive={true}
              alertLevel={
                (quickAssessment.riskScore ?? 0) >= 60
                  ? 'critical'
                  : (quickAssessment.riskScore ?? 0) >= 30
                  ? 'warning'
                  : 'normal'
              }
              height={120}
              label="Real-Time Prosodic Envelope & Pitch Contour"
            />

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-neutral-300">
                <span>Detected Risk Classification</span>
                <span className="font-mono font-semibold text-red-400">
                  {quickAssessment.riskCategory}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#090A0F] border border-neutral-800/90 text-neutral-300 font-mono text-xs leading-relaxed">
                “{quickTranscript.slice(0, 145)}
                {quickTranscript.length > 145 ? '...' : ''}”
              </div>
              <div className="flex items-center justify-between text-neutral-400 pt-1">
                <span>
                  Matched Indicators: {quickAssessment.matchedRules.length} rule(s)
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('risk')}
                  className="text-red-400 hover:text-red-300 font-medium underline underline-offset-4 cursor-pointer"
                >
                  Inspect Full Rule Engine
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Asymmetric Bento Grid */}
        <section id="capabilities" className="py-14 border-b border-neutral-800/80 space-y-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-bold font-display text-white">
              Forensic Architecture &amp; Capabilities
            </h2>
            <p className="text-sm text-neutral-400">
              Every prediction in CallShield AI is backed by transparent signal processing
              metrics, timestamped speech transcripts, and auditable detection rules.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl bg-[#10131D] border border-neutral-800 p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="text-xs text-neutral-400 font-mono">
                  Capability · Multimodal Speech &amp; Emotion Pipeline
                </div>
                <h3 className="text-lg font-semibold text-white">
                  01. Genuine Speech Recognition (ASR) &amp; Prosodic Emotion Estimation (SER)
                </h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Processes RIFF/WAVE and live browser microphone streams to compute RMS
                  energy, Zero-Crossing Rate, fundamental pitch (F0), pitch jitter, and SNR.
                  Estimates 6 vocal emotion cues (Neutral, Fear, Anger, Sadness, Happiness,
                  Stress/Nervousness) with explicit uncertainty flags whenever background
                  noise or signal clipping occurs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 pt-2 border-t border-neutral-800/80 font-mono tabular-nums">
                <span>English (en-IN / en-US)</span>
                <span aria-hidden="true">·</span>
                <span>Hindi / Hinglish (hi-IN)</span>
                <span aria-hidden="true">·</span>
                <span>Speaker 1 / Speaker 2 Diarization</span>
              </div>
            </div>

            <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="text-xs text-neutral-400 font-mono">
                  Capability · Anti-Bias Risk Engine
                </div>
                <h3 className="text-lg font-semibold text-white">
                  02. Zero-Bias Fraud Scoring (0–100)
                </h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Evaluates 13 scam patterns (OTP requests, digital arrest threats, AnyDesk
                  coaching, UPI collect links). Vocal emotion, anger, crying, or accent is
                  never used as an independent fraud indicator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('risk')}
                className="text-xs font-semibold text-red-400 hover:text-red-300 text-left cursor-pointer"
              >
                Configure Risk Thresholds →
              </button>
            </div>

            <div id="audio-modes" className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="text-xs text-neutral-400 font-mono">
                  Capability · Honest Hardware Boundaries
                </div>
                <h3 className="text-lg font-semibold text-white">
                  03. Three Separated Audio Modes
                </h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Clearly separates Mode A (Browser Microphone), Mode B (Uploaded/Recorded
                  WAV Forensics), and Mode C (Consenting In-App WebRTC Calls), plus a
                  labeled Incoming-Call Simulator for future Android companion integration.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="text-xs font-semibold text-red-400 hover:text-red-300 text-left cursor-pointer"
              >
                Explore Audio Modes →
              </button>
            </div>

            <div id="forensic-standards" className="lg:col-span-2 rounded-xl bg-[#10131D] border border-neutral-800 p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="text-xs text-neutral-400 font-mono">
                  Capability · Chain of Custody &amp; Case Management
                </div>
                <h3 className="text-lg font-semibold text-white">
                  04. Investigation Case Files &amp; Immutable Transcript Edit Logs
                </h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Investigators can attach audio analyses to structured case files, correct
                  ASR transcription errors while preserving the original recording and an
                  immutable edit history, and export 10-section preliminary forensic reports.
                </p>
              </div>
              <div className="flex items-center gap-6 text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => onNavigate('cases')}
                  className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                >
                  Open Case Management →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('report')}
                  className="text-neutral-300 hover:text-white font-medium cursor-pointer"
                >
                  View Forensic Report Template →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Quick Call Transcript Evaluator (Mechanism-to-Outcome Proof) */}
        <section id="quick-evaluator" className="py-14 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold font-display text-white">
                Interactive Scam Indicator &amp; False-Positive Sandbox
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                Test any call transcript below to see real-time deterministic rule matching
                and verify how benign distressed calls avoid false positives.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setQuickTranscript(
                    'I am calling from Mumbai Police Cyber Cell. You are under digital arrest. Do not disconnect the call and share the 6-digit OTP sent to your phone immediately.'
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-[#121520] hover:bg-neutral-800 border border-neutral-700 rounded-md text-neutral-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Load Digital Arrest Scam
              </button>
              <button
                type="button"
                onClick={() =>
                  setQuickTranscript(
                    'I am stuck in traffic near the hospital and I am terrified about dad’s surgery results! Please tell me if the doctor came out.'
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-[#121520] hover:bg-neutral-800 border border-neutral-700 rounded-md text-neutral-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Load Distressed Medical Call (0 Risk)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 rounded-xl bg-[#10131D] border border-neutral-800 p-6">
            <div className="lg:col-span-6 space-y-3">
              <label
                htmlFor="landing-quick-transcript"
                className="block text-xs font-medium text-neutral-300"
              >
                Spoken Call Excerpt (English or Hindi/Hinglish)
              </label>
              <textarea
                id="landing-quick-transcript"
                rows={4}
                value={quickTranscript}
                onChange={(e) => setQuickTranscript(e.target.value)}
                className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 p-3 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                placeholder="Type or paste a call transcript excerpt..."
              />
              <div className="text-xs text-neutral-400">
                Try typing phrases like <code className="text-neutral-200">share 6-digit OTP</code>,{' '}
                <code className="text-neutral-200">install AnyDesk</code>, or a distressed
                personal conversation to observe explainable scoring.
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col justify-between space-y-4 bg-[#090A0F] rounded-lg border border-neutral-800/80 p-5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <div className="text-xs text-neutral-400">Provisional Risk Score</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-white mt-0.5">
                    {quickAssessment.riskScore !== null
                      ? `${quickAssessment.riskScore} / 100`
                      : 'Inconclusive'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-400">Classification</div>
                  <div
                    className={`text-sm font-semibold mt-0.5 ${
                      (quickAssessment.riskScore ?? 0) >= 60
                        ? 'text-red-400'
                        : (quickAssessment.riskScore ?? 0) >= 30
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {quickAssessment.riskCategory}
                  </div>
                </div>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                {quickAssessment.summaryExplanation}
              </p>

              {quickAssessment.matchedRules.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-neutral-400">
                    Matched Rules ({quickAssessment.matchedRules.length}):
                  </div>
                  {quickAssessment.matchedRules.map((r) => (
                    <div
                      key={r.ruleId}
                      className="text-xs text-neutral-200 flex items-center justify-between font-mono py-1 border-b border-neutral-800/60 last:border-none"
                    >
                      <span>{r.ruleName}</span>
                      <span className="text-red-400 tabular-nums">+{r.weight} pts</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Zero scam rules triggered. Benign or distressed non-scam speech is protected from false positives.</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-neutral-800/80 py-8 px-6 lg:px-12 mt-auto bg-[#090A0F]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div>
            CallShield AI — Real-Time Speech Emotion Analysis for Cybercrime Investigation
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy &amp; Consent
            </button>
            <button
              type="button"
              onClick={() => onNavigate('cases')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Investigation Cases
            </button>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Forensic Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
