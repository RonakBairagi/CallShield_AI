import React, { useState } from 'react';
import {
  FRAUD_RULE_CATALOG,
  DEFAULT_RISK_THRESHOLDS,
  evaluateFraudRisk,
} from '../lib/fraudEngine';
import {
  analyzeSpeechEmotionsFromPcm,
  parseWavBuffer,
  synthesizeTestWav,
  SyntheticProsodyProfile,
} from '../lib/audioDsp';
import { FraudRuleId, RiskThresholds } from '../types/callshield';
import { Scale, CheckCircle2, Sliders, ShieldAlert } from 'lucide-react';

interface RiskAnalysisViewProps {
  thresholds: RiskThresholds;
  onSaveThresholds: (next: RiskThresholds) => void;
}

export const RiskAnalysisView: React.FC<RiskAnalysisViewProps> = ({
  thresholds,
  onSaveThresholds,
}) => {
  const [localThresholds, setLocalThresholds] = useState<RiskThresholds>(thresholds);
  const [customWeights, setCustomWeights] = useState<Partial<Record<FraudRuleId, number>>>({});
  const [testText, setTestText] = useState<string>(
    'I am Inspector Vikram from CBI Cyber Cell. A non-bailable arrest warrant is active. Do not disconnect the call and read out the 6-digit OTP immediately.'
  );
  const [testProsody, setTestProsody] = useState<SyntheticProsodyProfile>('stressed_urgent');
  const [savedNotice, setSavedNotice] = useState<string>('');

  const wavBytes = synthesizeTestWav(testProsody, 4.0, 16000);
  const parsed = parseWavBuffer(wavBytes);
  const ser = analyzeSpeechEmotionsFromPcm(parsed.samples, parsed.sampleRate);

  const evaluation = evaluateFraudRisk({
    transcript: testText.trim()
      ? [
          {
            id: 'eval-1',
            speaker: 'Speaker 1',
            startTime: 0,
            endTime: 4.0,
            text: testText,
            confidence: 0.95,
            lowConfidence: false,
            language: 'en-IN',
          },
        ]
      : [],
    emotions: ser.segments,
    thresholds: localThresholds,
    customRuleWeights: customWeights,
  });

  const handleApplyThresholds = () => {
    onSaveThresholds(localThresholds);
    setSavedNotice('Updated provisional risk thresholds in persistent settings.');
    window.setTimeout(() => setSavedNotice(''), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold font-display text-white">
              Explainable Fraud-Risk Engine &amp; 13-Rule Taxonomy
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Provisional risk thresholds (0–100) are transparent product rules derived
              from conversational evidence—never from accent, gender, or vocal emotion alone.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            Rulebook v2.4 · 13 Active Rules
          </span>
        </div>
      </div>

      {/* Interactive Evaluator & Anti-Bias Verification Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Live Rule &amp; Anti-Bias Verification Lab
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTestText(
                    'I am crying and terrified because my father is in the emergency room and the ambulance is delayed in traffic!'
                  );
                  setTestProsody('fearful_distressed');
                }}
                className="px-2.5 py-1 text-xs bg-[#161A28] hover:bg-neutral-800 border border-neutral-700 rounded text-neutral-200 cursor-pointer"
              >
                Test Distressed Benign Call
              </button>
              <button
                type="button"
                onClick={() => {
                  setTestText(
                    'Install AnyDesk remote support app now and share the 6-digit OTP to stop your bank account from being frozen.'
                  );
                  setTestProsody('angry_aggressive');
                }}
                className="px-2.5 py-1 text-xs bg-[#161A28] hover:bg-neutral-800 border border-neutral-700 rounded text-neutral-200 cursor-pointer"
              >
                Test AnyDesk + OTP Scam
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="risk-lab-transcript"
              className="block text-xs font-medium text-neutral-300"
            >
              Test Transcript Excerpt (Clear text to verify Inconclusive empty-evidence behavior)
            </label>
            <textarea
              id="risk-lab-transcript"
              rows={4}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 p-3 text-xs font-mono text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label
                htmlFor="risk-lab-prosody"
                className="block text-xs font-medium text-neutral-300"
              >
                Simulated Acoustic Prosody (SER Input)
              </label>
              <select
                id="risk-lab-prosody"
                value={testProsody}
                onChange={(e) => setTestProsody(e.target.value as SyntheticProsodyProfile)}
                className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
              >
                <option value="calm_neutral">Calm / Neutral Prosody</option>
                <option value="stressed_urgent">Stressed / High Jitter Prosody</option>
                <option value="angry_aggressive">Angry / Loud High-Energy Prosody</option>
                <option value="fearful_distressed">Fearful / Trembling Prosody</option>
              </select>
            </div>

            <div className="p-3 rounded-lg bg-[#090A0F] border border-neutral-800 text-xs flex flex-col justify-between">
              <span className="text-neutral-400">Detected SER Vocal Cue:</span>
              <span className="font-mono font-semibold text-white">
                {ser.segments[0]?.primaryEmotion} (
                {Math.round((ser.segments[0]?.confidence || 0) * 100)}% conf · F0{' '}
                {ser.segments[0]?.acousticCues.pitchHz}Hz)
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#090A0F] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-neutral-400">Calculated Risk Score</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white">
                  {evaluation.riskScore !== null
                    ? `${evaluation.riskScore} / 100`
                    : 'Inconclusive'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-400">Risk Category</div>
                <div
                  className={`text-sm font-semibold ${
                    (evaluation.riskScore ?? 0) >= localThresholds.highMin
                      ? 'text-red-400'
                      : (evaluation.riskScore ?? 0) >= localThresholds.moderateMin
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {evaluation.riskCategory}
                </div>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              {evaluation.summaryExplanation}
            </p>

            <div className="text-[11px] font-mono text-neutral-400 pt-2 border-t border-neutral-800 flex flex-wrap gap-3">
              <span>ASR: {evaluation.provenance.asrUsed}</span>
              <span>·</span>
              <span>SER: {evaluation.provenance.serUsed}</span>
            </div>
          </div>
        </div>

        {/* Provisional Threshold Tuner */}
        <div className="lg:col-span-5 rounded-xl bg-[#10131D] border border-neutral-800 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Provisional Threshold Configuration
              </h2>
              <Sliders className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-xs text-neutral-400">
              Adjust the provisional cutoffs used to classify Low, Moderate, High, and
              Very High detected risk during testing.
            </p>

            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-300">
                    Moderate Detected Risk Cutoff (0–{localThresholds.moderateMin - 1} = Low)
                  </span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {localThresholds.moderateMin} pts
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Moderate Risk Cutoff"
                  min={15}
                  max={45}
                  value={localThresholds.moderateMin}
                  onChange={(e) =>
                    setLocalThresholds({
                      ...localThresholds,
                      moderateMin: Number(e.target.value),
                    })
                  }
                  className="w-full accent-red-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-300">High Detected Risk Cutoff</span>
                  <span className="font-mono tabular-nums text-red-400">
                    {localThresholds.highMin} pts
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="High Risk Cutoff"
                  min={46}
                  max={75}
                  value={localThresholds.highMin}
                  onChange={(e) =>
                    setLocalThresholds({
                      ...localThresholds,
                      highMin: Number(e.target.value),
                    })
                  }
                  className="w-full accent-red-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-300">Very High Detected Risk Cutoff</span>
                  <span className="font-mono tabular-nums text-red-500">
                    {localThresholds.veryHighMin} pts
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Very High Risk Cutoff"
                  min={76}
                  max={95}
                  value={localThresholds.veryHighMin}
                  onChange={(e) =>
                    setLocalThresholds({
                      ...localThresholds,
                      veryHighMin: Number(e.target.value),
                    })
                  }
                  className="w-full accent-red-600"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-neutral-800">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleApplyThresholds}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer"
              >
                Save Thresholds
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalThresholds({ ...DEFAULT_RISK_THRESHOLDS });
                  setCustomWeights({});
                }}
                className="px-3.5 py-2 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg cursor-pointer"
              >
                Reset Defaults (30 / 60 / 80)
              </button>
            </div>
            {savedNotice && (
              <div className="text-xs text-emerald-400 font-mono">{savedNotice}</div>
            )}
          </div>
        </div>
      </div>

      {/* 13-Rule Catalog Table */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Deterministic Scam Indicator Catalog (13 Rules)
            </h2>
            <p className="text-xs text-neutral-400">
              Each rule has an explainable rationale, safe next step, and tunable score
              weight.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 bg-[#0D0F17]">
                <th className="py-3 px-4 font-medium">Rule Identifier &amp; Name</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Why It Matters</th>
                <th className="py-3 px-4 font-medium">Recommended Safe Action</th>
                <th className="py-3 px-4 font-medium text-right">Weight (Pts)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {FRAUD_RULE_CATALOG.map((rule) => {
                const isMatched = evaluation.matchedRules.some(
                  (m) => m.ruleId === rule.ruleId
                );
                const weightVal = customWeights[rule.ruleId] ?? rule.defaultWeight;
                return (
                  <tr
                    key={rule.ruleId}
                    className={
                      isMatched
                        ? 'bg-red-950/25 hover:bg-red-950/35'
                        : 'hover:bg-neutral-800/30'
                    }
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{rule.ruleName}</div>
                      <div className="font-mono text-[11px] text-neutral-400">
                        {rule.ruleId} · Severity: {rule.severity}
                        {isMatched ? ' · MATCHED IN LAB' : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-neutral-300">{rule.category}</td>
                    <td className="py-3 px-4 text-neutral-300 max-w-xs">
                      {rule.whyItMatters}
                    </td>
                    <td className="py-3 px-4 text-neutral-300 max-w-xs">
                      {rule.safeNextStep}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <input
                        type="number"
                        aria-label={`Weight for ${rule.ruleName}`}
                        min={5}
                        max={60}
                        value={weightVal}
                        onChange={(e) =>
                          setCustomWeights({
                            ...customWeights,
                            [rule.ruleId]: Number(e.target.value),
                          })
                        }
                        className="w-16 rounded bg-[#090A0F] border border-neutral-700 px-2 py-1 text-right text-white"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
