export type MonitoringStatus =
  | 'Monitoring inactive'
  | 'Microphone permission required'
  | 'Audio source connected'
  | 'Speech detected'
  | 'Analyzing speech'
  | 'Suspicious indicators detected'
  | 'Analysis complete'
  | 'Connection error';

export type AudioSourceMode =
  | 'Mode A — Microphone Analysis'
  | 'Mode B — Uploaded or Recorded Audio'
  | 'Mode C — In-App WebRTC Voice Call'
  | 'Simulated Incoming Call (Demo Only)';

export type EmotionLabel =
  | 'Neutral'
  | 'Fear'
  | 'Anger'
  | 'Sadness'
  | 'Happiness'
  | 'Stress / Nervousness';

export type RiskCategory =
  | 'Low detected risk'
  | 'Moderate detected risk'
  | 'High detected risk'
  | 'Very high detected risk'
  | 'Inconclusive — additional verification required';

export interface AudioSignalMetrics {
  format: string;
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  rmsEnergy: number;
  peakAmplitude: number;
  clippingRatio: number;
  silenceRatio: number;
  zeroCrossingRate: number;
  estimatedPitchHz: number;
  pitchVariabilityHz: number;
  spectralCentroidHz: number;
  snrDb: number;
  isValidSpeech: boolean;
  qualityWarnings: string[];
}

export interface TranscriptSegment {
  id: string;
  speaker: 'Speaker 1' | 'Speaker 2' | 'Unknown Speaker';
  startTime: number;
  endTime: number;
  text: string;
  originalText?: string;
  confidence: number;
  lowConfidence: boolean;
  language: string;
}

export interface TranscriptEditRecord {
  id: string;
  segmentId: string;
  previousText: string;
  updatedText: string;
  editedBy: string;
  editedAt: string;
  reason: string;
}

export interface EmotionSegment {
  id: string;
  startTime: number;
  endTime: number;
  primaryEmotion: EmotionLabel;
  confidence: number;
  probabilities: Record<EmotionLabel, number>;
  uncertaintyFlag: boolean;
  uncertaintyReason?: string;
  acousticCues: {
    rms: number;
    pitchHz: number;
    zcr: number;
  };
}

export type FraudRuleId =
  | 'OTP_PIN_CVV_REQUEST'
  | 'BANKING_CREDENTIAL_DISCLOSURE'
  | 'IMMEDIATE_TRANSFER_PRESSURE'
  | 'ACCOUNT_SUSPENSION_ARREST_THREAT'
  | 'AUTHORITY_IMPERSONATION'
  | 'REMOTE_ACCESS_APP_REQUEST'
  | 'SUSPICIOUS_PAYMENT_LINK'
  | 'BYPASS_VERIFICATION'
  | 'GUARANTEED_PRIZE_REWARD'
  | 'ADVANCE_FEE_UNLOCK'
  | 'PANIC_URGENCY_ESCALATION'
  | 'CALLER_CLAIM_INCONSISTENCY'
  | 'ISOLATION_FROM_OFFICIAL_SUPPORT';

export interface FraudRuleMatch {
  ruleId: FraudRuleId;
  ruleName: string;
  category: string;
  severity: 'medium' | 'high' | 'critical';
  weight: number;
  matchedExcerpt: string;
  timestampStart: number;
  timestampEnd: number;
  whyItMatters: string;
  safeNextStep: string;
  derivedFrom: ('ASR' | 'Deterministic Rules' | 'Contextual LLM')[];
}

export interface RealTimeWarning {
  id: string;
  timestamp: number;
  level: 'advisory' | 'warning' | 'critical';
  title: string;
  message: string;
  matchedPhrase: string;
  ruleId: FraudRuleId;
  limitationNote: string;
  dismissed?: boolean;
}

export interface RiskThresholds {
  moderateMin: number; // default 30
  highMin: number;     // default 60
  veryHighMin: number; // default 80
}

export interface FraudAssessment {
  riskScore: number | null;
  riskCategory: RiskCategory;
  summaryExplanation: string;
  matchedRules: FraudRuleMatch[];
  warnings: RealTimeWarning[];
  recommendedActions: string[];
  limitations: string[];
  provenance: {
    asrUsed: string;
    serUsed: string;
    rulesVersion: string;
    llmContextualUsed: boolean;
    llmExplanation?: string;
  };
  thresholdsUsed: RiskThresholds;
}

export interface AnalysisRecord {
  id: string;
  title: string;
  createdAt: string;
  sourceMode: AudioSourceMode;
  isSimulated: boolean;
  fileName: string;
  durationSeconds: number;
  language: string;
  audioMetrics: AudioSignalMetrics;
  transcript: TranscriptSegment[];
  transcriptEdits: TranscriptEditRecord[];
  emotions: EmotionSegment[];
  emotionDistribution: Record<EmotionLabel, number>;
  fraudAssessment: FraudAssessment;
  audioDataUrl?: string;
  caseId?: string;
}

export type CaseStatus = 'Open' | 'Under Investigation' | 'Escalated' | 'Closed — Verified Scam' | 'Closed — Benign';

export interface CaseNote {
  id: string;
  author: string;
  createdAt: string;
  content: string;
}

export interface InvestigationCase {
  id: string;
  caseReference: string;
  title: string;
  status: CaseStatus;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  createdAt: string;
  updatedAt: string;
  leadInvestigator: string;
  complainantRef: string;
  summary: string;
  analysisIds: string[];
  notes: CaseNote[];
  auditLog: {
    timestamp: string;
    action: string;
    actor: string;
  }[];
}

export interface PrivacySettings {
  microphoneConsentGranted: boolean;
  cloudAsrConsentGranted: boolean;
  retentionDays: number;
  storeRawAudioOnBackend: boolean;
  alertSensitivity: 'conservative' | 'balanced' | 'high';
  thresholds: RiskThresholds;
  environmentMode: 'Demo & Hackathon Prototype' | 'Investigator Workstation';
}

export type UserRole = 'Lead Investigator' | 'Forensic Analyst' | 'Citizen User';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  badgeNumber?: string;
  createdAt: string;
}

