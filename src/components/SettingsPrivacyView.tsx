import React, { useState } from 'react';
import { PrivacySettings } from '../types/callshield';
import { QaTestCheckResult } from '../lib/sampleScenarios';
import {
  ShieldCheck,
  Trash2,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface SettingsPrivacyViewProps {
  settings: PrivacySettings;
  onUpdateSettings: (next: PrivacySettings) => void;
  onPurgeData: (reseedDemo: boolean) => Promise<void>;
}

export const SettingsPrivacyView: React.FC<SettingsPrivacyViewProps> = ({
  settings,
  onUpdateSettings,
  onPurgeData,
}) => {
  const [localSettings, setLocalSettings] = useState<PrivacySettings>(settings);
  const [saveFeedback, setSaveFeedback] = useState<string>('');
  const [qaResults, setQaResults] = useState<{
    totalChecks: number;
    passedChecks: number;
    executedAt: string;
    results: QaTestCheckResult[];
  } | null>(null);
  const [isRunningQa, setIsRunningQa] = useState<boolean>(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localSettings),
    });
    const data = await res.json();
    if (res.ok && data.settings) {
      onUpdateSettings(data.settings);
      setSaveFeedback('Privacy, retention, and consent configuration saved.');
      window.setTimeout(() => setSaveFeedback(''), 3000);
    }
  };

  const handleRunQaSuite = async () => {
    setIsRunningQa(true);
    try {
      const res = await fetch('/api/qa/run-suite', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setQaResults(data);
      }
    } finally {
      setIsRunningQa(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-2">
        <h1 className="text-xl font-bold font-display text-white">
          Privacy, Consent &amp; Automated QA Governance
        </h1>
        <p className="text-xs text-neutral-400">
          Configure microphone authorization, external ASR transmission consent, retention
          windows, and run the built-in automated DSP/SER/Fraud QA test suite.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Privacy & Consent Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h2 className="text-base font-semibold text-white">
              Consent &amp; Data Retention Policy
            </h2>
            <ShieldCheck className="w-4 h-4 text-red-400" />
          </div>

          <div className="space-y-4 text-xs">
            <label className="flex items-start gap-3 p-3 rounded-lg bg-[#090A0F] border border-neutral-800 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.microphoneConsentGranted}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    microphoneConsentGranted: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-red-600"
              />
              <div>
                <div className="font-semibold text-white">
                  Explicit Browser Microphone Capture Consent
                </div>
                <p className="text-neutral-400 mt-0.5">
                  Requires explicit user action before activating{' '}
                  <code>navigator.mediaDevices.getUserMedia()</code>. Background or covert
                  monitoring is strictly prohibited.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-[#090A0F] border border-neutral-800 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.cloudAsrConsentGranted}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    cloudAsrConsentGranted: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-red-600"
              />
              <div>
                <div className="font-semibold text-white">
                  Server-Side Gemini ASR &amp; Contextual LLM Disclosure
                </div>
                <p className="text-neutral-400 mt-0.5">
                  Authorizes transmitting audio chunks to server-side{' '}
                  <code>gemini-3.5-transcribe</code> for speech-to-text when enabled.
                  Disable to run strictly local deterministic rules and acoustic DSP.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-[#090A0F] border border-neutral-800 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.storeRawAudioOnBackend}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    storeRawAudioOnBackend: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-red-600"
              />
              <div>
                <div className="font-semibold text-white">
                  Persist Raw WAV Audio in Forensic Case Store
                </div>
                <p className="text-neutral-400 mt-0.5">
                  Sensitive recordings are not stored permanently by default. Enable only
                  for active investigation retention windows.
                </p>
              </div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <label
                  htmlFor="retention-days-select"
                  className="block font-medium text-neutral-300"
                >
                  Evidence Retention Window
                </label>
                <select
                  id="retention-days-select"
                  value={localSettings.retentionDays}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      retentionDays: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-white"
                >
                  <option value={1}>24 Hours (Ephemeral Session)</option>
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days (Standard Investigation)</option>
                  <option value={90}>90 Days (Extended Case Hold)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="env-mode-select"
                  className="block font-medium text-neutral-300"
                >
                  Operating Environment Mode
                </label>
                <select
                  id="env-mode-select"
                  value={localSettings.environmentMode}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      environmentMode: e.target
                        .value as PrivacySettings['environmentMode'],
                    })
                  }
                  className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-white"
                >
                  <option value="Demo & Hackathon Prototype">
                    Demo &amp; Hackathon Prototype
                  </option>
                  <option value="Investigator Workstation">
                    Investigator Workstation
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer"
            >
              Save Privacy Configuration
            </button>
            {saveFeedback && (
              <span className="text-xs font-mono text-emerald-400">
                {saveFeedback}
              </span>
            )}
          </div>
        </form>

        {/* Storage Purge & Demo Reset Controls */}
        <div className="lg:col-span-5 rounded-xl bg-[#10131D] border border-neutral-800 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white">
              Database Purge &amp; Evidence Lifecycle Controls
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Exercise your right to delete all stored analyses and investigation cases
              from the SQLite database immediately, or restore the 4 calibrated forensic
              verification samples.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={async () => {
                await onPurgeData(false);
                setSaveFeedback('Purged all recordings and cases. Database is now empty.');
              }}
              className="w-full px-4 py-2.5 text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/50 border border-red-700/60 rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Purge All Stored Analyses &amp; Cases (Verify Empty State)</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await onPurgeData(true);
                setSaveFeedback('Restored calibrated forensic WAV samples and cases.');
              }}
              className="w-full px-4 py-2.5 text-xs font-medium text-neutral-200 bg-[#151926] hover:bg-neutral-800 border border-neutral-700 rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset &amp; Re-Seed Calibrated Forensic Samples</span>
            </button>
          </div>
        </div>
      </div>

      {/* Automated QA & Forensic Verification Suite */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Automated QA &amp; Forensic Verification Suite (10 Live Checks)
            </h2>
            <p className="text-xs text-neutral-400">
              Executes deterministic tests verifying malformed header rejection, empty
              audio handling, silence detection, clipped audio uncertainty, OTP &amp; Hindi
              scam detection, and false-positive protection for distressed harmless speakers.
            </p>
          </div>

          <button
            type="button"
            disabled={isRunningQa}
            onClick={handleRunQaSuite}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>
              {isRunningQa ? 'Running QA Checks...' : 'Run Automated QA Suite'}
            </span>
          </button>
        </div>

        {qaResults && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs font-mono bg-[#090A0F] border border-neutral-800 rounded-lg p-3">
              <span className="text-emerald-400 font-semibold">
                Passed: {qaResults.passedChecks} / {qaResults.totalChecks} Checks
              </span>
              <span className="text-neutral-400 tabular-nums">
                Executed: {new Date(qaResults.executedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 bg-[#0D0F17]">
                    <th className="py-2.5 px-4 font-medium">Check ID</th>
                    <th className="py-2.5 px-4 font-medium">Test Scenario</th>
                    <th className="py-2.5 px-4 font-medium">Category</th>
                    <th className="py-2.5 px-4 font-medium">Measured Output</th>
                    <th className="py-2.5 px-4 font-medium text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/70">
                  {qaResults.results.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-4 font-mono text-neutral-400">
                        {r.id}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-white">
                        {r.name}
                      </td>
                      <td className="py-2.5 px-4 text-neutral-300">{r.category}</td>
                      <td className="py-2.5 px-4 font-mono text-neutral-300">
                        {r.measuredOutput}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {r.passed ? (
                          <span className="text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </span>
                        ) : (
                          <span className="text-red-400 inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
