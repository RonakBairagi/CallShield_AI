import {
  EmotionSegment,
  FraudAssessment,
  FraudRuleId,
  FraudRuleMatch,
  RealTimeWarning,
  RiskCategory,
  RiskThresholds,
  TranscriptSegment,
} from '../types/callshield';

export interface FraudRuleDefinition {
  ruleId: FraudRuleId;
  ruleName: string;
  category: string;
  severity: 'medium' | 'high' | 'critical';
  defaultWeight: number;
  patterns: RegExp[];
  whyItMatters: string;
  safeNextStep: string;
  warningTemplate: string;
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  moderateMin: 30,
  highMin: 60,
  veryHighMin: 80,
};

export const FRAUD_RULE_CATALOG: FraudRuleDefinition[] = [
  {
    ruleId: 'OTP_PIN_CVV_REQUEST',
    ruleName: 'OTP, PIN, Password, or CVV Solicitation',
    category: 'Credential Harvesting',
    severity: 'critical',
    defaultWeight: 42,
    patterns: [
      /\b(share|tell|give|read out|confirm|verify|send|provide|enter)\b.{0,35}\b(otp|one[- ]time password|cvv|pin|mpin|upi pin|passcode|6[- ]digit code|verification code|security code)\b/i,
      /\b(otp|cvv|upi pin|atm pin|6[- ]digit code)\b.{0,30}\b(bataiye|batao|bhejo|boliye|tell me|share karo|read out)\b/i,
      /\bwhat is the (otp|verification code|6[- ]digit|cvv|pin)\b/i,
    ],
    whyItMatters:
      'Legitimate banks, government agencies, and payment providers never ask callers to read out OTPs, UPI PINs, or card CVV numbers over a call.',
    safeNextStep:
      'Never disclose OTPs, PINs, or CVV codes. Hang up immediately and call the official number printed on the back of your bank card.',
    warningTemplate:
      'Potential scam indicator detected: the speaker requested an OTP, PIN, or CVV. Never share verification codes with callers.',
  },
  {
    ruleId: 'BANKING_CREDENTIAL_DISCLOSURE',
    ruleName: 'Banking or Payment Credential Disclosure Request',
    category: 'Credential Harvesting',
    severity: 'high',
    defaultWeight: 32,
    patterns: [
      /\b(netbanking|internet banking|account password|login id|debit card number|credit card number|16[- ]digit card|expiry date|aadhaar number|pan number)\b.{0,35}\b(verify|confirm|tell|share|read|provide|bataiye)\b/i,
      /\b(confirm|tell|share|read|give)\b.{0,30}\b(full card number|16[- ]digit|netbanking password|bank login)\b/i,
    ],
    whyItMatters:
      'Soliciting complete card numbers, netbanking logins, or identity credentials over an inbound call is a primary social-engineering vector.',
    safeNextStep:
      'Do not share card details or banking logins. Verify account status only through your official banking portal.',
    warningTemplate:
      'Banking credential request detected. Do not read out card numbers or netbanking passwords.',
  },
  {
    ruleId: 'IMMEDIATE_TRANSFER_PRESSURE',
    ruleName: 'Immediate Fund Transfer or Payment Pressure',
    category: 'Coercive Financial Demand',
    severity: 'critical',
    defaultWeight: 35,
    patterns: [
      /\b(transfer|send|deposit|pay|wire|rtgs|neft|imps|upi)\b.{0,40}\b(immediately|right now|within \d+ minutes|safe account|rbi verification account|supervision account|escrow account|turant)\b/i,
      /\b(move|transfer)\b.{0,35}\b(all your funds|your savings|balance|money)\b.{0,30}\b(to this account|for verification|safe custody)\b/i,
    ],
    whyItMatters:
      'Scammers invent "RBI safe accounts" or "court verification accounts" to pressure victims into irreversibly transferring their own money.',
    safeNextStep:
      'Pause immediately. No regulatory body or police department ever asks citizens to transfer funds to a "verification" or "safe" account.',
    warningTemplate:
      'Urgent payment pressure detected. Pause and independently verify the request before moving any funds.',
  },
  {
    ruleId: 'ACCOUNT_SUSPENSION_ARREST_THREAT',
    ruleName: 'Threat of Digital Arrest, Warrant, or Account Freeze',
    category: 'Coercion & Intimidation',
    severity: 'critical',
    defaultWeight: 36,
    patterns: [
      /\b(digital arrest|arrest warrant|non[- ]bailable warrant|fir registered|money laundering case|narcotics parcel|cbi custody|freeze your bank account|block all your accounts|account will be suspended)\b/i,
      /\b(police|cbi|ed|customs|cyber crime|supreme court)\b.{0,40}\b(arrest|warrant|seize|freeze|jail|custody)\b/i,
      /\b(giraftaar|arrest warrant|bank account block|khata band)\b/i,
    ],
    whyItMatters:
      '"Digital arrest" over audio/video calls has no legal existence. Fraudsters use threats of immediate arrest or account freeze to induce panic and compliance.',
    safeNextStep:
      'Law enforcement does not conduct arrests or interrogations via phone or video calls. Disconnect and verify via the national cybercrime helpline (1930).',
    warningTemplate:
      'Coercive threat of arrest or account freeze detected. Law enforcement never conducts "digital arrests" over phone calls.',
  },
  {
    ruleId: 'AUTHORITY_IMPERSONATION',
    ruleName: 'Impersonation of Bank, Police, Customs, or Regulator',
    category: 'Deceptive Identity',
    severity: 'high',
    defaultWeight: 24,
    patterns: [
      /\b(calling from|speaking from|officer from|inspector from|representative from)\b.{0,35}\b(reserve bank|rbi|cyber cell|mumbai police|delhi police|cbi|customs department|income tax|telecom department|tra|fedex customs|sbi head office)\b/i,
      /\b(i am inspector|sub[- ]inspector|customs officer|rbi officer|cyber crime officer)\b/i,
    ],
    whyItMatters:
      'Claiming authority from RBI, Customs, Telecom (TRAI), or Police is commonly used to establish false credibility before making financial or credential demands.',
    safeNextStep:
      'Ask for the caller’s official badge/reference number and hang up. Contact the agency directly through an official government directory.',
    warningTemplate:
      'Possible authority impersonation pattern detected. Contact the organization through its official website or verified phone number.',
  },
  {
    ruleId: 'REMOTE_ACCESS_APP_REQUEST',
    ruleName: 'Remote-Access or Screen-Sharing Software Request',
    category: 'Device Compromise',
    severity: 'critical',
    defaultWeight: 40,
    patterns: [
      /\b(install|download|open|share code from)\b.{0,30}\b(anydesk|teamviewer|quicksupport|rustdesk|airdroid|screen share|remote support app|apk file)\b/i,
      /\b(anydesk|teamviewer|quicksupport|rustdesk)\b.{0,25}\b(9[- ]digit|address|code|install|download)\b/i,
    ],
    whyItMatters:
      'Remote-access tools allow attackers to view incoming SMS OTPs in real time and take full control of mobile banking apps.',
    safeNextStep:
      'Never install AnyDesk, TeamViewer, or unknown APK files at the request of an unsolicited caller. Uninstall immediately if installed.',
    warningTemplate:
      'Critical device risk: caller requested a remote-access or screen-sharing app. Do not install remote control tools.',
  },
  {
    ruleId: 'SUSPICIOUS_PAYMENT_LINK',
    ruleName: 'Suspicious Payment Link or Collect Request Trick',
    category: 'Phishing & UPI Fraud',
    severity: 'high',
    defaultWeight: 28,
    patterns: [
      /\b(click the link|open the link|tap on the upi request|approve the collect request|scan this qr code to receive money|enter pin to receive)\b/i,
      /\b(bit\.ly|tinyurl|kyc[- ]update|\.apk|refund[- ]link)\b/i,
    ],
    whyItMatters:
      'Approving a UPI collect request or scanning a QR code with a UPI PIN always deducts money—it is never required to receive funds.',
    safeNextStep:
      'Do not click links sent during a call or enter a UPI PIN to "receive" a refund or payment.',
    warningTemplate:
      'Suspicious payment link or UPI collect pattern detected. Remember: entering a UPI PIN always sends money out.',
  },
  {
    ruleId: 'BYPASS_VERIFICATION',
    ruleName: 'Instruction to Bypass Standard Verification or Bank Staff',
    category: 'Procedural Evasion',
    severity: 'high',
    defaultWeight: 26,
    patterns: [
      /\b(do not tell the bank|tell bank manager it is for family|bypass normal verification|skip security check|secret investigation|confidential rbi audit)\b/i,
    ],
    whyItMatters:
      'Instructing a citizen to conceal the reason for a transaction from bank staff is a classic indicator of coaching during an active scam.',
    safeNextStep:
      'Be completely transparent with your bank branch staff if anyone instructs you to hide the purpose of a withdrawal or transfer.',
    warningTemplate:
      'Procedural evasion detected: caller asked to bypass normal verification or conceal details from bank staff.',
  },
  {
    ruleId: 'GUARANTEED_PRIZE_REWARD',
    ruleName: 'Guaranteed Lottery, Prize, or Unsolicited Reward Claim',
    category: 'Advance-Fee / Lottery Scam',
    severity: 'medium',
    defaultWeight: 22,
    patterns: [
      /\b(won a lottery|lucky draw winner|guaranteed prize|kbc lottery|unclaimed reward of|assured 200% return)\b/i,
    ],
    whyItMatters:
      'Unsolicited prize notifications are used to entice victims into paying fraudulent "processing" or "tax" fees.',
    safeNextStep:
      'Disregard unsolicited lottery or guaranteed reward claims.',
    warningTemplate:
      'Unsolicited prize or guaranteed reward claim detected.',
  },
  {
    ruleId: 'ADVANCE_FEE_UNLOCK',
    ruleName: 'Advance Fee to Unlock Account, Parcel, or Benefit',
    category: 'Advance-Fee Fraud',
    severity: 'high',
    defaultWeight: 28,
    patterns: [
      /\b(pay|send|deposit)\b.{0,30}\b(clearance fee|customs duty|unlock fee|processing charge|refundable security deposit|release your parcel|unfreeze fee)\b/i,
    ],
    whyItMatters:
      'Demanding an upfront fee to release a detained parcel or unlock a frozen account is a hallmark of advance-fee fraud.',
    safeNextStep:
      'Do not pay upfront fees to unverified accounts to release packages or unlock accounts.',
    warningTemplate:
      'Advance-fee demand detected: caller requested payment to unlock an account or clear a parcel.',
  },
  {
    ruleId: 'PANIC_URGENCY_ESCALATION',
    ruleName: 'Artificial Time Pressure and Panic Escalation',
    category: 'Psychological Manipulation',
    severity: 'medium',
    defaultWeight: 20,
    patterns: [
      /\b(within 5 minutes|within 10 minutes|last warning|final notice|no time left|police team is leaving now|immediately or else|abhi ke abhi)\b/i,
    ],
    whyItMatters:
      'Manufactured countdowns are designed to prevent the recipient from pausing, thinking critically, or consulting a trusted person.',
    safeNextStep:
      'Take a breath and slow down. Legitimate institutions allow reasonable time to verify official notices.',
    warningTemplate:
      'High-urgency pressure tactics detected. Pause and verify independently.',
  },
  {
    ruleId: 'CALLER_CLAIM_INCONSISTENCY',
    ruleName: 'Contradictory Authority and Personal Payment Channel Claim',
    category: 'Contextual Inconsistency',
    severity: 'high',
    defaultWeight: 26,
    patterns: [
      /\b(rbi|police|customs|cbi|supreme court|bank officer)\b.{0,80}\b(whatsapp|personal upi|savings account|gpay number|paytm wallet)\b/i,
    ],
    whyItMatters:
      'Official courts, central banks, and police agencies never issue warrants over WhatsApp or collect fines into individual UPI wallets.',
    safeNextStep:
      'Treat any request combining government authority with personal messaging or UPI numbers as highly suspicious.',
    warningTemplate:
      'Inconsistency detected: official agency claim paired with personal messaging or UPI transfer request.',
  },
  {
    ruleId: 'ISOLATION_FROM_OFFICIAL_SUPPORT',
    ruleName: 'Attempt to Isolate Victim or Prevent Hanging Up',
    category: 'Isolation Tactics',
    severity: 'critical',
    defaultWeight: 34,
    patterns: [
      /\b(do not disconnect|don't hang up|stay on the line|keep camera on|do not contact anyone|do not tell your family|under surveillance|mute is not allowed)\b/i,
    ],
    whyItMatters:
      'Keeping a victim continuously on a call ("digital arrest" isolation) prevents them from verifying the hoax with family, banks, or real police.',
    safeNextStep:
      'You have the right to end the call immediately. Hang up and speak to a trusted family member or local police station.',
    warningTemplate:
      'Isolation tactic detected: caller is instructing you not to hang up or contact official support. Disconnect safely.',
  },
];

/**
 * Evaluates a conversation's transcript and acoustic metadata using transparent,
 * explainable rules and optional LLM context.
 *
 * CRITICAL ETHICAL INVARIANT:
 * Vocal emotion (Anger, Fear, Sadness, Stress/Nervousness), accent, or language
 * is NEVER treated as an independent fraud indicator. A distressed or angry speaker
 * in a benign conversation will receive a Low risk score (0).
 */
export function evaluateFraudRisk(params: {
  transcript: TranscriptSegment[];
  emotions?: EmotionSegment[];
  thresholds?: RiskThresholds;
  customRuleWeights?: Partial<Record<FraudRuleId, number>>;
  alertSensitivity?: 'conservative' | 'balanced' | 'high';
  llmContextualInsight?: {
    explanation: string;
    additionalRiskDelta?: number;
  };
}): FraudAssessment {
  const thresholds = params.thresholds || DEFAULT_RISK_THRESHOLDS;
  const sensitivityMultiplier =
    params.alertSensitivity === 'high'
      ? 1.15
      : params.alertSensitivity === 'conservative'
      ? 0.85
      : 1.0;

  const validSegments = (params.transcript || []).filter(
    (seg) => seg && seg.text && seg.text.trim().length > 0
  );

  const baseLimitations = [
    'Risk scores are provisional rule-based indicators (0–100), not statistically calibrated probabilities of criminal guilt.',
    'Speech Emotion Recognition (SER) reflects uncertain acoustic prosody cues and is never used as an independent indicator of fraud or deception.',
    'ASR transcription errors, background noise, or overlapping speakers may affect phrase matching.',
  ];

  if (validSegments.length === 0) {
    return {
      riskScore: null,
      riskCategory: 'Inconclusive — additional verification required',
      summaryExplanation:
        'Inconclusive — additional verification required. No intelligible speech transcript was available to evaluate fraud indicators. Missing audio or transcript data is never treated as evidence of safety.',
      matchedRules: [],
      warnings: [],
      recommendedActions: [
        'Ensure the audio source contains audible speech and re-run recognition.',
        'If a suspicious call occurred, do not share OTPs, PINs, or transfer funds while verifying through official channels.',
      ],
      limitations: [
        'No transcript text was available for evaluation.',
        ...baseLimitations,
      ],
      provenance: {
        asrUsed: 'No speech segments recognized',
        serUsed:
          params.emotions && params.emotions.length > 0
            ? 'Prosodic Acoustic SER Engine v1.2'
            : 'Not applicable (empty audio)',
        rulesVersion: 'CallShield Deterministic Rulebook v2.4',
        llmContextualUsed: false,
      },
      thresholdsUsed: thresholds,
    };
  }

  const matchedRules: FraudRuleMatch[] = [];
  const warnings: RealTimeWarning[] = [];
  const seenRuleIds = new Set<FraudRuleId>();

  // Evaluate each transcript segment against the rule catalog
  for (const seg of validSegments) {
    for (const rule of FRAUD_RULE_CATALOG) {
      for (const regex of rule.patterns) {
        const match = seg.text.match(regex);
        if (match) {
          if (!seenRuleIds.has(rule.ruleId)) {
            seenRuleIds.add(rule.ruleId);
            const customWeight = params.customRuleWeights?.[rule.ruleId];
            const weight = Math.round(
              (customWeight ?? rule.defaultWeight) * sensitivityMultiplier
            );

            matchedRules.push({
              ruleId: rule.ruleId,
              ruleName: rule.ruleName,
              category: rule.category,
              severity: rule.severity,
              weight,
              matchedExcerpt: seg.text.trim(),
              timestampStart: seg.startTime,
              timestampEnd: seg.endTime,
              whyItMatters: rule.whyItMatters,
              safeNextStep: rule.safeNextStep,
              derivedFrom: params.llmContextualInsight
                ? ['ASR', 'Deterministic Rules', 'Contextual LLM']
                : ['ASR', 'Deterministic Rules'],
            });

            warnings.push({
              id: `warn-${rule.ruleId}-${seg.startTime}`,
              timestamp: seg.startTime,
              level:
                rule.severity === 'critical'
                  ? 'critical'
                  : rule.severity === 'high'
                  ? 'warning'
                  : 'advisory',
              title: rule.ruleName,
              message: rule.warningTemplate,
              matchedPhrase: match[0],
              ruleId: rule.ruleId,
              limitationNote:
                'Triggered by recognized speech pattern. Verify context independently.',
            });
          }
          break;
        }
      }
    }
  }

  // Also check cross-segment context (full conversation text) for CALLER_CLAIM_INCONSISTENCY
  const fullText = validSegments.map((s) => s.text).join(' ');
  const inconsistencyRule = FRAUD_RULE_CATALOG.find(
    (r) => r.ruleId === 'CALLER_CLAIM_INCONSISTENCY'
  );
  if (inconsistencyRule && !seenRuleIds.has('CALLER_CLAIM_INCONSISTENCY')) {
    for (const regex of inconsistencyRule.patterns) {
      const m = fullText.match(regex);
      if (m) {
        seenRuleIds.add('CALLER_CLAIM_INCONSISTENCY');
        const weight = Math.round(
          (params.customRuleWeights?.CALLER_CLAIM_INCONSISTENCY ??
            inconsistencyRule.defaultWeight) *
            sensitivityMultiplier
        );
        const firstSeg = validSegments[0];
        const lastSeg = validSegments[validSegments.length - 1];
        matchedRules.push({
          ruleId: inconsistencyRule.ruleId,
          ruleName: inconsistencyRule.ruleName,
          category: inconsistencyRule.category,
          severity: inconsistencyRule.severity,
          weight,
          matchedExcerpt: m[0],
          timestampStart: firstSeg.startTime,
          timestampEnd: lastSeg.endTime,
          whyItMatters: inconsistencyRule.whyItMatters,
          safeNextStep: inconsistencyRule.safeNextStep,
          derivedFrom: ['ASR', 'Deterministic Rules'],
        });
        warnings.push({
          id: `warn-CALLER_CLAIM_INCONSISTENCY-${firstSeg.startTime}`,
          timestamp: firstSeg.startTime,
          level: 'warning',
          title: inconsistencyRule.ruleName,
          message: inconsistencyRule.warningTemplate,
          matchedPhrase: m[0],
          ruleId: inconsistencyRule.ruleId,
          limitationNote: 'Cross-segment conversational inconsistency match.',
        });
        break;
      }
    }
  }

  // Calculate raw score strictly from matched scam rules (NEVER from vocal emotion alone!)
  const rawRuleScore = matchedRules.reduce((sum, r) => sum + r.weight, 0);
  const llmDelta =
    matchedRules.length > 0 && params.llmContextualInsight?.additionalRiskDelta
      ? Math.max(-10, Math.min(15, params.llmContextualInsight.additionalRiskDelta))
      : 0;

  const riskScore = Math.max(0, Math.min(100, Math.round(rawRuleScore + llmDelta)));

  let riskCategory: RiskCategory = 'Low detected risk';
  if (riskScore >= thresholds.veryHighMin) {
    riskCategory = 'Very high detected risk';
  } else if (riskScore >= thresholds.highMin) {
    riskCategory = 'High detected risk';
  } else if (riskScore >= thresholds.moderateMin) {
    riskCategory = 'Moderate detected risk';
  }

  const highEmotionNote =
    params.emotions &&
    params.emotions.some(
      (e) =>
        (e.primaryEmotion === 'Anger' ||
          e.primaryEmotion === 'Fear' ||
          e.primaryEmotion === 'Stress / Nervousness') &&
        e.confidence >= 0.20
    );

  let summaryExplanation = '';
  if (matchedRules.length === 0) {
    summaryExplanation = highEmotionNote
      ? `No scam or fraud indicators were detected in the transcript (Risk Score: 0/100). Although acoustic analysis observed elevated vocal tension or distress cues, CallShield AI never treats vocal emotion, anger, or anxiety as an independent indicator of fraud.`
      : `No known scam or coercion indicators were detected in the analyzed transcript segments (Risk Score: ${riskScore}/100).`;
  } else {
    const ruleNames = matchedRules.map((r) => r.ruleName).join('; ');
    summaryExplanation = `Detected ${matchedRules.length} suspicious indicator(s) (${ruleNames}), resulting in a provisional score of ${riskScore}/100 (${riskCategory}).`;
    if (params.llmContextualInsight?.explanation) {
      summaryExplanation += ` Contextual analysis: ${params.llmContextualInsight.explanation}`;
    }
  }

  const recommendedActions =
    matchedRules.length > 0
      ? Array.from(new Set(matchedRules.map((r) => r.safeNextStep)))
      : [
          'No immediate scam patterns matched. Continue practicing standard call hygiene and never share OTPs or PINs.',
        ];

  return {
    riskScore,
    riskCategory,
    summaryExplanation,
    matchedRules,
    warnings,
    recommendedActions,
    limitations: baseLimitations,
    provenance: {
      asrUsed: 'CallShield ASR Pipeline (Gemini 3.5 Transcribe / Verified Transcript)',
      serUsed: 'CallShield Acoustic Prosody SER Engine v1.2',
      rulesVersion: 'CallShield Deterministic Rulebook v2.4 (13-Point Scam Taxonomy)',
      llmContextualUsed: Boolean(params.llmContextualInsight),
      llmExplanation: params.llmContextualInsight?.explanation,
    },
    thresholdsUsed: thresholds,
  };
}
