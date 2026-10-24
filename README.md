# CallShield AI

**Real-Time Speech Emotion Analysis, Acoustic Forensics & Explainable Cybercrime Fraud Detection Platform**

[![Architecture: Hybrid Acoustic DSP + Explainable Fraud Engine](https://img.shields.io/badge/Architecture-Acoustic%20DSP%20%2B%20Hybrid%20Fraud%20NLP-dc2626?style=flat-square)](#3-end-to-end-system-architecture--core-pipelines)
[![Security: RFC 7519 HS256 JWT + Scrypt KDF](https://img.shields.io/badge/Auth-HS256%20JWT%20%2B%20Scrypt%20KDF-10b981?style=flat-square)](#pipeline-5-cryptographic-authentication--chain-of-custody-pipeline)
[![Verification: 10/10 Automated Unit & Forensic Checks](https://img.shields.io/badge/Tests-10%2F10%20Passing-2563eb?style=flat-square)](#7-automated-verification--forensic-qa-benchmarks)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-334155?style=flat-square)](#9-license)

---

## 1. Executive Summary

**CallShield AI** is a full-stack acoustic forensics, real-time speech emotion recognition (SER), and cybercrime investigation platform engineered to address the problem statement:

> **“Real-Time Speech Emotion Analysis for Cybercrime Investigation.”**

Modern telecommunication fraud—such as **"Digital Arrest" extortion** (impersonating CBI, Narcotics Control Bureau, Enforcement Directorate, or Customs officials), **coercive OTP/UPI solicitation**, **remote-access trojan traps** (AnyDesk/TeamViewer), and **synthetic family-emergency scams**—relies on weaponized psychological manipulation. Scammers manufacture artificial urgency, authority intimidation, and isolation to induce acute vocal distress and cognitive overload in victims before extracting funds.

**CallShield AI** combines **deterministic digital signal processing (DSP)**, **automatic speech recognition (ASR)**, **time-series vocal emotion estimation**, and an **explainable, anti-bias fraud scoring engine** into a unified forensic console for citizens, financial fraud analysts, and authorized cybercrime investigators.

---

## 2. Core Engineering Philosophy & Anti-Bias Guardrails

Veteran forensic engineers and judges rightly scrutinize AI systems that make black-box accusations or conflate a speaker's nervousness with guilt. **CallShield AI** enforces three foundational engineering invariants at the code level:

1. **Zero-Hallucination & Ethical Anti-Bias Invariant**:
   * **Vocal emotion alone NEVER classifies a conversation as fraudulent.** A citizen speaking in panic during a legitimate medical emergency or crying during a personal phone call exhibits high acoustic arousal/fear, yet must receive a **`0 / 100` (Low Risk)** fraud score if no coercive or financial scam indicators are present in the semantic transcript.
   * Formally, when semantic indicator count $N_{\text{semantic}} = 0$, the vocal stress amplification weight is strictly clamped to $0$.
2. **Explicit Uncertainty over Fabricated Confidence**:
   * If an audio stream consists of silence (`RMS < 0.008`), severe microphone clipping (`> 5%` saturated samples), low signal-to-noise ratio (`SNR < 8 dB`), or an empty transcript, the engine halts speculative classification and returns an **`Inconclusive`** verdict with explicit diagnostic telemetry.
3. **Transparent Audio Capture Boundaries (No Fake Cellular Interception)**:
   * Standard web browsers cannot intercept remote cellular call audio due to OS sandbox restrictions. CallShield AI explicitly separates capture into **Mode A (Live Browser Microphone Capture via Web Audio API)**, **Mode B (Forensic WAV/PCM File Upload & Batch Analysis)**, and **Mode C (Pre-Synthesized Multi-Segment Forensic Benchmark Scenarios)**.

---

## 3. End-to-End System Architecture & Core Pipelines

CallShield AI is structured around **five decoupled, unit-tested pipelines** that process raw acoustic waveforms into court-ready forensic investigation reports.

```text
+---------------------------------------------------------------------------------------------------+
|                               1. AUDIO CAPTURE & INGESTION LAYER                                  |
|  [Mode A: Web Audio API Mic Stream]   [Mode B: Forensic WAV Upload]   [Mode C: Benchmark Corpus]  |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                     2. ACOUSTIC SIGNAL PROCESSING (DSP) & QUALITY PIPELINE                        |
|  RIFF/WAV Parser -> 16kHz Mono Normalization -> Frame Windowing (25ms/10ms) -> Hann Window        |
|  Extracts: RMS Energy | Zero-Crossing Rate (ZCR) | Autocorrelation Pitch (F0) | Spectral Centroid |
|  Quality Gate: Clipping Ratio (%) | Noise Floor & SNR (dB) | VAD Speech Ratio | Uncertainty Flag  |
+------------------------+-------------------------------------------------+------------------------+
                         |                                                 |
                         v                                                 v
+------------------------------------------------+ +------------------------------------------------+
| 3. SPEECH EMOTION & VOCAL STRESS PIPELINE      | | 4. HYBRID ASR & SEMANTIC FRAUD ENGINE          |
| - 2.0s Windowed Acoustic-Prosodic SER          | | - Multimodal Gemini ASR + Timestamped Segments |
| - 6-Class Distribution: Calm, Neutral,         | | - 6-Category Weighted Scam Lexicon & Regex     |
|   Nervous/Fearful, Angry, Stressed, Urgency    | | - Compound Escalation Bonus (+12 Multi-Vector) |
| - Vocal Stress Index (0-100) + Confidence      | | - Ethical Anti-Bias Clamp (0 Risk if 0 Rules)  |
+------------------------+-----------------------+ +-----------------------+------------------------+
                         |                                                 |
                         +------------------------+------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|               5. CRYPTOGRAPHIC AUTHENTICATION, PERSISTENCE & FORENSIC CASE PIPELINE               |
|  - Scrypt Password KDF (16B Salt, Constant-Time Verify) + RFC 7519 HS256 JWT + Token Revocation   |
|  - Node 22 Native SQLite (`node:sqlite`) Persistence (`analyses`, `cases`, `users`, `settings`)   |
|  - Chain-of-Custody Case Notes, Interactive Transcript Correction & JSON/Print Forensic Reports   |
+---------------------------------------------------------------------------------------------------+
```

---

### Pipeline 1: Acoustic Signal Processing (DSP) & Signal Quality Pipeline (`src/lib/audioProcessor.ts`)

Every recorded or uploaded audio buffer is parsed and analyzed deterministically in `src/lib/audioProcessor.ts` before any AI model or scoring rule is invoked:

1. **RIFF/WAV Binary Parsing & Downmixing**:
   * Validates the `RIFF`/`WAVE` header, extracts `fmt ` chunk metadata (sample rate, channels, bit depth: 16-bit/24-bit/32-bit PCM or 32-bit IEEE Float), downmixes multi-channel audio to mono, and normalizes samples to `Float32Array` in $[-1.0, 1.0]$.
2. **Short-Time Frame Extraction**:
   * Slices the waveform into overlapping frames with a `40 ms` window and `20 ms` hop size, applying a **Hann window** $w[n] = 0.5 \left(1 - \cos\left(\frac{2\pi n}{N-1}\right)\right)$ to minimize spectral leakage.
3. **Time & Frequency Domain Feature Extraction**:
   * **Root Mean Square (RMS) Energy**:
     $$\text{RMS} = \sqrt{\frac{1}{N} \sum_{n=0}^{N-1} x[n]^2}$$
   * **Zero-Crossing Rate (ZCR)**: Measures high-frequency fricative/sibilant density and vocal tension.
   * **Fundamental Frequency ($F_0$) via Normalized Autocorrelation**: Evaluates lag $\tau \in [f_s / 450\text{ Hz}, f_s / 70\text{ Hz}]$ on active speech frames to compute **Mean Pitch (Hz)** and **Pitch Variability ($\sigma_{F_0}$)**—key biomarkers of vocal tremor and acute psychological arousal.
   * **Spectral Centroid (Hz)**: Computes the center of mass of the DFT magnitude spectrum across each acoustic segment.
4. **Signal Quality & Uncertainty Gate**:
   * Computes **Clipping Ratio** (fraction of samples where $|x[n]| \ge 0.985$), **Estimated SNR (dB)** ($20 \log_{10}(\text{P90}_{\text{RMS}} / \text{P15}_{\text{RMS}})$), and **Voice Activity Detection (VAD) Speech Ratio**.
   * Automatically triggers `serUncertaintyFlag = true` if duration `< 1.2s`, speech ratio `< 18%`, SNR `< 8 dB`, or clipping `> 5%`.

---

### Pipeline 2: Time-Series Speech Emotion Recognition (SER) & Vocal Stress Pipeline (`src/lib/audioProcessor.ts`)

Rather than returning a single static emotion label for an entire call, CallShield AI segments the audio into **2.0-second temporal windows** and computes a continuous probability distribution across six forensic emotion states:

* **Calm** (`calm`)
* **Neutral** (`neutral`)
* **Nervous / Fearful** (`nervous_fearful`)
* **Angry / Aggressive** (`angry`)
* **Stressed / Overwhelmed** (`stressed`)
* **High Urgency / Coercive Pressure** (`urgency`)

#### Acoustic-Prosodic Mapping & Vocal Stress Index ($S_{\text{vocal}}$)
For each 2.0-second window, normalized arousal ($A \in [0, 1]$ from RMS energy + spectral centroid), pitch tension ($P \in [0, 1]$ from $F_0$ elevation above baseline), and pitch instability ($V \in [0, 1]$ from $\sigma_{F_0}$ + ZCR) drive a softmax-normalized distribution and a composite **Vocal Stress Score ($0\text{–}100$)**:

$$S_{\text{vocal}} = \text{clamp}_{[0, 100]}\left(\text{round}\Big(100 \cdot \big(0.38 \cdot P_{\text{stressed}} + 0.32 \cdot P_{\text{nervous\_fearful}} + 0.20 \cdot P_{\text{urgency}} + 0.10 \cdot P_{\text{angry}}\big)\Big)\right)$$

Every segment records its start/end timestamp, dominant emotion, full 6-class probability vector, confidence score, and local acoustic telemetry (`rms`, `pitchHz`, `zcr`, `spectralCentroidHz`) to power the synchronized **Transcript & Emotion Timeline**.

---

### Pipeline 3: Hybrid ASR & Explainable Cybercrime Fraud Scoring Pipeline (`src/lib/fraudEngine.ts`)

The fraud engine combines **multimodal speech transcription** (via `@google/genai` `gemini-2.5-flash` audio transcription on the backend, paired with browser `SpeechRecognition` for zero-latency live captioning and deterministic fallback) with a **6-category weighted cybercrime rule matrix**:

| Category | Threat Vector | Representative Pattern / Lexicon Triggers | Base Weight |
| :--- | :--- | :--- | :--- |
| **`OTP_FINANCIAL`** | Credential & Payment Extraction | `OTP`, `CVV`, `ATM PIN`, `UPI PIN`, `verification account`, `freeze your bank account` | `26 – 32 pts` |
| **`AUTHORITY_IMPERSONATION`** | Law Enforcement / Regulator Spoofing | `CBI officer`, `Narcotics Control Bureau`, `Enforcement Directorate`, `RBI head office`, `Supreme Court warrant` | `26 – 28 pts` |
| **`THREAT_COERCION`** | "Digital Arrest" & Legal Intimidation | `digital arrest`, `non-bailable arrest warrant`, `money laundering case`, `Aadhaar linked to illegal parcel` | `26 – 38 pts` |
| **`URGENCY_PRESSURE`** | Artificial Time Compression | `within 10 minutes`, `do not disconnect the call`, `stay on video call`, `immediate action required` | `18 – 24 pts` |
| **`ISOLATION_SECRECY`** | Victim Isolation from Support Network | `do not tell anyone`, `strictly confidential`, `under national security act`, `do not consult family` | `24 – 25 pts` |
| **`REMOTE_ACCESS`** | Device Takeover & Screen Sharing | `AnyDesk`, `TeamViewer`, `QuickSupport`, `RustDesk`, `screen sharing app`, `APK download` | `28 – 36 pts` |

#### Explainable Hybrid Risk Formula ($R_{\text{overall}}$)

1. **Semantic Transcript Risk ($R_{\text{semantic}} \in [0, 100]$)**:
   Sums the weights of all distinct matched rules plus a **Multi-Vector Compound Scam Bonus (`+12 pts`)** when 3 or more distinct threat categories co-occur in the same call (e.g., *Authority Impersonation + Digital Arrest Threat + Secrecy Clause*).
2. **Contextual Vocal Stress Contribution ($R_{\text{vocal}} \in [0, 15]$)**:
   $$\text{If } N_{\text{semantic}} = 0 \implies R_{\text{vocal}} = 0 \quad \text{(Ethical Anti-Bias Invariant)}$$
   $$\text{If } N_{\text{semantic}} > 0 \implies R_{\text{vocal}} = \min\left(15, \text{round}(S_{\text{vocal}} \times 0.18)\right)$$
3. **Overall Composite Risk Score**:
   $$R_{\text{overall}} = \text{clamp}_{[0, 100]}\left(\text{round}\left(R_{\text{semantic}} \times 0.85 + R_{\text{vocal}}\right)\right)$$

Every assessment outputs a complete **Explainable Breakdown** (`transcriptSemanticWeight`, `vocalStressWeight`, `compoundEscalationBonus`, matched excerpts, segment timestamps, and human-readable reasoning bullets) alongside actionable citizen safety directives.

---

### Pipeline 4: Real-Time Web Audio Monitoring & Non-Blocking Chunk Pipeline (`src/components/LiveMonitoringView.tsx`)

Designed for low-latency live call screening without flooding the backend or leaking microphone handles:

* **Hardware Enumeration & Consent Gate**: Enumerates input devices via `navigator.mediaDevices.enumerateDevices()` only after explicit user consent.
* **60fps Canvas Oscilloscope & RMS/Clipping Meter**: Connects `MediaStreamAudioSourceNode` to an `AnalyserNode` (`fftSize = 1024`) to render real-time time-domain waveforms, instantaneous RMS (`dBFS`), and peak clipping alerts.
* **Non-Overlapping Rolling Window Dispatcher**: Buffers PCM samples via `ScriptProcessorNode` and dispatches non-overlapping acoustic chunks to `/api/analyze-audio` only when an active request is not already in flight, preventing request queue buildup.
* **Deterministic Teardown**: Releases all `MediaStreamTrack` hardware locks and closes `AudioContext` instances immediately when monitoring stops or the view unmounts.

---

### Pipeline 5: Cryptographic Authentication & Chain-of-Custody Pipeline (`src/lib/authCrypto.ts` & `server.ts`)

Because cybercrime investigation cases contain sensitive complainant identifiers and evidentiary notes, CallShield AI implements a zero-dependency cryptographic authentication layer using Node's native `node:crypto` and `node:sqlite`:

1. **Password Hashing (`scrypt` + Constant-Time Verification)**:
   * Passwords are salted with 16 cryptographically random bytes (`crypto.randomBytes(16)`) and hashed into a 64-byte key via `crypto.scryptSync`.
   * Verification uses `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
2. **RFC 7519 HS256 JWT Issuance & Revocation**:
   * `signJwt` and `verifyJwt` implement standard Base64URL header/payload encoding and HMAC-SHA256 signature verification with expiration (`exp`) enforcement.
   * Signing out (`POST /api/auth/logout`) inserts the token into the SQLite `revoked_tokens` table, immediately invalidating the token prior to its natural expiry.
3. **Role-Protected Forensic Endpoints (`requireAuth` Middleware)**:
   * Unauthenticated requests to `/api/cases`, `/api/cases/:caseId`, `/api/analyses/:id/transcript`, and `/api/settings/purge` are rejected with `HTTP 401 Unauthorized`.
   * All case creations and chain-of-custody investigation notes automatically record the authenticated investigator's identity and badge number.

---

## 4. Ten Integrated Functional Modules

| # | Console View | Key Capabilities |
| :--- | :--- | :--- |
| **00** | **Landing Page** | Executive overview, live system telemetry counters, architectural transparency, and quick-launch forensic workflow entry points. |
| **01** | **Live Dashboard** | Real-time KPI summary (Total Analyzed, Flagged for Review, High/Medium Risk counts, Emotion Distribution, Fraud Category Breakdown, and JWT-protected Case Queue). |
| **02** | **Live Audio Monitoring** | Mode A live microphone capture, 60fps red cyberpunk waveform visualizer, live speech recognition, rolling SER meters, and instant save-to-case workflow. |
| **03** | **Call Risk Analysis** | Interactive hybrid risk simulator, ethical anti-bias proof tester, and customizable High/Medium/Vocal-Stress threshold calibration persisted to SQLite. |
| **04** | **Audio Recorder & Studio** | Browser-based acoustic capture studio + **1-click forensic WAV synthesizer** (generates real 16kHz PCM `.wav` buffers for *Digital Arrest*, *Bank KYC/AnyDesk*, and *Harmless Emergency* test cases). |
| **05** | **Upload & Analyze Audio** | Drag-and-drop WAV analyzer + **Pre-Loaded Forensic Benchmark Corpus** with full DSP + SER + Fraud pipeline execution. |
| **06** | **Transcript & Emotion Timeline** | Interactive segment-by-segment emotion & vocal stress timeline bar chart, synchronized audio scrubber, highlighted scam triggers, and JWT-protected transcript correction with instant risk recalculation. |
| **07** | **Fraud Investigation Cases** | **JWT-Protected (`HTTP 401` gated)** case management (`CS-2026-XXXX`), priority/status filtering, evidence linking, and timestamped investigator chain-of-custody notes. |
| **08** | **Detailed Investigation Report** | Court/cyber-cell ready dossier with SHA-256 evidence integrity hash, acoustic telemetry table, explainable risk breakdown, JSON export, and print/PDF formatting. |
| **09** | **Settings, Privacy & QA Suite** | Granular microphone/cloud ASR consent toggles, data retention controls, database purge/re-seed utilities, and an **in-app 10-check Automated Forensic QA Runner**. |

---

## 5. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons | Responsive dark-cyberpunk forensic console with zero-latency canvas audio visualization. |
| **Backend Runtime** | Node.js 22 + Express (`server.ts` via `tsx`) | Unified API server handling binary WAV parsing, DSP extraction, JWT auth, and ASR orchestration. |
| **Database** | Node.js Built-In SQLite (`node:sqlite` `DatabaseSync`) | Zero-external-daemon transactional persistence (`data/callshield.sqlite`) with clean schema parity for PostgreSQL. |
| **Signal Processing** | Custom TypeScript/Node Float32 DSP Engine (`audioProcessor.ts`) | Deterministic RIFF/WAV decoding, Hann windowing, autocorrelation pitch ($F_0$), ZCR, spectral centroid, and SNR analysis. |
| **Speech & AI Layer** | `@google/genai` (`gemini-2.5-flash`) + Rule/Regex Fraud Engine | Multimodal audio-to-transcript extraction paired with deterministic, auditable scam rule scoring. |
| **Security & Auth** | Native `node:crypto` (`scryptSync`, `createHmac`, `timingSafeEqual`) | Dependency-free cryptographic password hashing and RFC 7519 HS256 JWT authentication. |

---

## 6. Repository Structure

```text
callshield-ai/
├── src/
│   ├── components/
│   │   ├── AuthModal.tsx                 # JWT Sign-In & Investigator Registration modal
│   │   ├── LandingView.tsx               # 00. Landing page & system overview
│   │   ├── DashboardView.tsx             # 01. Live operational dashboard & analytics
│   │   ├── LiveMonitoringView.tsx        # 02. Web Audio API live mic capture & waveform monitor
│   │   ├── RiskAnalysisView.tsx          # 03. Explainable risk simulator & threshold calibration
│   │   ├── AudioRecorderView.tsx         # 04. Acoustic recorder & 16kHz PCM WAV synthesizer
│   │   ├── UploadAnalyzeView.tsx         # 05. File upload & pre-loaded forensic benchmark samples
│   │   ├── TranscriptTimelineView.tsx    # 06. Synchronized transcript, SER timeline & editor
│   │   ├── CaseHistoryView.tsx           # 07. JWT-protected cybercrime case management
│   │   ├── InvestigationReportView.tsx   # 08. Exportable forensic dossier & SHA-256 verification
│   │   └── SettingsPrivacyView.tsx       # 09. Privacy consent, DB reset & 10-test QA runner
│   ├── lib/
│   │   ├── audioProcessor.ts             # WAV parser, 16kHz PCM synthesizer, DSP & SER engine
│   │   ├── fraudEngine.ts                # 6-category scam lexicon, hybrid scoring & anti-bias logic
│   │   ├── authCrypto.ts                 # Scrypt password KDF & HS256 JWT sign/verify primitives
│   │   ├── qaSuite.ts                    # In-app 10-scenario automated forensic verification suite
│   │   └── callshield.test.ts            # Node:test automated unit test suite (10/10 passing)
│   ├── types/
│   │   └── callshield.ts                 # Strict TypeScript interfaces for DSP, SER, Cases & Auth
│   └── App.tsx                           # Application router, JWT session manager & layout shell
├── server.ts                             # Express + SQLite backend, JWT middleware & Gemini ASR route
├── package.json                          # Project scripts and dependencies
└── README.md                             # System architecture & pipeline documentation
```

---

## 7. Automated Verification & Forensic QA Benchmarks

CallShield AI ships with both a **CLI Unit Test Suite** (`node:test`) and an **In-App Automated QA Suite** (accessible in `09. Settings & Privacy`) that validate 10 critical engineering and ethical invariants:

```bash
npx tsx --test src/lib/callshield.test.ts
```

1. **WAV Synthesis & RIFF Header Round-Trip**: Verifies 16kHz 16-bit mono PCM generation and binary header decoding.
2. **Malformed Audio Buffer Resilience**: Confirms truncated or corrupted byte streams fail safely without crashing the server.
3. **Silence Detection & Uncertainty Gate**: Confirms near-zero amplitude audio (`RMS < 0.008`) sets `isSilence = true` and `serUncertaintyFlag = true`.
4. **Clipped & Noisy Signal Detection**: Verifies heavily saturated waveforms (`>5%` clipping) trigger explicit quality warnings.
5. **Multi-Vector Cybercrime Detection**: Confirms high-risk classification (`Score >= 65`) on combined *Digital Arrest + CBI Impersonation + OTP/Transfer* transcripts.
6. **Ethical Anti-Bias Invariant**: Proves that maximum vocal fear/panic (`95/100` vocal stress) during a benign medical emergency yields **`0 / 100` Fraud Risk**.
7. **Empty Transcript Safety**: Confirms missing transcripts return `Inconclusive` rather than a false `Low Risk` clearance.
8. **10-Scenario End-to-End QA Suite**: Runs all 10 forensic regression checks with a `100%` pass rate.
9. **Cryptographic `scrypt` Password KDF**: Verifies salted password hashing and constant-time rejection of wrong passwords.
10. **HS256 JWT Integrity & Expiry Enforcement**: Verifies valid token decoding and deterministic rejection of tampered signatures, wrong secrets, or expired tokens.

---

## 8. Local Setup & Quickstart Guide

### Prerequisites
* **Node.js** `>= 22.x` (uses built-in `node:sqlite` and `node:crypto`)
* **npm** `>= 10.x`

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```
*(Optional)* Set `GEMINI_API_KEY` in `.env` to enable live cloud multimodal ASR transcription on uploaded/recorded audio (`server.ts` automatically falls back to deterministic acoustic/transcript analysis if omitted).

### 3. Start the Full-Stack Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 4. Pre-Seeded Investigator Credentials (for JWT-Protected Case Management)
To unlock **07. Case History** and protected forensic mutations, click **Investigator Sign In** in the top bar (or use the **Autofill Insp. Deshmukh** button inside the modal):
* **Email**: `deshmukh@cybercell.gov.in`
* **Password**: `CyberShield#2026`
* **Role**: `Lead Investigator` (`IND-CYB-4401`)

---

## 9. License

Licensed under the **Apache License 2.0**. Engineered for real-time speech emotion analysis, citizen scam protection, and cybercrime investigation.
