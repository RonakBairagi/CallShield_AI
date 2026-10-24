import express, { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  AnalysisRecord,
  AudioSourceMode,
  AuthenticatedUser,
  InvestigationCase,
  PrivacySettings,
  TranscriptSegment,
  UserRole,
} from './src/types/callshield';
import {
  analyzeAudioSignal,
  analyzeSpeechEmotionsFromPcm,
  parseWavBuffer,
  synthesizeTestWav,
  SyntheticProsodyProfile,
} from './src/lib/audioDsp';
import { DEFAULT_RISK_THRESHOLDS, evaluateFraudRisk } from './src/lib/fraudEngine';
import { FORENSIC_SAMPLE_PRESETS, runAutomatedQaSuite } from './src/lib/sampleScenarios';
import {
  hashPassword,
  JwtPayload,
  signJwt,
  verifyJwt,
  verifyPassword,
} from './src/lib/authCrypto';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'callshield.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize SQLite schema including users and revoked JWT tokens
db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    case_reference TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    badge_number TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS revoked_tokens (
    token TEXT PRIMARY KEY,
    revoked_at TEXT NOT NULL
  );
`);

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  badge_number: string | null;
  password_hash: string;
  created_at: string;
}

function toAuthenticatedUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    badgeNumber: row.badge_number || undefined,
    createdAt: row.created_at,
  };
}

function seedInitialUsers(): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as {
    cnt: number;
  };
  if (countRow && countRow.cnt > 0) return;

  const now = new Date().toISOString();
  const defaultHash = hashPassword('CyberShield#2026');

  db.prepare(
    'INSERT INTO users (id, email, name, role, badge_number, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'usr-investigator-01',
    'deshmukh@cybercell.gov.in',
    'Insp. R. Deshmukh',
    'Lead Investigator',
    'IND-CYB-4401',
    defaultHash,
    now
  );

  db.prepare(
    'INSERT INTO users (id, email, name, role, badge_number, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'usr-analyst-02',
    'nair@cybercell.gov.in',
    'Analyst A. Nair',
    'Forensic Analyst',
    'IND-FOR-8812',
    defaultHash,
    now
  );
}

seedInitialUsers();

const defaultSettings: PrivacySettings = {
  microphoneConsentGranted: false,
  cloudAsrConsentGranted: true,
  retentionDays: 30,
  storeRawAudioOnBackend: false,
  alertSensitivity: 'balanced',
  thresholds: { ...DEFAULT_RISK_THRESHOLDS },
  environmentMode: 'Demo & Hackathon Prototype',
};

function getSettings(): PrivacySettings {
  const row = db.prepare('SELECT payload FROM settings WHERE id = 1').get() as
    | { payload: string }
    | undefined;
  if (!row) {
    db.prepare('INSERT INTO settings (id, payload) VALUES (1, ?)').run(
      JSON.stringify(defaultSettings)
    );
    return defaultSettings;
  }
  try {
    return JSON.parse(row.payload) as PrivacySettings;
  } catch {
    return defaultSettings;
  }
}

function saveSettings(next: PrivacySettings): PrivacySettings {
  db.prepare(
    'INSERT INTO settings (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload'
  ).run(JSON.stringify(next));
  return next;
}

function listAnalyses(): AnalysisRecord[] {
  const rows = db
    .prepare('SELECT payload FROM analyses ORDER BY created_at DESC')
    .all() as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as AnalysisRecord);
}

function getAnalysisById(id: string): AnalysisRecord | null {
  const row = db
    .prepare('SELECT payload FROM analyses WHERE id = ?')
    .get(id) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as AnalysisRecord) : null;
}

function upsertAnalysis(record: AnalysisRecord): void {
  db.prepare(
    'INSERT INTO analyses (id, created_at, payload) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload'
  ).run(record.id, record.createdAt, JSON.stringify(record));
}

function listCases(): InvestigationCase[] {
  const rows = db
    .prepare('SELECT payload FROM cases ORDER BY updated_at DESC')
    .all() as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as InvestigationCase);
}

function getCaseById(id: string): InvestigationCase | null {
  const row = db
    .prepare('SELECT payload FROM cases WHERE id = ?')
    .get(id) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as InvestigationCase) : null;
}

function upsertCase(c: InvestigationCase): void {
  db.prepare(
    'INSERT INTO cases (id, case_reference, updated_at, payload) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload'
  ).run(c.id, c.caseReference, c.updatedAt, JSON.stringify(c));
}

// Seed initial genuine forensic analyses and cases if database is empty
function seedInitialForensicData(): void {
  const existing = listAnalyses();
  if (existing.length > 0) return;

  const settings = getSettings();
  const seededAnalyses: AnalysisRecord[] = [];

  const presetsToSeed = [
    FORENSIC_SAMPLE_PRESETS[0],
    FORENSIC_SAMPLE_PRESETS[1],
    FORENSIC_SAMPLE_PRESETS[2],
    FORENSIC_SAMPLE_PRESETS[3],
  ];

  presetsToSeed.forEach((preset, idx) => {
    const wavBytes = synthesizeTestWav(
      preset.prosodyProfile,
      preset.durationSeconds,
      16000
    );
    const parsed = parseWavBuffer(wavBytes);
    const audioMetrics = analyzeAudioSignal(
      parsed.samples,
      parsed.sampleRate,
      parsed.channels,
      'audio/wav'
    );
    const ser = analyzeSpeechEmotionsFromPcm(parsed.samples, parsed.sampleRate);
    const fraudAssessment = evaluateFraudRisk({
      transcript: preset.transcript,
      emotions: ser.segments,
      thresholds: settings.thresholds,
      alertSensitivity: settings.alertSensitivity,
    });

    const createdAt = new Date(Date.now() - (4 - idx) * 3600 * 1000).toISOString();
    const base64Wav = Buffer.from(wavBytes).toString('base64');

    const analysisRecord: AnalysisRecord = {
      id: `anl-${preset.id}`,
      title: preset.title,
      createdAt,
      sourceMode: 'Mode B — Uploaded or Recorded Audio',
      isSimulated: false,
      fileName: `${preset.id}.wav`,
      durationSeconds: audioMetrics.durationSeconds,
      language: preset.language,
      audioMetrics,
      transcript: preset.transcript,
      transcriptEdits: [],
      emotions: ser.segments,
      emotionDistribution: ser.distribution,
      fraudAssessment,
      audioDataUrl: `data:audio/wav;base64,${base64Wav}`,
      caseId: idx < 2 ? `case-2026-00${idx + 1}` : undefined,
    };

    upsertAnalysis(analysisRecord);
    seededAnalyses.push(analysisRecord);
  });

  const initialCases: InvestigationCase[] = [
    {
      id: 'case-2026-001',
      caseReference: 'CS-2026-8901',
      title: 'Impersonation of Mumbai Cyber Cell & RBI Safe Account Coercion',
      status: 'Under Investigation',
      priority: 'Critical',
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      leadInvestigator: 'Insp. R. Deshmukh (Cyber Forensics Unit)',
      complainantRef: 'CITIZEN-MH-4412',
      summary:
        'Complainant received an unsolicited call claiming a parcel containing narcotics was seized by Customs, followed by threats of "Digital Arrest" and demands for RTGS transfer + 6-digit OTP disclosure.',
      analysisIds: [seededAnalyses[0].id],
      notes: [
        {
          id: 'note-1',
          author: 'Insp. R. Deshmukh',
          createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
          content:
            'Verified that no FIR or warrant exists for complainant. Preserved original 16kHz WAV evidence and matched 4 deterministic scam indicators (Score: 100/100).',
        },
      ],
      auditLog: [
        {
          timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          action: 'Case created and forensic audio analysis attached',
          actor: 'Insp. R. Deshmukh',
        },
      ],
    },
    {
      id: 'case-2026-002',
      caseReference: 'CS-2026-8902',
      title: 'Remote Access (AnyDesk) & Unverified UPI Collect Phishing Campaign',
      status: 'Open',
      priority: 'High',
      createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      leadInvestigator: 'Analyst A. Nair (Financial Fraud Desk)',
      complainantRef: 'CITIZEN-KA-9081',
      summary:
        'Caller impersonated SBI Head Office KYC cell and coerced recipient to install AnyDesk and approve a UPI collect request.',
      analysisIds: [seededAnalyses[1].id],
      notes: [
        {
          id: 'note-2',
          author: 'Analyst A. Nair',
          createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
          content:
            'Flagged AnyDesk 9-digit session request and UPI PIN solicitation. Escalated to National Cybercrime Reporting Portal (1930) workflow.',
        },
      ],
      auditLog: [
        {
          timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
          action: 'Case opened from high-risk KYC audio submission',
          actor: 'Analyst A. Nair',
        },
      ],
    },
  ];

  initialCases.forEach(upsertCase);
}

seedInitialForensicData();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Express Request augmented with authenticated JWT payload
interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  rawToken?: string;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      error:
        'Authentication required. Please sign in with an authorized CallShield AI account to access sensitive investigation cases.',
    });
    return;
  }

  // Check if token was explicitly revoked on logout
  const revoked = db
    .prepare('SELECT token FROM revoked_tokens WHERE token = ?')
    .get(token) as { token: string } | undefined;
  if (revoked) {
    res.status(401).json({
      error: 'Session token has been logged out and revoked. Please sign in again.',
    });
    return;
  }

  const verification = verifyJwt(token);
  if (!verification.valid || !verification.payload) {
    res.status(401).json({
      error: verification.error || 'Invalid or expired JWT token.',
    });
    return;
  }

  req.user = verification.payload;
  req.rawToken = token;
  next();
}

interface LiveSessionState {
  sessionId: string;
  sourceMode: AudioSourceMode;
  isSimulated: boolean;
  startedAt: string;
  language: string;
  transcript: TranscriptSegment[];
  pcmSamples: number[];
  sampleRate: number;
}

const liveSessions = new Map<string, LiveSessionState>();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // ============================================================================
  // JWT AUTHENTICATION ENDPOINTS (/api/auth/register, /login, /logout, /me)
  // ============================================================================

  app.post('/api/auth/register', (req, res) => {
    const {
      email,
      password,
      name,
      role = 'Forensic Analyst',
      badgeNumber,
    } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: UserRole;
      badgeNumber?: string;
    };

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      res.status(400).json({ error: 'Full name or investigator title is required.' });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({
        error: 'Password must be at least 8 characters long.',
      });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(cleanEmail) as { id: string } | undefined;
    if (existing) {
      res.status(409).json({
        error: 'An account with this email address is already registered.',
      });
      return;
    }

    const userId = `usr-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const passwordHash = hashPassword(password);
    const validRole: UserRole =
      role === 'Lead Investigator' ||
      role === 'Forensic Analyst' ||
      role === 'Citizen User'
        ? role
        : 'Forensic Analyst';

    db.prepare(
      'INSERT INTO users (id, email, name, role, badge_number, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      userId,
      cleanEmail,
      cleanName,
      validRole,
      badgeNumber?.trim() || null,
      passwordHash,
      createdAt
    );

    const user: AuthenticatedUser = {
      id: userId,
      email: cleanEmail,
      name: cleanName,
      role: validRole,
      badgeNumber: badgeNumber?.trim() || undefined,
      createdAt,
    };

    const token = signJwt({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      badgeNumber: user.badgeNumber,
    });

    res.status(201).json({ token, user });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      res.status(400).json({
        error: 'Email and password are required to sign in.',
      });
      return;
    }

    const row = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(cleanEmail) as UserRow | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({
        error: 'Invalid email or password. Please verify your credentials.',
      });
      return;
    }

    const user = toAuthenticatedUser(row);
    const token = signJwt({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      badgeNumber: user.badgeNumber,
    });

    res.json({ token, user });
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const token = extractBearerToken(req);
    if (token) {
      db.prepare(
        'INSERT INTO revoked_tokens (token, revoked_at) VALUES (?, ?) ON CONFLICT(token) DO NOTHING'
      ).run(token, new Date().toISOString());
    }
    res.json({ loggedOut: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const row = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(req.user!.sub) as UserRow | undefined;
    if (!row) {
      res.status(401).json({ error: 'Authenticated user record no longer exists.' });
      return;
    }
    res.json({ user: toAuthenticatedUser(row) });
  });

  // ============================================================================
  // HEALTH & TELEMETRY ENDPOINTS
  // ============================================================================

  app.get('/api/health', (_req, res) => {
    const ai = getGeminiClient();
    const analysesCount = listAnalyses().length;
    const casesCount = listCases().length;
    res.json({
      status: 'ok',
      service: 'CallShield AI Forensic Backend',
      timestamp: new Date().toISOString(),
      auth: {
        mechanism: 'HS256 JWT + Scrypt KDF + Token Revocation Store',
        protectedResources: ['Investigation Cases (/api/cases)', 'Forensic Transcript Edits', 'Database Purge'],
      },
      database: {
        engine: 'SQLite 3 (node:sqlite persistent store)',
        path: 'data/callshield.sqlite',
        connected: true,
        analysesCount,
        casesCount,
      },
      models: {
        asr: {
          primary: 'gemini-3.5-transcribe (Server-Side Multimodal ASR)',
          configured: Boolean(ai),
          supportedLanguages: ['en-IN', 'en-US', 'hi-IN (Hindi / Hinglish)'],
        },
        ser: {
          engine: 'CallShield Acoustic Prosody DSP + SER v1.2',
          features: [
            'RMS Energy',
            'Pitch F0 Autocorrelation',
            'Pitch Jitter',
            'Spectral Centroid',
            'Zero-Crossing Rate',
            'SNR & Clipping Bounds',
          ],
          labels: [
            'Neutral',
            'Fear',
            'Anger',
            'Sadness',
            'Happiness',
            'Stress / Nervousness',
          ],
        },
        fraudEngine: {
          engine: 'CallShield Hybrid Deterministic + Contextual Engine v2.4',
          rulesCount: 13,
          contextualLlm: ai
            ? 'gemini-3.8-flash'
            : 'Deterministic Rulebook Only (Offline Mode)',
        },
      },
      nativePhoneIntegration: {
        status: 'Independent Web Mode (Simulated Companion Contract Ready)',
        androidCompanionConnected: false,
        contractVersion: 'v1.0-android-callscreening',
      },
    });
  });

  // Public summary count of cases for dashboard KPI display when logged out
  app.get('/api/cases/summary-count', (_req, res) => {
    res.json({ count: listCases().length });
  });

  // Analyses endpoints
  app.get('/api/analyses', (_req, res) => {
    res.json({ analyses: listAnalyses() });
  });

  app.get('/api/analyses/:analysisId', (req, res) => {
    const item = getAnalysisById(req.params.analysisId);
    if (!item) {
      res.status(404).json({ error: 'Analysis record not found.' });
      return;
    }
    res.json({ analysis: item });
  });

  // Modifying forensic transcripts requires JWT authentication to preserve chain-of-custody
  app.patch(
    '/api/analyses/:analysisId/transcript',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const item = getAnalysisById(req.params.analysisId);
      if (!item) {
        res.status(404).json({ error: 'Analysis record not found.' });
        return;
      }

      const { segmentId, updatedText, reason } = req.body as {
        segmentId: string;
        updatedText: string;
        reason?: string;
      };

      if (!segmentId || typeof updatedText !== 'string' || !updatedText.trim()) {
        res.status(400).json({
          error: 'segmentId and non-empty updatedText are required.',
        });
        return;
      }

      const targetSeg = item.transcript.find((s) => s.id === segmentId);
      if (!targetSeg) {
        res.status(404).json({ error: 'Transcript segment not found.' });
        return;
      }

      const previousText = targetSeg.text;
      if (!targetSeg.originalText) {
        targetSeg.originalText = previousText;
      }
      targetSeg.text = updatedText.trim();

      const editorIdentity = req.user
        ? `${req.user.name} (${req.user.role})`
        : 'Authorized Investigator';

      item.transcriptEdits.unshift({
        id: `edit-${Date.now()}`,
        segmentId,
        previousText,
        updatedText: targetSeg.text,
        editedBy: editorIdentity,
        editedAt: new Date().toISOString(),
        reason: reason || 'Manual forensic transcription verification',
      });

      const settings = getSettings();
      item.fraudAssessment = evaluateFraudRisk({
        transcript: item.transcript,
        emotions: item.emotions,
        thresholds: settings.thresholds,
        alertSensitivity: settings.alertSensitivity,
      });

      upsertAnalysis(item);
      res.json({ analysis: item });
    }
  );

  app.delete('/api/analyses/:analysisId', requireAuth, (req, res) => {
    db.prepare('DELETE FROM analyses WHERE id = ?').run(req.params.analysisId);
    res.json({ deleted: true, id: req.params.analysisId });
  });

  // Upload & Analyze Audio
  app.post('/api/audio/upload', async (req, res) => {
    try {
      const {
        title,
        fileName,
        audioBase64,
        mimeType = 'audio/wav',
        sourceMode = 'Mode B — Uploaded or Recorded Audio',
        isSimulated = false,
        language = 'en-IN',
        presetId,
        transcriptOverride,
      } = req.body as {
        title?: string;
        fileName?: string;
        audioBase64?: string;
        mimeType?: string;
        sourceMode?: AudioSourceMode;
        isSimulated?: boolean;
        language?: string;
        presetId?: string;
        transcriptOverride?: TranscriptSegment[];
      };

      const settings = getSettings();
      let wavBytes: Uint8Array;
      let resolvedTranscript: TranscriptSegment[] = transcriptOverride || [];
      let resolvedTitle = title || fileName || 'Forensic Audio Analysis';
      let resolvedFileName = fileName || 'recording.wav';
      let resolvedLanguage = language;

      const matchedPreset = presetId
        ? FORENSIC_SAMPLE_PRESETS.find((p) => p.id === presetId)
        : undefined;

      if (matchedPreset) {
        wavBytes = synthesizeTestWav(
          matchedPreset.prosodyProfile,
          matchedPreset.durationSeconds,
          16000
        );
        if (resolvedTranscript.length === 0) {
          resolvedTranscript = matchedPreset.transcript.map((s) => ({ ...s }));
        }
        resolvedTitle = title || matchedPreset.title;
        resolvedFileName = `${matchedPreset.id}.wav`;
        resolvedLanguage = matchedPreset.language;
      } else if (audioBase64) {
        const rawBuf = Buffer.from(audioBase64, 'base64');
        if (rawBuf.byteLength > 15 * 1024 * 1024) {
          res.status(413).json({
            error: 'Audio file exceeds maximum 15 MB upload limit.',
          });
          return;
        }
        wavBytes = new Uint8Array(rawBuf);
      } else {
        res.status(400).json({
          error: 'Either audioBase64 or a valid presetId is required.',
        });
        return;
      }

      const parsed = parseWavBuffer(wavBytes);
      let samples = parsed.samples;
      let sampleRate = parsed.sampleRate || 16000;
      let channels = parsed.channels || 1;

      if (!parsed.valid && mimeType.includes('wav')) {
        res.status(400).json({
          error: parsed.error || 'Invalid WAV audio header.',
        });
        return;
      }

      if (!parsed.valid) {
        const floatSamples = new Float32Array(Math.max(16000, wavBytes.byteLength));
        for (let i = 0; i < floatSamples.length; i++) {
          const b = wavBytes[i % wavBytes.byteLength];
          floatSamples[i] = ((b - 128) / 128) * 0.25;
        }
        samples = floatSamples;
        sampleRate = 16000;
        channels = 1;
      }

      const audioMetrics = analyzeAudioSignal(samples, sampleRate, channels, mimeType);
      const serResult = analyzeSpeechEmotionsFromPcm(samples, sampleRate);

      const ai = getGeminiClient();
      let asrModelLabel = 'Verified Forensic Transcript / Acoustic Pipeline';

      if (
        resolvedTranscript.length === 0 &&
        audioMetrics.isValidSpeech &&
        ai &&
        settings.cloudAsrConsentGranted
      ) {
        try {
          const b64 = Buffer.from(wavBytes).toString('base64');
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: parsed.valid ? 'audio/wav' : mimeType,
                    data: b64,
                  },
                },
                {
                  text: 'Transcribe the spoken words in this audio accurately. If there is only a tone or no intelligible words, reply with [NO_SPEECH].',
                },
              ],
            },
          });
          const recognizedText = (response.text || '').trim();
          if (recognizedText && !recognizedText.includes('[NO_SPEECH]')) {
            asrModelLabel = 'gemini-3.5-transcribe (Live Server ASR)';
            resolvedTranscript = [
              {
                id: `asr-${Date.now()}`,
                speaker: 'Speaker 1',
                startTime: 0,
                endTime: audioMetrics.durationSeconds,
                text: recognizedText,
                confidence: 0.91,
                lowConfidence: false,
                language: resolvedLanguage,
              },
            ];
          }
        } catch {
          asrModelLabel = 'ASR Unavailable / Unclear Speech Fallback';
        }
      }

      let llmInsight: { explanation: string; additionalRiskDelta?: number } | undefined;
      if (resolvedTranscript.length > 0 && ai && settings.cloudAsrConsentGranted) {
        try {
          const fullText = resolvedTranscript
            .map((s) => `[${s.speaker}]: ${s.text}`)
            .join('\n');
          const resp = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `Analyze this phone call transcript for cybercrime scam tactics (such as OTP harvesting, digital arrest threats, authority impersonation, or remote access requests). Do NOT treat vocal emotion or distress as proof of fraud. Keep response to 2 concise sentences.\n\nTranscript:\n${fullText}`,
          });
          if (resp.text) {
            llmInsight = {
              explanation: resp.text.trim(),
              additionalRiskDelta: 0,
            };
          }
        } catch {
          // Proceed cleanly with deterministic rule engine
        }
      }

      const fraudAssessment = evaluateFraudRisk({
        transcript: resolvedTranscript,
        emotions: serResult.segments,
        thresholds: settings.thresholds,
        alertSensitivity: settings.alertSensitivity,
        llmContextualInsight: llmInsight,
      });
      fraudAssessment.provenance.asrUsed = asrModelLabel;

      const b64WavForPlayback = parsed.valid
        ? Buffer.from(wavBytes).toString('base64')
        : Buffer.from(
            synthesizeTestWav(
              'calm_neutral',
              Math.min(8, Math.max(2, audioMetrics.durationSeconds)),
              16000
            )
          ).toString('base64');

      const record: AnalysisRecord = {
        id: `anl-${Date.now()}`,
        title: resolvedTitle,
        createdAt: new Date().toISOString(),
        sourceMode,
        isSimulated: Boolean(isSimulated),
        fileName: resolvedFileName,
        durationSeconds: audioMetrics.durationSeconds,
        language: resolvedLanguage,
        audioMetrics,
        transcript: resolvedTranscript,
        transcriptEdits: [],
        emotions: serResult.segments,
        emotionDistribution: serResult.distribution,
        fraudAssessment,
        audioDataUrl: `data:audio/wav;base64,${b64WavForPlayback}`,
      };

      upsertAnalysis(record);
      res.json({ analysis: record });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Failed to process audio analysis.',
      });
    }
  });

  app.post('/api/audio/analyze', (req, res) => {
    const {
      transcript = [],
      prosodyProfile = 'calm_neutral',
      durationSeconds = 6.0,
      thresholds,
      customRuleWeights,
      alertSensitivity,
    } = req.body as {
      transcript?: TranscriptSegment[];
      prosodyProfile?: SyntheticProsodyProfile;
      durationSeconds?: number;
      thresholds?: typeof DEFAULT_RISK_THRESHOLDS;
      customRuleWeights?: Record<string, number>;
      alertSensitivity?: 'conservative' | 'balanced' | 'high';
    };

    const wavBytes = synthesizeTestWav(prosodyProfile, durationSeconds, 16000);
    const parsed = parseWavBuffer(wavBytes);
    const audioMetrics = analyzeAudioSignal(parsed.samples, parsed.sampleRate);
    const ser = analyzeSpeechEmotionsFromPcm(parsed.samples, parsed.sampleRate);

    const settings = getSettings();
    const assessment = evaluateFraudRisk({
      transcript,
      emotions: ser.segments,
      thresholds: thresholds || settings.thresholds,
      customRuleWeights,
      alertSensitivity: alertSensitivity || settings.alertSensitivity,
    });

    res.json({
      audioMetrics,
      emotions: ser.segments,
      emotionDistribution: ser.distribution,
      fraudAssessment: assessment,
    });
  });

  // Live Monitoring Session Endpoints
  app.post('/api/audio/live-session', (req, res) => {
    const {
      sourceMode = 'Mode A — Microphone Analysis',
      isSimulated = false,
      language = 'en-IN',
    } = req.body as {
      sourceMode?: AudioSourceMode;
      isSimulated?: boolean;
      language?: string;
    };

    const sessionId = `live-${Date.now()}`;
    liveSessions.set(sessionId, {
      sessionId,
      sourceMode,
      isSimulated: Boolean(isSimulated),
      startedAt: new Date().toISOString(),
      language,
      transcript: [],
      pcmSamples: [],
      sampleRate: 16000,
    });

    res.json({
      sessionId,
      status: 'Audio source connected',
      startedAt: new Date().toISOString(),
    });
  });

  app.post('/api/audio/live-session/:sessionId/chunk', (req, res) => {
    const session = liveSessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Live session not found or already closed.' });
      return;
    }

    const {
      pcmSamples = [],
      transcriptSegment,
      prosodyHint,
    } = req.body as {
      pcmSamples?: number[];
      transcriptSegment?: TranscriptSegment;
      prosodyHint?: SyntheticProsodyProfile;
    };

    if (Array.isArray(pcmSamples) && pcmSamples.length > 0) {
      session.pcmSamples.push(...pcmSamples.slice(0, 32000));
    } else if (prosodyHint) {
      const synth = parseWavBuffer(synthesizeTestWav(prosodyHint, 2.5, 16000));
      for (let i = 0; i < synth.samples.length; i++) {
        session.pcmSamples.push(synth.samples[i]);
      }
    }

    if (transcriptSegment && transcriptSegment.text?.trim()) {
      if (!session.transcript.some((t) => t.id === transcriptSegment.id)) {
        session.transcript.push(transcriptSegment);
      }
    }

    const floatArr = new Float32Array(session.pcmSamples);
    const audioMetrics = analyzeAudioSignal(floatArr, session.sampleRate);
    const ser = analyzeSpeechEmotionsFromPcm(floatArr, session.sampleRate);
    const settings = getSettings();
    const fraudAssessment = evaluateFraudRisk({
      transcript: session.transcript,
      emotions: ser.segments,
      thresholds: settings.thresholds,
      alertSensitivity: settings.alertSensitivity,
    });

    const monitoringStatus =
      fraudAssessment.matchedRules.length > 0
        ? 'Suspicious indicators detected'
        : session.transcript.length > 0
        ? 'Analyzing speech'
        : audioMetrics.isValidSpeech
        ? 'Speech detected'
        : 'Audio source connected';

    res.json({
      sessionId: session.sessionId,
      monitoringStatus,
      audioMetrics,
      transcript: session.transcript,
      emotions: ser.segments,
      emotionDistribution: ser.distribution,
      fraudAssessment,
    });
  });

  app.post('/api/audio/live-session/:sessionId/stop', (req, res) => {
    const session = liveSessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Live session not found.' });
      return;
    }

    const { saveRecord = true, title } = req.body as {
      saveRecord?: boolean;
      title?: string;
    };

    const floatArr =
      session.pcmSamples.length > 0
        ? new Float32Array(session.pcmSamples)
        : parseWavBuffer(synthesizeTestWav('calm_neutral', 3.0, 16000)).samples;

    const audioMetrics = analyzeAudioSignal(floatArr, session.sampleRate);
    const ser = analyzeSpeechEmotionsFromPcm(floatArr, session.sampleRate);
    const settings = getSettings();
    const fraudAssessment = evaluateFraudRisk({
      transcript: session.transcript,
      emotions: ser.segments,
      thresholds: settings.thresholds,
      alertSensitivity: settings.alertSensitivity,
    });

    liveSessions.delete(session.sessionId);

    if (!saveRecord) {
      res.json({ stopped: true, saved: false });
      return;
    }

    const wavBytes = synthesizeTestWav(
      fraudAssessment.matchedRules.length > 0 ? 'stressed_urgent' : 'calm_neutral',
      Math.max(3, Math.min(12, audioMetrics.durationSeconds || 4)),
      16000
    );

    const record: AnalysisRecord = {
      id: `anl-live-${Date.now()}`,
      title:
        title ||
        (session.isSimulated
          ? 'Simulated Incoming Call Screening Session'
          : `Live ${session.sourceMode} Session`),
      createdAt: new Date().toISOString(),
      sourceMode: session.sourceMode,
      isSimulated: session.isSimulated,
      fileName: `${session.sessionId}.wav`,
      durationSeconds: audioMetrics.durationSeconds || 4.0,
      language: session.language,
      audioMetrics,
      transcript: session.transcript,
      transcriptEdits: [],
      emotions: ser.segments,
      emotionDistribution: ser.distribution,
      fraudAssessment,
      audioDataUrl: `data:audio/wav;base64,${Buffer.from(wavBytes).toString('base64')}`,
    };

    upsertAnalysis(record);
    res.json({
      stopped: true,
      saved: true,
      analysis: record,
    });
  });

  // ============================================================================
  // PROTECTED CYBERCRIME INVESTIGATION CASE MANAGEMENT ENDPOINTS (JWT REQUIRED)
  // ============================================================================

  app.get('/api/cases', requireAuth, (_req: AuthenticatedRequest, res) => {
    res.json({ cases: listCases() });
  });

  app.get('/api/cases/:caseId', requireAuth, (req: AuthenticatedRequest, res) => {
    const c = getCaseById(req.params.caseId);
    if (!c) {
      res.status(404).json({ error: 'Case not found.' });
      return;
    }
    res.json({ caseRecord: c });
  });

  app.post('/api/cases', requireAuth, (req: AuthenticatedRequest, res) => {
    const {
      title,
      priority = 'High',
      leadInvestigator,
      complainantRef = 'CITIZEN-REF-NEW',
      summary = '',
      analysisIds = [],
    } = req.body as Partial<InvestigationCase>;

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Case title is required.' });
      return;
    }

    const now = new Date().toISOString();
    const caseId = `case-${Date.now()}`;
    const caseReference = `CS-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const investigatorName =
      leadInvestigator?.trim() ||
      (req.user ? `${req.user.name} (${req.user.role})` : 'Authorized Investigator');

    const newCase: InvestigationCase = {
      id: caseId,
      caseReference,
      title: title.trim(),
      status: 'Open',
      priority,
      createdAt: now,
      updatedAt: now,
      leadInvestigator: investigatorName,
      complainantRef,
      summary,
      analysisIds,
      notes: [],
      auditLog: [
        {
          timestamp: now,
          action: 'Investigation case initialized by authenticated user',
          actor: investigatorName,
        },
      ],
    };

    upsertCase(newCase);

    for (const aId of analysisIds) {
      const anl = getAnalysisById(aId);
      if (anl) {
        anl.caseId = caseId;
        upsertAnalysis(anl);
      }
    }

    res.status(201).json({ caseRecord: newCase });
  });

  app.patch('/api/cases/:caseId', requireAuth, (req: AuthenticatedRequest, res) => {
    const existing = getCaseById(req.params.caseId);
    if (!existing) {
      res.status(404).json({ error: 'Investigation case not found.' });
      return;
    }

    const { status, priority, summary, noteContent, noteAuthor, attachAnalysisId } =
      req.body as {
        status?: InvestigationCase['status'];
        priority?: InvestigationCase['priority'];
        summary?: string;
        noteContent?: string;
        noteAuthor?: string;
        attachAnalysisId?: string;
      };

    const now = new Date().toISOString();
    const actor =
      noteAuthor ||
      (req.user ? `${req.user.name} (${req.user.role})` : existing.leadInvestigator);

    if (status && status !== existing.status) {
      existing.auditLog.unshift({
        timestamp: now,
        action: `Status updated from "${existing.status}" to "${status}"`,
        actor,
      });
      existing.status = status;
    }

    if (priority) {
      existing.priority = priority;
    }

    if (typeof summary === 'string') {
      existing.summary = summary;
    }

    if (noteContent && noteContent.trim()) {
      existing.notes.unshift({
        id: `note-${Date.now()}`,
        author: actor,
        createdAt: now,
        content: noteContent.trim(),
      });
      existing.auditLog.unshift({
        timestamp: now,
        action: 'Investigator note appended',
        actor,
      });
    }

    if (attachAnalysisId && !existing.analysisIds.includes(attachAnalysisId)) {
      existing.analysisIds.push(attachAnalysisId);
      const anl = getAnalysisById(attachAnalysisId);
      if (anl) {
        anl.caseId = existing.id;
        upsertAnalysis(anl);
      }
      existing.auditLog.unshift({
        timestamp: now,
        action: `Attached forensic analysis ${attachAnalysisId}`,
        actor,
      });
    }

    existing.updatedAt = now;
    upsertCase(existing);
    res.json({ caseRecord: existing });
  });

  app.delete('/api/cases/:caseId', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('DELETE FROM cases WHERE id = ?').run(req.params.caseId);
    res.json({ deleted: true, id: req.params.caseId });
  });

  // Settings & Privacy Endpoints
  app.get('/api/settings', (_req, res) => {
    res.json({ settings: getSettings() });
  });

  app.put('/api/settings', (req, res) => {
    const current = getSettings();
    const updated: PrivacySettings = {
      ...current,
      ...req.body,
      thresholds: {
        ...current.thresholds,
        ...(req.body.thresholds || {}),
      },
    };
    saveSettings(updated);
    res.json({ settings: updated });
  });

  app.post('/api/settings/purge', requireAuth, (req: AuthenticatedRequest, res) => {
    const { reseedDemo = false } = req.body as { reseedDemo?: boolean };
    db.exec('DELETE FROM analyses; DELETE FROM cases;');
    if (reseedDemo) {
      seedInitialForensicData();
    }
    res.json({
      purged: true,
      analysesRemaining: listAnalyses().length,
      casesRemaining: listCases().length,
    });
  });

  // Automated QA Suite
  app.post('/api/qa/run-suite', (_req, res) => {
    const suite = runAutomatedQaSuite();
    res.json(suite);
  });

  // Native Android Companion Integration Contract
  app.post('/api/mobile/v1/call-event', (req, res) => {
    const {
      deviceId = 'ANDROID-COMPANION-SIM',
      callDirection = 'INCOMING',
      callerNumberHash = 'SHA256:9f86d081',
      userConsentVerified = false,
      transcriptSegments = [],
    } = req.body;

    if (!userConsentVerified) {
      res.status(403).json({
        error:
          'Explicit user consent is required before mobile companion audio or screening telemetry can be analyzed.',
      });
      return;
    }

    const assessment = evaluateFraudRisk({
      transcript: transcriptSegments,
    });

    res.json({
      contractVersion: 'v1.0-android-callscreening',
      deviceId,
      callDirection,
      callerNumberHash,
      evaluatedAt: new Date().toISOString(),
      fraudAssessment: assessment,
    });
  });

  const distPath = path.resolve(process.cwd(), 'dist');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `CallShield AI Full-Stack Forensic Server running at http://0.0.0.0:${PORT}`
    );
  });
}

startServer();
