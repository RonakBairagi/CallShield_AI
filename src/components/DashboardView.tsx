import React from 'react';
import {
  AnalysisRecord,
  AuthenticatedUser,
  EmotionLabel,
  InvestigationCase,
  MonitoringStatus,
} from '../types/callshield';
import { Mic, Upload, FolderKanban, FileText, ArrowRight, ShieldAlert, Lock } from 'lucide-react';

interface DashboardViewProps {
  analyses: AnalysisRecord[];
  cases: InvestigationCase[];
  totalCasesCount: number;
  currentUser: AuthenticatedUser | null;
  onRequestAuth: (mode: 'login' | 'register') => void;
  monitoringStatus: MonitoringStatus;
  activeAudioSource: string;
  backendConnected: boolean;
  onStartStopLive: () => void;
  onSelectAnalysis: (analysisId: string, targetPage?: string) => void;
  onNavigate: (page: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  analyses,
  cases,
  totalCasesCount,
  currentUser,
  onRequestAuth,
  monitoringStatus,
  activeAudioSource,
  backendConnected,
  onStartStopLive,
  onSelectAnalysis,
  onNavigate,
}) => {
  const totalRecordings = analyses.length;
  const highRiskCount = analyses.filter(
    (a) => (a.fraudAssessment.riskScore ?? 0) >= 60
  ).length;
  const mediumRiskCount = analyses.filter(
    (a) =>
      (a.fraudAssessment.riskScore ?? 0) >= 30 &&
      (a.fraudAssessment.riskScore ?? 0) < 60
  ).length;
  const flaggedForReviewCount = highRiskCount + mediumRiskCount;

  // Aggregate real emotion distribution across all analyzed recordings
  const emotionLabels: EmotionLabel[] = [
    'Neutral',
    'Stress / Nervousness',
    'Fear',
    'Anger',
    'Sadness',
    'Happiness',
  ];
  const aggregatedEmotions: Record<EmotionLabel, number> = {
    Neutral: 0,
    'Stress / Nervousness': 0,
    Fear: 0,
    Anger: 0,
    Sadness: 0,
    Happiness: 0,
  };

  if (totalRecordings > 0) {
    analyses.forEach((a) => {
      emotionLabels.forEach((lbl) => {
        aggregatedEmotions[lbl] +=
          (a.emotionDistribution?.[lbl] || 0) / totalRecordings;
      });
    });
  }

  // Aggregate real matched fraud rules across all analyzed recordings
  const ruleCounts = new Map<string, { name: string; count: number }>();
  analyses.forEach((a) => {
    a.fraudAssessment.matchedRules.forEach((r) => {
      const prev = ruleCounts.get(r.ruleId);
      if (prev) {
        prev.count += 1;
      } else {
        ruleCounts.set(r.ruleId, { name: r.ruleName, count: 1 });
      }
    });
  });
  const topFraudStats = Array.from(ruleCounts.values()).sort(
    (a, b) => b.count - a.count
  );

  const isMonitoringActive =
    monitoringStatus === 'Audio source connected' ||
    monitoringStatus === 'Speech detected' ||
    monitoringStatus === 'Analyzing speech' ||
    monitoringStatus === 'Suspicious indicators detected';

  return (
    <div className="space-y-8">
      {/* Live Status & Action Bar */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span>Current Monitoring Status:</span>
            <span
              className={`font-mono font-semibold ${
                monitoringStatus === 'Suspicious indicators detected'
                  ? 'text-red-400'
                  : monitoringStatus === 'Connection error'
                  ? 'text-amber-400'
                  : isMonitoringActive
                  ? 'text-emerald-400'
                  : 'text-neutral-200'
              }`}
            >
              {monitoringStatus}
            </span>
            <span aria-hidden="true">·</span>
            <span>Source: {activeAudioSource}</span>
            <span aria-hidden="true">·</span>
            <span>
              Backend: {backendConnected ? 'SQLite Connected' : 'Connection error'}
            </span>
          </div>

          <h1 className="text-2xl font-bold font-display text-white">
            Cybercrime Acoustic Forensics Dashboard
          </h1>

          <div className="text-xs text-neutral-400">
            Native Phone Integration:{' '}
            <span className="text-neutral-200 font-mono">
              Independent Web Mode (Android Companion API v1.0 Ready)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onStartStopLive}
            className={`px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              isMonitoringActive
                ? 'bg-neutral-800 text-red-400 border border-red-500/60 hover:bg-neutral-700'
                : 'bg-red-600 text-white hover:bg-red-500'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>
              {isMonitoringActive
                ? 'Stop Live Audio Analysis'
                : 'Start Live Audio Analysis'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="px-4 py-2.5 text-xs font-medium text-neutral-200 bg-[#151926] hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload or Test WAV</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-5 space-y-1">
          <div className="text-xs text-neutral-400">Total Analyzed Recordings</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-white">
            {totalRecordings}
          </div>
          <div className="text-xs text-neutral-400">
            Persisted in SQLite forensic store
          </div>
        </div>

        <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-5 space-y-1">
          <div className="text-xs text-neutral-400">Flagged for Review</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-red-400">
            {flaggedForReviewCount}
          </div>
          <div className="text-xs text-neutral-400">
            Conversations with score ≥ 30/100
          </div>
        </div>

        <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-5 space-y-1">
          <div className="text-xs text-neutral-400">High &amp; Very High Risk</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-red-500">
            {highRiskCount}
          </div>
          <div className="text-xs text-neutral-400">
            Score ≥ 60 · Moderate Risk: {mediumRiskCount}
          </div>
        </div>

        <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-5 space-y-1">
          <div className="text-xs text-neutral-400">Active Investigation Cases</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-white">
            {currentUser ? cases.length : totalCasesCount}
          </div>
          <div className="text-xs text-neutral-400">
            {currentUser
              ? 'Unlocked via Investigator JWT'
              : 'Protected · Sign in to inspect'}
          </div>
        </div>
      </div>

      {/* Empty State if all recordings were deleted */}
      {totalRecordings === 0 ? (
        <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-10 text-center space-y-4">
          <ShieldAlert className="w-8 h-8 text-neutral-400 mx-auto" />
          <div className="space-y-1 max-w-lg mx-auto">
            <h2 className="text-lg font-semibold text-white">
              No Analyzed Recordings in Database
            </h2>
            <p className="text-sm text-neutral-400">
              CallShield AI never displays fabricated statistics when the database is
              empty. Upload a WAV file, run a built-in forensic sample, or start live
              microphone analysis to populate real telemetry.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer"
            >
              Analyze Forensic Sample WAV
            </button>
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="px-4 py-2 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg cursor-pointer"
            >
              Open Live Monitoring
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Emotion Distribution & Fraud Indicator Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Vocal Emotion Distribution (SER)
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Aggregated acoustic prosody probabilities across {totalRecordings}{' '}
                    analyzed recording(s)
                  </p>
                </div>
                <span className="text-xs text-neutral-400 font-mono">
                  Uncertain Vocal Cues
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {emotionLabels.map((label) => {
                  const pct = Number(aggregatedEmotions[label].toFixed(1));
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-200">{label}</span>
                        <span className="font-mono tabular-nums text-neutral-400">
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden">
                        <div
                          className="h-full bg-red-600 transition-all duration-200"
                          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
                Note: Vocal emotions reflect acoustic energy, F0 pitch, and jitter. They
                never independently increase fraud risk scores.
              </p>
            </div>

            <div className="lg:col-span-6 rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Detected Fraud-Indicator Statistics
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Frequency of deterministic scam rules triggered across analyzed calls
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('risk')}
                  className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
                >
                  Rulebook →
                </button>
              </div>

              {topFraudStats.length === 0 ? (
                <div className="text-xs text-neutral-400 py-8 text-center">
                  No scam rules matched in current recordings.
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {topFraudStats.slice(0, 6).map((stat) => {
                    const ratio = Math.round((stat.count / totalRecordings) * 100);
                    return (
                      <div key={stat.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-200 truncate pr-4">
                            {stat.name}
                          </span>
                          <span className="font-mono tabular-nums text-red-400 shrink-0">
                            {stat.count} call(s) · {ratio}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden">
                          <div
                            className="h-full bg-red-500"
                            style={{ width: `${Math.min(100, Math.max(8, ratio))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Analysis Results Table */}
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Recent Audio Analysis Results
                </h2>
                <p className="text-xs text-neutral-400">
                  Click any recording to inspect its synchronized transcript, emotion
                  timeline, or forensic report
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('timeline')}
                className="text-xs font-medium text-red-400 hover:text-red-300 cursor-pointer"
              >
                Open Timeline Inspector →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 bg-[#0D0F17]">
                    <th className="py-3 px-4 font-medium">Recording Title</th>
                    <th className="py-3 px-4 font-medium">Audio Mode</th>
                    <th className="py-3 px-4 font-medium">Primary SER Cue</th>
                    <th className="py-3 px-4 font-medium text-right">Duration</th>
                    <th className="py-3 px-4 font-medium text-right">Risk Score</th>
                    <th className="py-3 px-4 font-medium">Classification</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/70">
                  {analyses.slice(0, 8).map((item) => {
                    const topEmotion =
                      item.emotions?.[0]?.primaryEmotion || 'Neutral';
                    const score = item.fraudAssessment.riskScore;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-neutral-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-white">
                          <div>{item.title}</div>
                          <div className="text-neutral-400 font-mono text-[11px]">
                            {item.fileName} · {item.language}
                            {item.isSimulated ? ' · SIMULATED DEMO' : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-neutral-300">
                          {item.sourceMode}
                        </td>
                        <td className="py-3 px-4 text-neutral-300">
                          {topEmotion}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-300">
                          {item.durationSeconds.toFixed(1)}s
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          <span
                            className={
                              (score ?? 0) >= 60
                                ? 'text-red-400'
                                : (score ?? 0) >= 30
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {score !== null ? `${score}/100` : 'Inconclusive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-neutral-300">
                          {item.fraudAssessment.riskCategory}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectAnalysis(item.id, 'timeline')}
                            className="text-red-400 hover:text-red-300 font-medium mr-3 cursor-pointer"
                          >
                            Timeline
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectAnalysis(item.id, 'report')}
                            className="text-neutral-300 hover:text-white font-medium cursor-pointer"
                          >
                            Report
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Investigation Cases */}
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Recent Cybercrime Investigation Cases
                </h2>
                <p className="text-xs text-neutral-400">
                  Authorized investigator case files linked to acoustic analyses
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('cases')}
                className="text-xs font-medium text-red-400 hover:text-red-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Manage All Cases</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!currentUser ? (
              <div className="rounded-lg bg-[#090A0F] border border-neutral-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-white">
                      Sensitive Investigation Case Records Locked (JWT Required)
                    </div>
                    <p className="text-xs text-neutral-400">
                      Case files, complainant identifiers, and reviewer notes are only
                      accessible to authenticated users.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRequestAuth('login')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In to View Cases
                </button>
              </div>
            ) : cases.length === 0 ? (
              <div className="text-xs text-neutral-400 py-4">
                No active cases recorded. Create a case from the Case History view.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cases.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg bg-[#090A0F] border border-neutral-800 p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                        <span>{c.caseReference}</span>
                        <span>
                          {c.status} · Priority: {c.priority}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white">{c.title}</h3>
                      <p className="text-xs text-neutral-400 line-clamp-2">
                        {c.summary}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
                      <span>Lead: {c.leadInvestigator}</span>
                      <button
                        type="button"
                        onClick={() => onNavigate('cases')}
                        className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
                      >
                        Open Case File →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
