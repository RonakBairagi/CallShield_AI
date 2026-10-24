import { TranscriptSegment } from '../types/callshield';
import {
  analyzeAudioSignal,
  analyzeSpeechEmotionsFromPcm,
  parseWavBuffer,
  synthesizeTestWav,
  SyntheticProsodyProfile,
} from './audioDsp';
import { evaluateFraudRisk } from './fraudEngine';

export interface ForensicSamplePreset {
  id: string;
  title: string;
  subtitle: string;
  language: string;
  durationSeconds: number;
  prosodyProfile: SyntheticProsodyProfile;
  expectedRiskCategory: string;
  description: string;
  transcript: TranscriptSegment[];
}

export const FORENSIC_SAMPLE_PRESETS: ForensicSamplePreset[] = [
  {
    id: 'sample-digital-arrest-otp',
    title: 'Sample 01 — "Digital Arrest" CBI & OTP Coercion',
    subtitle: 'High-Risk Impersonation + Arrest Threat + Immediate Transfer',
    language: 'en-IN',
    durationSeconds: 9.0,
    prosodyProfile: 'stressed_urgent',
    expectedRiskCategory: 'Very high detected risk',
    description:
      'Caller claims to be from Mumbai Cyber Cell / CBI investigating a narcotics parcel, threatens a non-bailable arrest warrant, demands the victim stay on the call, and requests an RBI verification transfer and 6-digit OTP.',
    transcript: [
      {
        id: 'seg-1',
        speaker: 'Speaker 1',
        startTime: 0.0,
        endTime: 3.0,
        text: 'I am Inspector Vikram calling from Mumbai Police Cyber Cell. A narcotics parcel linked to your Aadhaar has triggered a non-bailable arrest warrant.',
        confidence: 0.96,
        lowConfidence: false,
        language: 'en-IN',
      },
      {
        id: 'seg-2',
        speaker: 'Speaker 1',
        startTime: 3.0,
        endTime: 6.0,
        text: 'You are under digital arrest. Do not disconnect the call or contact your family. Transfer your savings immediately to the RBI supervision account.',
        confidence: 0.94,
        lowConfidence: false,
        language: 'en-IN',
      },
      {
        id: 'seg-3',
        speaker: 'Speaker 1',
        startTime: 6.0,
        endTime: 9.0,
        text: 'Read out the 6-digit OTP sent to your mobile within 5 minutes or the police team will freeze all your bank accounts.',
        confidence: 0.95,
        lowConfidence: false,
        language: 'en-IN',
      },
    ],
  },
  {
    id: 'sample-remote-access-kyc',
    title: 'Sample 02 — Bank KYC Suspension & AnyDesk Remote Access',
    subtitle: 'Remote Access App + UPI Collect Link + Credential Harvesting',
    language: 'en-IN',
    durationSeconds: 6.0,
    prosodyProfile: 'angry_aggressive',
    expectedRiskCategory: 'Very high detected risk',
    description:
      'Caller impersonates bank head office support, warns of immediate account suspension, asks the recipient to install AnyDesk remote support app, and asks to approve a UPI collect link.',
    transcript: [
      {
        id: 'seg-201',
        speaker: 'Speaker 1',
        startTime: 0.0,
        endTime: 3.0,
        text: 'Speaking from SBI Head Office KYC department. Your bank account will be suspended today unless you install AnyDesk remote support app right now.',
        confidence: 0.93,
        lowConfidence: false,
        language: 'en-IN',
      },
      {
        id: 'seg-202',
        speaker: 'Speaker 1',
        startTime: 3.0,
        endTime: 6.0,
        text: 'Share the 9-digit AnyDesk code and tap on the UPI request to enter PIN to receive your KYC verification refund.',
        confidence: 0.91,
        lowConfidence: false,
        language: 'en-IN',
      },
    ],
  },
  {
    id: 'sample-harmless-distressed',
    title: 'Sample 03 — Distressed Family Medical Call (False-Positive Guard)',
    subtitle: 'High Vocal Stress/Fear Prosody + Benign Conversation (0 Risk)',
    language: 'en-IN',
    durationSeconds: 6.0,
    prosodyProfile: 'fearful_distressed',
    expectedRiskCategory: 'Low detected risk',
    description:
      'Speaker sounds anxious and distressed while discussing a family member’s hospital admission and traffic delay. Verifies that high vocal stress/fear NEVER causes a false-positive fraud score.',
    transcript: [
      {
        id: 'seg-301',
        speaker: 'Speaker 1',
        startTime: 0.0,
        endTime: 3.0,
        text: 'I am stuck in heavy traffic near the hospital and I am really worried about dad’s blood pressure results.',
        confidence: 0.95,
        lowConfidence: false,
        language: 'en-IN',
      },
      {
        id: 'seg-302',
        speaker: 'Speaker 2',
        startTime: 3.0,
        endTime: 6.0,
        text: 'Please drive carefully, the doctor just spoke with us in the ward and said his vitals are stabilizing now.',
        confidence: 0.96,
        lowConfidence: false,
        language: 'en-IN',
      },
    ],
  },
  {
    id: 'sample-hindi-bilingual-otp',
    title: 'Sample 04 — Hindi/Hinglish Bank Block & OTP Solicitation',
    subtitle: 'Bilingual Scam Pattern Detection',
    language: 'hi-IN',
    durationSeconds: 6.0,
    prosodyProfile: 'stressed_urgent',
    expectedRiskCategory: 'High detected risk',
    description:
      'Caller uses Hindi/Hinglish to warn that the recipient’s bank account is being blocked ("bank account block") and asks them to share the OTP ("OTP bataiye").',
    transcript: [
      {
        id: 'seg-401',
        speaker: 'Speaker 1',
        startTime: 0.0,
        endTime: 3.0,
        text: 'Namaskar, aapka bank account block hone wala hai kyunki PAN update nahi hua hai.',
        confidence: 0.89,
        lowConfidence: false,
        language: 'hi-IN',
      },
      {
        id: 'seg-402',
        speaker: 'Speaker 1',
        startTime: 3.0,
        endTime: 6.0,
        text: 'Abhi ke abhi aapke mobile par aaya 6-digit OTP bataiye aur ATM PIN verify kariye.',
        confidence: 0.88,
        lowConfidence: false,
        language: 'hi-IN',
      },
    ],
  },
  {
    id: 'sample-calm-legitimate-inquiry',
    title: 'Sample 05 — Routine Branch Appointment Confirmation',
    subtitle: 'Calm Prosody + Legitimate Banking Hygiene',
    language: 'en-IN',
    durationSeconds: 6.0,
    prosodyProfile: 'calm_neutral',
    expectedRiskCategory: 'Low detected risk',
    description:
      'A calm, legitimate reminder about an in-person branch visit that explicitly reminds the customer never to share OTPs or passwords.',
    transcript: [
      {
        id: 'seg-501',
        speaker: 'Speaker 1',
        startTime: 0.0,
        endTime: 3.0,
        text: 'Good afternoon, this is a reminder for your scheduled locker visit at the Indiranagar branch tomorrow at 11 AM.',
        confidence: 0.97,
        lowConfidence: false,
        language: 'en-IN',
      },
      {
        id: 'seg-502',
        speaker: 'Speaker 1',
        startTime: 3.0,
        endTime: 6.0,
        text: 'Please bring your original photo ID to the branch counter. We do not require any details over the phone.',
        confidence: 0.97,
        lowConfidence: false,
        language: 'en-IN',
      },
    ],
  },
];

export interface QaTestCheckResult {
  id: string;
  name: string;
  category: 'Audio DSP' | 'ASR & Transcript' | 'SER Emotion' | 'Fraud Engine' | 'Security & Privacy';
  passed: boolean;
  measuredOutput: string;
}

/**
 * Executes real, deterministic quality-assurance verification checks across
 * the audio parser, acoustic SER model, and fraud detection rule engine.
 */
export function runAutomatedQaSuite(): {
  totalChecks: number;
  passedChecks: number;
  executedAt: string;
  results: QaTestCheckResult[];
} {
  const results: QaTestCheckResult[] = [];

  // 1. Unsupported audio format check
  const invalidWav = parseWavBuffer(new Uint8Array([0x00, 0x01, 0x02, 0x03]));
  results.push({
    id: 'qa-01',
    name: 'Unsupported / Malformed Audio Header Rejection',
    category: 'Audio DSP',
    passed: invalidWav.valid === false && Boolean(invalidWav.error),
    measuredOutput: invalidWav.error || 'Rejected invalid header',
  });

  // 2. Empty audio check
  const emptyMetrics = analyzeAudioSignal(new Float32Array(0), 16000);
  results.push({
    id: 'qa-02',
    name: 'Empty Audio Buffer Handling (0 frames)',
    category: 'Audio DSP',
    passed: emptyMetrics.isValidSpeech === false && emptyMetrics.durationSeconds === 0,
    measuredOutput: `duration=${emptyMetrics.durationSeconds}s, isValidSpeech=${emptyMetrics.isValidSpeech}`,
  });

  // 3. Silence detection check
  const silentWav = parseWavBuffer(synthesizeTestWav('silent', 3.0, 16000));
  const silentMetrics = analyzeAudioSignal(silentWav.samples, silentWav.sampleRate);
  results.push({
    id: 'qa-03',
    name: 'Silence Detection & Uncertain SER Fallback',
    category: 'Audio DSP',
    passed: silentMetrics.silenceRatio >= 0.9 && silentMetrics.isValidSpeech === false,
    measuredOutput: `silenceRatio=${silentMetrics.silenceRatio}, rms=${silentMetrics.rmsEnergy}`,
  });

  // 4. Noisy / Clipped speech check
  const noisyWav = parseWavBuffer(synthesizeTestWav('noisy_clipped', 3.0, 16000));
  const noisyMetrics = analyzeAudioSignal(noisyWav.samples, noisyWav.sampleRate);
  const noisySer = analyzeSpeechEmotionsFromPcm(noisyWav.samples, noisyWav.sampleRate);
  results.push({
    id: 'qa-04',
    name: 'Noisy & Clipped Audio Uncertainty Flagging',
    category: 'SER Emotion',
    passed:
      noisyMetrics.clippingRatio > 0.03 &&
      noisySer.segments.length > 0 &&
      noisySer.segments[0].uncertaintyFlag === true,
    measuredOutput: `clippingRatio=${noisyMetrics.clippingRatio}, uncertaintyFlag=${noisySer.segments[0]?.uncertaintyFlag}`,
  });

  // 5. Clear English speech & OTP detection
  const otpSample = FORENSIC_SAMPLE_PRESETS[0];
  const otpEval = evaluateFraudRisk({ transcript: otpSample.transcript });
  results.push({
    id: 'qa-05',
    name: 'Suspicious OTP & Digital Arrest Coercion Detection',
    category: 'Fraud Engine',
    passed:
      (otpEval.riskScore ?? 0) >= 80 &&
      otpEval.matchedRules.some((r) => r.ruleId === 'OTP_PIN_CVV_REQUEST') &&
      otpEval.matchedRules.some((r) => r.ruleId === 'ACCOUNT_SUSPENSION_ARREST_THREAT'),
    measuredOutput: `riskScore=${otpEval.riskScore}/100 (${otpEval.riskCategory}), matchedRules=${otpEval.matchedRules.length}`,
  });

  // 6. Hindi / Hinglish speech scam detection
  const hindiSample = FORENSIC_SAMPLE_PRESETS[3];
  const hindiEval = evaluateFraudRisk({ transcript: hindiSample.transcript });
  results.push({
    id: 'qa-06',
    name: 'Hindi / Hinglish OTP & Account Block Indicator Detection',
    category: 'Fraud Engine',
    passed:
      (hindiEval.riskScore ?? 0) >= 60 &&
      hindiEval.matchedRules.some((r) => r.ruleId === 'OTP_PIN_CVV_REQUEST'),
    measuredOutput: `riskScore=${hindiEval.riskScore}/100 (${hindiEval.riskCategory})`,
  });

  // 7. Harmless conversation with high distress/fear emotion (False-Positive Prevention)
  const distressedWav = parseWavBuffer(synthesizeTestWav('fearful_distressed', 6.0, 16000));
  const distressedSer = analyzeSpeechEmotionsFromPcm(distressedWav.samples, distressedWav.sampleRate);
  const harmlessDistressedEval = evaluateFraudRisk({
    transcript: FORENSIC_SAMPLE_PRESETS[2].transcript,
    emotions: distressedSer.segments,
  });
  results.push({
    id: 'qa-07',
    name: 'False-Positive Safeguard: Distressed/Fearful Speaker in Benign Call',
    category: 'Fraud Engine',
    passed:
      harmlessDistressedEval.riskScore === 0 &&
      harmlessDistressedEval.riskCategory === 'Low detected risk' &&
      harmlessDistressedEval.matchedRules.length === 0,
    measuredOutput: `riskScore=${harmlessDistressedEval.riskScore}/100 (${harmlessDistressedEval.riskCategory}), primarySER=${distressedSer.segments[0]?.primaryEmotion}`,
  });

  // 8. Missing transcript inconclusive check (never assume safety on missing evidence)
  const emptyTranscriptEval = evaluateFraudRisk({ transcript: [] });
  results.push({
    id: 'qa-08',
    name: 'Missing Transcript Evidence -> Inconclusive (Never Assumed Safe)',
    category: 'ASR & Transcript',
    passed:
      emptyTranscriptEval.riskScore === null &&
      emptyTranscriptEval.riskCategory === 'Inconclusive — additional verification required',
    measuredOutput: `riskScore=${String(emptyTranscriptEval.riskScore)}, category="${emptyTranscriptEval.riskCategory}"`,
  });

  // 9. Remote-access app & UPI collect fraud detection
  const remoteSample = FORENSIC_SAMPLE_PRESETS[1];
  const remoteEval = evaluateFraudRisk({ transcript: remoteSample.transcript });
  results.push({
    id: 'qa-09',
    name: 'Remote-Access App (AnyDesk) & UPI Collect Fraud Detection',
    category: 'Fraud Engine',
    passed:
      (remoteEval.riskScore ?? 0) >= 60 &&
      remoteEval.matchedRules.some((r) => r.ruleId === 'REMOTE_ACCESS_APP_REQUEST'),
    measuredOutput: `riskScore=${remoteEval.riskScore}/100, rules=${remoteEval.matchedRules.map((r) => r.ruleId).join(',')}`,
  });

  // 10. Calm legitimate banking call verification
  const calmSample = FORENSIC_SAMPLE_PRESETS[4];
  const calmEval = evaluateFraudRisk({ transcript: calmSample.transcript });
  results.push({
    id: 'qa-10',
    name: 'Calm Legitimate Branch Appointment -> 0 Risk Score',
    category: 'Fraud Engine',
    passed: calmEval.riskScore === 0 && calmEval.matchedRules.length === 0,
    measuredOutput: `riskScore=${calmEval.riskScore}/100, category=${calmEval.riskCategory}`,
  });

  return {
    totalChecks: results.length,
    passedChecks: results.filter((r) => r.passed).length,
    executedAt: new Date().toISOString(),
    results,
  };
}
