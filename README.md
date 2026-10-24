# CallShield AI — Real-Time Speech Emotion Analysis & Cybercrime Fraud Detection Platform

CallShield AI is a full-stack cybersecurity and acoustic forensics platform built for the problem statement: **“Real-Time Speech Emotion Analysis for Cybercrime Investigation.”**

It helps everyday citizens, potential scam victims, and cybercrime investigators detect suspicious call patterns (such as "Digital Arrest" coercion, OTP/PIN solicitation, authority impersonation, and remote-access app phishing), inspect vocal prosody and emotion cues with explicit uncertainty bounds, and manage structured forensic case files.

## Key Capabilities & Ethical Architecture

1. **Three Explicitly Separated Audio Modes**:
   - **Mode A — Microphone Analysis**: Captures browser microphone audio via `navigator.mediaDevices.getUserMedia()` and Web Audio API after explicit user consent.
   - **Mode B — Uploaded or Recorded Audio Analysis**: Inspects RIFF/WAVE and browser audio recordings with real acoustic DSP (RMS energy, Zero-Crossing Rate, autocorrelation F0 pitch, pitch jitter, spectral centroid, clipping ratio, silence ratio, and SNR).
   - **Mode C — Supported In-App WebRTC Voice Calls**: Local/peer WebRTC voice channel where both participants knowingly join and consent to real-time call screening.
   - **Native Phone Integration & Simulator**: Clearly labeled Incoming-Call Simulator and documented `/api/mobile/v1/call-event` contract for an Android `CallScreeningService` companion app. Never confuses browser microphone permission with cellular call interception.

2. **Explainable 13-Rule Fraud Risk Engine (`0–100`)**:
   - Evaluates transcripts for OTP/PIN/CVV requests, banking credential harvesting, immediate fund transfers, digital arrest threats, authority impersonation, remote-access apps (AnyDesk/TeamViewer), suspicious payment links, verification bypasses, lottery scams, advance fees, urgency escalation, claim inconsistencies, and victim isolation.
   - **Strict Anti-Bias Invariant**: Vocal emotion (`Anger`, `Fear`, `Sadness`, `Stress / Nervousness`), accent, or language is **never** used as an independent fraud indicator. Distressed or anxious speakers in benign conversations score `0/100 (Low detected risk)`.
   - Missing audio or empty transcripts return `"Inconclusive — additional verification required"`, never assuming safety.

## Running Locally

```bash
# Install dependencies
npm install

# Run automated unit tests (Node built-in test runner via tsx)
npm test

# Start the full-stack server (Express + SQLite + Vite on port 3000)
npm run dev
```

## Environment Variables (`.env`)

- `GEMINI_API_KEY`: Server-side API key used by `@google/genai` (`gemini-3.5-transcribe` for ASR and `gemini-3.8-flash` for contextual fraud explanations). Never exposed to client code.
