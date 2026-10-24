import React, { useState } from 'react';
import { AnalysisRecord, InvestigationCase } from '../types/callshield';
import { Download, FileText, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface InvestigationReportViewProps {
  cases: InvestigationCase[];
  analyses: AnalysisRecord[];
  selectedCaseId: string | null;
  selectedAnalysisId: string | null;
  onSelectCaseId: (id: string) => void;
  onSelectAnalysisId: (id: string) => void;
}

export const InvestigationReportView: React.FC<InvestigationReportViewProps> = ({
  cases,
  analyses,
  selectedCaseId,
  selectedAnalysisId,
  onSelectCaseId,
  onSelectAnalysisId,
}) => {
  const [reviewerNoteDraft, setReviewerNoteDraft] = useState<string>(
    'Reviewed acoustic prosody timeline and deterministic scam rule matches. Original 16kHz PCM recording verified intact.'
  );
  const [exportStatus, setExportStatus] = useState<string>('');

  const activeCase =
    cases.find((c) => c.id === selectedCaseId) || cases[0] || null;
  const activeAnalysis =
    analyses.find((a) => a.id === selectedAnalysisId) ||
    (activeCase
      ? analyses.find((a) => activeCase.analysisIds.includes(a.id))
      : null) ||
    analyses[0] ||
    null;

  if (!activeAnalysis) {
    return (
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-10 text-center space-y-2">
        <h1 className="text-lg font-semibold text-white">
          No Forensic Analysis Available for Report Generation
        </h1>
        <p className="text-xs text-neutral-400">
          Run or upload an audio analysis first to generate a structured 10-section
          investigation report.
        </p>
      </div>
    );
  }

  const buildReportObject = () => ({
    disclaimer:
      'PRELIMINARY ANALYTICAL ASSISTANCE ONLY — NOT CONCLUSIVE EVIDENCE OR LEGAL ADMISSIBILITY PROOF.',
    section01_caseReference: activeCase?.caseReference || 'UNLINKED-STANDALONE-ANALYSIS',
    section02_analysisDate: activeAnalysis.createdAt,
    section03_audioSource: {
      sourceMode: activeAnalysis.sourceMode,
      isSimulatedDemo: activeAnalysis.isSimulated,
      fileName: activeAnalysis.fileName,
      durationSeconds: activeAnalysis.durationSeconds,
      sampleRateHz: activeAnalysis.audioMetrics.sampleRate,
      snrDb: activeAnalysis.audioMetrics.snrDb,
    },
    section04_transcript: activeAnalysis.transcript,
    transcriptEditsAuditLog: activeAnalysis.transcriptEdits,
    section05_relevantTimestamps: activeAnalysis.fraudAssessment.matchedRules.map(
      (r) => ({
        ruleId: r.ruleId,
        startSec: r.timestampStart,
        endSec: r.timestampEnd,
        excerpt: r.matchedExcerpt,
      })
    ),
    section06_potentialFraudIndicators: activeAnalysis.fraudAssessment.matchedRules,
    section07_emotionEstimates: {
      note: 'Uncertain vocal prosody cues only; never used as an independent fraud indicator.',
      segments: activeAnalysis.emotions,
      overallDistribution: activeAnalysis.emotionDistribution,
    },
    section08_riskScoreAndExplanation: {
      riskScore: activeAnalysis.fraudAssessment.riskScore,
      riskCategory: activeAnalysis.fraudAssessment.riskCategory,
      summaryExplanation: activeAnalysis.fraudAssessment.summaryExplanation,
      thresholdsUsed: activeAnalysis.fraudAssessment.thresholdsUsed,
    },
    section09_modelAndProcessingLimitations:
      activeAnalysis.fraudAssessment.limitations,
    section10_reviewerNotes: [
      ...(activeCase?.notes.map((n) => `${n.author} (${n.createdAt}): ${n.content}`) || []),
      reviewerNoteDraft,
    ],
  });

  const handleExportJson = () => {
    const reportObj = buildReportObject();
    const blob = new Blob([JSON.stringify(reportObj, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${
      activeCase?.caseReference || activeAnalysis.id
    }-forensic-report.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus('Exported 10-Section Forensic Report as JSON.');
  };

  const handleExportMarkdown = () => {
    const r = buildReportObject();
    const md = `# CallShield AI — Cybercrime Acoustic Forensics Report
> **NOTICE:** ${r.disclaimer}

## 1. Case Reference
- **Case Reference:** ${r.section01_caseReference}
- **Case Title:** ${activeCase?.title || activeAnalysis.title}
- **Lead Investigator:** ${activeCase?.leadInvestigator || 'Authorized Reviewer'}

## 2. Analysis Date
- **Timestamp (UTC):** ${r.section02_analysisDate}

## 3. Audio Source & Signal Telemetry
- **Source Mode:** ${r.section03_audioSource.sourceMode}
- **File Name:** ${r.section03_audioSource.fileName}
- **Duration:** ${r.section03_audioSource.durationSeconds}s (${r.section03_audioSource.sampleRateHz} Hz)
- **Simulated Call Demo:** ${r.section03_audioSource.isSimulatedDemo ? 'YES (SIMULATION ONLY)' : 'NO'}

## 4. Recognized Speech Transcript
${r.section04_transcript
  .map(
    (s) =>
      `- **[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] ${s.speaker}:** "${s.text}" (ASR Conf: ${Math.round(
        s.confidence * 100
      )}%)`
  )
  .join('\n')}

## 5. Relevant Suspicious Timestamps
${
  r.section05_relevantTimestamps.length === 0
    ? '- None detected'
    : r.section05_relevantTimestamps
        .map(
          (t) =>
            `- **[${t.startSec.toFixed(1)}s - ${t.endSec.toFixed(1)}s] (${t.ruleId}):** "${t.excerpt}"`
        )
        .join('\n')
}

## 6. Potential Fraud Indicators
${
  r.section06_potentialFraudIndicators.length === 0
    ? '- Zero scam rules triggered.'
    : r.section06_potentialFraudIndicators
        .map(
          (m) =>
            `- **${m.ruleName} (+${m.weight} pts):** ${m.whyItMatters} | *Safe Action:* ${m.safeNextStep}`
        )
        .join('\n')
}

## 7. Speech Emotion Recognition (SER) Estimates
- *Note: Vocal emotion estimates reflect uncertain acoustic prosody and never independently establish fraud.*
${r.section07_emotionEstimates.segments
  .map(
    (e) =>
      `- **[${e.startTime.toFixed(1)}s - ${e.endTime.toFixed(1)}s]:** ${e.primaryEmotion} (${Math.round(
        e.confidence * 100
      )}%) | F0: ${e.acousticCues.pitchHz}Hz`
  )
  .join('\n')}

## 8. Risk Score & Explanation
- **Provisional Risk Score:** ${r.section08_riskScoreAndExplanation.riskScore ?? 'Inconclusive'} / 100
- **Risk Classification:** ${r.section08_riskScoreAndExplanation.riskCategory}
- **Summary:** ${r.section08_riskScoreAndExplanation.summaryExplanation}

## 9. Model & Processing Limitations
${r.section09_modelAndProcessingLimitations.map((l) => `- ${l}`).join('\n')}

## 10. Reviewer Notes
${r.section10_reviewerNotes.map((n) => `- ${n}`).join('\n')}
`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${
      activeCase?.caseReference || activeAnalysis.id
    }-forensic-report.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus('Exported 10-Section Forensic Report as Markdown (.md).');
  };

  return (
    <div className="space-y-6">
      {/* Selector & Export Toolbar */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold font-display text-white">
              Structured 10-Section Cybercrime Investigation Report
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Preliminary analytical assistance dossier preserving original evidence,
              rule matches, and model limitations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select Case Reference for Report"
              value={activeCase?.id || ''}
              onChange={(e) => onSelectCaseId(e.target.value)}
              className="w-full sm:w-auto sm:max-w-xs truncate rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  Case: {c.caseReference} — {c.title.slice(0, 32)}
                </option>
              ))}
            </select>

            <select
              aria-label="Select Analysis Evidence for Report"
              value={activeAnalysis.id}
              onChange={(e) => onSelectAnalysisId(e.target.value)}
              className="w-full sm:w-auto sm:max-w-xs truncate rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  Evidence: {a.title.slice(0, 38)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportMarkdown}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Markdown</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="px-3.5 py-2 text-xs font-medium text-neutral-200 bg-[#151926] hover:bg-neutral-800 border border-neutral-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {exportStatus && (
          <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{exportStatus}</span>
          </div>
        )}
      </div>

      {/* Preliminary Analytical Assistance Disclaimer Banner */}
      <div className="rounded-xl bg-amber-950/25 border border-amber-700/60 p-4 text-xs text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong>PRELIMINARY ANALYTICAL ASSISTANCE NOTICE:</strong> AI-generated
          transcripts, vocal emotion estimates, and risk scores are investigative aids
          only. They do not constitute conclusive proof of criminal intent or automatic
          legal admissibility. Original recordings are preserved unaltered.
        </div>
      </div>

      {/* 10-Section Structured Dossier */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-neutral-800 pb-6 text-xs">
          <div className="p-4 rounded-lg bg-[#090A0F] border border-neutral-800 space-y-1">
            <div className="text-neutral-400 font-mono">01. Case Reference</div>
            <div className="text-base font-bold text-white font-mono">
              {activeCase?.caseReference || 'STANDALONE-EVIDENCE'}
            </div>
            <div className="text-neutral-400">
              Status: {activeCase?.status || 'Under Review'} · Lead:{' '}
              {activeCase?.leadInvestigator || 'Authorized Analyst'}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#090A0F] border border-neutral-800 space-y-1">
            <div className="text-neutral-400 font-mono">02. Analysis Date</div>
            <div className="text-base font-bold text-white font-mono tabular-nums">
              {new Date(activeAnalysis.createdAt).toLocaleString()}
            </div>
            <div className="text-neutral-400">
              Evidence ID: {activeAnalysis.id}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#090A0F] border border-neutral-800 space-y-1">
            <div className="text-neutral-400 font-mono">03. Audio Source</div>
            <div className="text-sm font-bold text-white">
              {activeAnalysis.sourceMode}
            </div>
            <div className="text-neutral-400 font-mono tabular-nums">
              {activeAnalysis.fileName} · {activeAnalysis.durationSeconds.toFixed(1)}s ·{' '}
              {activeAnalysis.audioMetrics.sampleRate} Hz
              {activeAnalysis.isSimulated ? ' · SIMULATED' : ''}
            </div>
          </div>
        </div>

        {/* Section 4 & 5: Transcript & Relevant Timestamps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-b border-neutral-800 pb-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white font-mono">
              04. Recognized Transcript &amp; Edit Chain
            </h2>
            <div className="space-y-2">
              {activeAnalysis.transcript.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded bg-[#090A0F] border border-neutral-800 text-xs space-y-1"
                >
                  <div className="font-mono text-neutral-400 tabular-nums">
                    [{s.startTime.toFixed(1)}s – {s.endTime.toFixed(1)}s] {s.speaker} ·
                    Conf: {Math.round(s.confidence * 100)}%
                  </div>
                  <div className="text-white">{s.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white font-mono">
              05. Relevant Flagged Timestamps &amp; 06. Potential Fraud Indicators
            </h2>
            {activeAnalysis.fraudAssessment.matchedRules.length === 0 ? (
              <div className="p-4 rounded bg-[#090A0F] border border-neutral-800 text-xs text-emerald-400">
                No suspicious phrase timestamps or scam rules were triggered in this
                recording.
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeAnalysis.fraudAssessment.matchedRules.map((m) => (
                  <div
                    key={m.ruleId}
                    className="p-3 rounded bg-[#090A0F] border border-neutral-800 text-xs space-y-1"
                  >
                    <div className="flex justify-between font-mono text-red-400 tabular-nums">
                      <span>
                        [{m.timestampStart.toFixed(1)}s – {m.timestampEnd.toFixed(1)}s]{' '}
                        {m.ruleName}
                      </span>
                      <span>+{m.weight} pts</span>
                    </div>
                    <div className="text-neutral-200 font-mono">
                      “{m.matchedExcerpt}”
                    </div>
                    <div className="text-neutral-400">{m.whyItMatters}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 7 & 8: Emotion Estimates & Risk Score */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-b border-neutral-800 pb-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white font-mono">
              07. Speech Emotion Recognition (SER) Estimates
            </h2>
            <div className="space-y-2">
              {activeAnalysis.emotions.map((e) => (
                <div
                  key={e.id}
                  className="p-3 rounded bg-[#090A0F] border border-neutral-800 text-xs flex items-center justify-between font-mono tabular-nums"
                >
                  <span>
                    [{e.startTime.toFixed(1)}s – {e.endTime.toFixed(1)}s]{' '}
                    <strong className="text-white">{e.primaryEmotion}</strong> (
                    {Math.round(e.confidence * 100)}%)
                  </span>
                  <span className="text-neutral-400">
                    F0: {e.acousticCues.pitchHz}Hz · RMS: {e.acousticCues.rms}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white font-mono">
              08. Risk Score &amp; Explainable Rationale
            </h2>
            <div className="p-4 rounded bg-[#090A0F] border border-neutral-800 space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-neutral-400">Provisional Risk Score:</span>
                <span className="text-xl font-bold text-red-400">
                  {activeAnalysis.fraudAssessment.riskScore !== null
                    ? `${activeAnalysis.fraudAssessment.riskScore} / 100`
                    : 'Inconclusive'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-neutral-400">Risk Category:</span>
                <span className="text-white font-semibold">
                  {activeAnalysis.fraudAssessment.riskCategory}
                </span>
              </div>
              <p className="text-neutral-300 leading-relaxed pt-2 border-t border-neutral-800">
                {activeAnalysis.fraudAssessment.summaryExplanation}
              </p>
            </div>
          </div>
        </div>

        {/* Section 9 & 10: Model Limitations & Reviewer Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-white font-mono">
              09. Model &amp; Processing Limitations
            </h2>
            <ul className="space-y-1.5 text-xs text-neutral-400 bg-[#090A0F] border border-neutral-800 rounded p-4">
              {activeAnalysis.fraudAssessment.limitations.map((lim, idx) => (
                <li key={idx}>· {lim}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-white font-mono">
              10. Investigator / Reviewer Notes
            </h2>
            <textarea
              rows={4}
              aria-label="Investigator report reviewer notes"
              value={reviewerNoteDraft}
              onChange={(e) => setReviewerNoteDraft(e.target.value)}
              className="w-full rounded bg-[#090A0F] border border-neutral-800 p-3 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
