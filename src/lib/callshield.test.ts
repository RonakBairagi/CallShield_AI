import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeAudioSignal,
  analyzeSpeechEmotionsFromPcm,
  parseWavBuffer,
  synthesizeTestWav,
} from './audioDsp';
import { evaluateFraudRisk } from './fraudEngine';
import { FORENSIC_SAMPLE_PRESETS, runAutomatedQaSuite } from './sampleScenarios';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from './authCrypto';

test('WAV synthesis and RIFF header parsing round-trip produces valid 16kHz PCM samples', () => {
  const wavBytes = synthesizeTestWav('calm_neutral', 3.0, 16000);
  const parsed = parseWavBuffer(wavBytes);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.sampleRate, 16000);
  assert.equal(parsed.channels, 1);
  assert.equal(parsed.samples.length, 48000);
});

test('Malformed audio buffer is rejected gracefully without crashing', () => {
  const parsed = parseWavBuffer(new Uint8Array([10, 20, 30]));
  assert.equal(parsed.valid, false);
  assert.ok(parsed.error && parsed.error.includes('RIFF'));
});

test('Silence detection marks audio as non-speech and sets SER uncertainty flag', () => {
  const wavBytes = synthesizeTestWav('silent', 3.0, 16000);
  const parsed = parseWavBuffer(wavBytes);
  const metrics = analyzeAudioSignal(parsed.samples, parsed.sampleRate);
  assert.equal(metrics.isValidSpeech, false);
  assert.ok(metrics.silenceRatio >= 0.9);

  const ser = analyzeSpeechEmotionsFromPcm(parsed.samples, parsed.sampleRate);
  assert.equal(ser.segments[0].uncertaintyFlag, true);
});

test('Clipped noisy audio triggers quality warning and SER uncertainty', () => {
  const wavBytes = synthesizeTestWav('noisy_clipped', 3.0, 16000);
  const parsed = parseWavBuffer(wavBytes);
  const metrics = analyzeAudioSignal(parsed.samples, parsed.sampleRate);
  assert.ok(metrics.clippingRatio > 0.03);
  assert.ok(metrics.qualityWarnings.some((w) => w.includes('clipping')));
});

test('Fraud engine detects OTP solicitation, digital arrest coercion, and authority impersonation', () => {
  const preset = FORENSIC_SAMPLE_PRESETS[0];
  const assessment = evaluateFraudRisk({ transcript: preset.transcript });
  assert.ok((assessment.riskScore ?? 0) >= 80);
  assert.equal(assessment.riskCategory, 'Very high detected risk');
  assert.ok(assessment.matchedRules.some((r) => r.ruleId === 'OTP_PIN_CVV_REQUEST'));
  assert.ok(assessment.matchedRules.some((r) => r.ruleId === 'ACCOUNT_SUSPENSION_ARREST_THREAT'));
  assert.ok(assessment.warnings.length >= 3);
});

test('Ethical anti-bias invariant: high vocal distress/fear in a harmless conversation yields 0 fraud risk', () => {
  const distressedWav = parseWavBuffer(synthesizeTestWav('fearful_distressed', 6.0, 16000));
  const ser = analyzeSpeechEmotionsFromPcm(distressedWav.samples, distressedWav.sampleRate);
  const harmlessPreset = FORENSIC_SAMPLE_PRESETS[2];

  const assessment = evaluateFraudRisk({
    transcript: harmlessPreset.transcript,
    emotions: ser.segments,
  });

  assert.equal(assessment.riskScore, 0);
  assert.equal(assessment.riskCategory, 'Low detected risk');
  assert.equal(assessment.matchedRules.length, 0);
  assert.ok(assessment.summaryExplanation.includes('never treats vocal emotion'));
});

test('Missing or empty transcript returns Inconclusive rather than assuming safety', () => {
  const assessment = evaluateFraudRisk({ transcript: [] });
  assert.equal(assessment.riskScore, null);
  assert.equal(assessment.riskCategory, 'Inconclusive — additional verification required');
});

test('Automated QA suite executes all 10 forensic checks with 100% pass rate', () => {
  const suite = runAutomatedQaSuite();
  assert.equal(suite.totalChecks, 10);
  assert.equal(suite.passedChecks, 10);
});

test('Cryptographic scrypt password hashing and constant-time verification succeed and reject wrong passwords', () => {
  const hash = hashPassword('CyberShield#2026!');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(verifyPassword('CyberShield#2026!', hash), true);
  assert.equal(verifyPassword('WrongPassword123', hash), false);
});

test('HS256 JWT signing and verification validates authentic tokens and rejects tampered or expired tokens', () => {
  const token = signJwt(
    {
      sub: 'usr-101',
      email: 'deshmukh@cybercell.gov.in',
      name: 'Insp. R. Deshmukh',
      role: 'Lead Investigator',
      badgeNumber: 'IND-CYB-4401',
    },
    3600,
    'test-secret-key'
  );

  const verified = verifyJwt(token, 'test-secret-key');
  assert.equal(verified.valid, true);
  assert.equal(verified.payload?.email, 'deshmukh@cybercell.gov.in');
  assert.equal(verified.payload?.role, 'Lead Investigator');

  // Tamper with signature
  const tampered = token.slice(0, -4) + 'XXXX';
  const badCheck = verifyJwt(tampered, 'test-secret-key');
  assert.equal(badCheck.valid, false);

  // Wrong secret
  const wrongSecretCheck = verifyJwt(token, 'wrong-secret');
  assert.equal(wrongSecretCheck.valid, false);

  // Expired token
  const expiredToken = signJwt(
    {
      sub: 'usr-101',
      email: 'deshmukh@cybercell.gov.in',
      name: 'Insp. R. Deshmukh',
      role: 'Lead Investigator',
    },
    -10,
    'test-secret-key'
  );
  const expiredCheck = verifyJwt(expiredToken, 'test-secret-key');
  assert.equal(expiredCheck.valid, false);
  assert.ok(expiredCheck.error?.includes('expired'));
});
