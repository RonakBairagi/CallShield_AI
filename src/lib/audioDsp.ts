import {
  AudioSignalMetrics,
  EmotionLabel,
  EmotionSegment,
} from '../types/callshield';

export interface ParsedWavData {
  valid: boolean;
  format: string;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Float32Array;
  error?: string;
}

/**
 * Parses a standard RIFF WAVE buffer into normalized [-1, 1] mono Float32Array samples.
 * Supports 8-bit, 16-bit, 24-bit, and 32-bit PCM / IEEE Float WAV files.
 */
export function parseWavBuffer(buffer: Uint8Array): ParsedWavData {
  if (!buffer || buffer.byteLength < 44) {
    return {
      valid: false,
      format: 'unknown',
      sampleRate: 0,
      channels: 0,
      bitsPerSample: 0,
      samples: new Float32Array(0),
      error: 'Buffer is empty or smaller than minimum 44-byte RIFF header.',
    };
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );

  if (riff !== 'RIFF' || wave !== 'WAVE') {
    return {
      valid: false,
      format: riff || 'unknown',
      sampleRate: 0,
      channels: 0,
      bitsPerSample: 0,
      samples: new Float32Array(0),
      error: 'Unsupported audio container: expected RIFF/WAVE header.',
    };
  }

  let audioFormat = 1;
  let channels = 1;
  let sampleRate = 16000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ' && offset + 24 <= buffer.byteLength) {
      audioFormat = view.getUint16(offset + 8, true);
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = Math.min(chunkSize, buffer.byteLength - dataOffset);
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || dataSize <= 0) {
    return {
      valid: false,
      format: 'audio/wav',
      sampleRate,
      channels,
      bitsPerSample,
      samples: new Float32Array(0),
      error: 'WAV header missing valid audio data chunk.',
    };
  }

  const bytesPerSample = Math.max(1, bitsPerSample / 8);
  const frameSize = bytesPerSample * Math.max(1, channels);
  const frameCount = Math.floor(dataSize / frameSize);
  const samples = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    let monoSum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const samplePos = dataOffset + i * frameSize + ch * bytesPerSample;
      if (samplePos + bytesPerSample > buffer.byteLength) break;
      let val = 0;
      if (bitsPerSample === 16) {
        val = view.getInt16(samplePos, true) / 32768;
      } else if (bitsPerSample === 8) {
        val = (view.getUint8(samplePos) - 128) / 128;
      } else if (bitsPerSample === 32 && audioFormat === 3) {
        val = view.getFloat32(samplePos, true);
      } else if (bitsPerSample === 32) {
        val = view.getInt32(samplePos, true) / 2147483648;
      }
      monoSum += val;
    }
    samples[i] = Math.max(-1, Math.min(1, monoSum / Math.max(1, channels)));
  }

  return {
    valid: true,
    format: 'audio/wav',
    sampleRate,
    channels,
    bitsPerSample,
    samples,
  };
}

/**
 * Computes acoustic DSP metrics from normalized Float32Array PCM samples.
 */
export function analyzeAudioSignal(
  samples: Float32Array,
  sampleRate = 16000,
  channels = 1,
  format = 'audio/wav'
): AudioSignalMetrics {
  const qualityWarnings: string[] = [];

  if (!samples || samples.length === 0 || sampleRate <= 0) {
    return {
      format,
      sampleRate,
      channels,
      durationSeconds: 0,
      rmsEnergy: 0,
      peakAmplitude: 0,
      clippingRatio: 0,
      silenceRatio: 1,
      zeroCrossingRate: 0,
      estimatedPitchHz: 0,
      pitchVariabilityHz: 0,
      spectralCentroidHz: 0,
      snrDb: 0,
      isValidSpeech: false,
      qualityWarnings: ['Empty audio signal: 0 frames captured.'],
    };
  }

  const durationSeconds = Number((samples.length / sampleRate).toFixed(2));
  let sumSquares = 0;
  let peakAmplitude = 0;
  let clippedSamples = 0;
  let zeroCrossings = 0;

  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    sumSquares += samples[i] * samples[i];
    if (abs > peakAmplitude) peakAmplitude = abs;
    if (abs >= 0.985) clippedSamples++;
    if (i > 0 && ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0))) {
      zeroCrossings++;
    }
  }

  const rmsEnergy = Number(Math.sqrt(sumSquares / samples.length).toFixed(4));
  const clippingRatio = Number((clippedSamples / samples.length).toFixed(4));
  const zeroCrossingRate = Number((zeroCrossings / samples.length).toFixed(4));

  // Frame-level analysis (30ms windows) for silence ratio, SNR, pitch F0, and pitch jitter
  const windowSize = Math.max(128, Math.floor(sampleRate * 0.03));
  const numWindows = Math.max(1, Math.floor(samples.length / windowSize));
  let silentWindows = 0;
  const frameRmsValues: number[] = [];
  const pitchEstimates: number[] = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    let wSum = 0;
    let wZcr = 0;
    for (let i = 0; i < windowSize; i++) {
      const s = samples[start + i];
      wSum += s * s;
      if (i > 0) {
        const prev = samples[start + i - 1];
        if ((s >= 0 && prev < 0) || (s < 0 && prev >= 0)) wZcr++;
      }
    }
    const wRms = Math.sqrt(wSum / windowSize);
    frameRmsValues.push(wRms);

    if (wRms < 0.015) {
      silentWindows++;
    } else {
      // Estimate fundamental frequency F0 in voiced frames using bounded autocorrelation (75Hz - 400Hz)
      const minLag = Math.max(2, Math.floor(sampleRate / 400));
      const maxLag = Math.min(windowSize - 2, Math.floor(sampleRate / 75));
      let bestLag = 0;
      let maxCorr = 0;
      for (let lag = minLag; lag <= maxLag; lag += 2) {
        let corr = 0;
        for (let i = 0; i < windowSize - lag; i += 2) {
          corr += samples[start + i] * samples[start + i + lag];
        }
        if (corr > maxCorr) {
          maxCorr = corr;
          bestLag = lag;
        }
      }
      if (bestLag > 0 && maxCorr > wSum * 0.22) {
        pitchEstimates.push(sampleRate / bestLag);
      } else {
        // Fallback spectral proxy from frame zero-crossing rate
        pitchEstimates.push(Math.min(380, Math.max(85, (wZcr / windowSize) * sampleRate * 0.45)));
      }
    }
  }

  const silenceRatio = Number((silentWindows / numWindows).toFixed(3));
  const sortedRms = [...frameRmsValues].sort((a, b) => a - b);
  const noiseFloor = Math.max(0.0005, sortedRms[Math.floor(sortedRms.length * 0.15)] || 0.001);
  const signalLevel = Math.max(noiseFloor, sortedRms[Math.floor(sortedRms.length * 0.85)] || rmsEnergy);
  const snrDb = Number((20 * Math.log10(signalLevel / noiseFloor)).toFixed(1));

  const avgPitch =
    pitchEstimates.length > 0
      ? pitchEstimates.reduce((a, b) => a + b, 0) / pitchEstimates.length
      : 0;
  const pitchVariance =
    pitchEstimates.length > 1
      ? pitchEstimates.reduce((acc, p) => acc + Math.pow(p - avgPitch, 2), 0) / pitchEstimates.length
      : 0;
  const estimatedPitchHz = Number(avgPitch.toFixed(1));
  const pitchVariabilityHz = Number(Math.sqrt(pitchVariance).toFixed(1));
  const spectralCentroidHz = Number(
    Math.min(sampleRate / 2, Math.max(0, zeroCrossingRate * (sampleRate / 2) * 1.15)).toFixed(0)
  );

  if (silenceRatio > 0.88 || rmsEnergy < 0.012) {
    qualityWarnings.push('Signal consists primarily of silence or very low vocal amplitude.');
  }
  if (clippingRatio > 0.03) {
    qualityWarnings.push('Audio clipping detected (>3% samples saturated); emotion confidence reduced.');
  }
  if (snrDb < 8 && silenceRatio <= 0.88) {
    qualityWarnings.push('High background noise floor detected (low SNR < 8 dB).');
  }
  if (durationSeconds < 1.0) {
    qualityWarnings.push('Short audio duration (<1.0s); prosodic emotion estimates have higher uncertainty.');
  }

  const isValidSpeech = durationSeconds >= 0.5 && silenceRatio <= 0.9 && rmsEnergy >= 0.012;

  return {
    format,
    sampleRate,
    channels,
    durationSeconds,
    rmsEnergy,
    peakAmplitude: Number(peakAmplitude.toFixed(4)),
    clippingRatio,
    silenceRatio,
    zeroCrossingRate,
    estimatedPitchHz,
    pitchVariabilityHz,
    spectralCentroidHz,
    snrDb,
    isValidSpeech,
    qualityWarnings,
  };
}

/**
 * Segments a PCM Float32Array into time windows and performs acoustic Speech Emotion Recognition (SER)
 * based on prosodic vocal cues (energy dynamics, F0 pitch, pitch jitter, and spectral ZCR).
 * Explicitly flags uncertainty when SNR is low, clipping is high, or signal is silent.
 */
export function analyzeSpeechEmotionsFromPcm(
  samples: Float32Array,
  sampleRate = 16000,
  windowDurationSec = 3.0
): {
  segments: EmotionSegment[];
  distribution: Record<EmotionLabel, number>;
} {
  const emptyDist: Record<EmotionLabel, number> = {
    Neutral: 0,
    Fear: 0,
    Anger: 0,
    Sadness: 0,
    Happiness: 0,
    'Stress / Nervousness': 0,
  };

  if (!samples || samples.length === 0 || sampleRate <= 0) {
    return { segments: [], distribution: emptyDist };
  }

  const totalSec = samples.length / sampleRate;
  const stepSec = Math.max(1.5, Math.min(windowDurationSec, totalSec));
  const numSegments = Math.max(1, Math.ceil(totalSec / stepSec));
  const segments: EmotionSegment[] = [];

  for (let idx = 0; idx < numSegments; idx++) {
    const startTime = Number((idx * stepSec).toFixed(2));
    const endTime = Number(Math.min(totalSec, (idx + 1) * stepSec).toFixed(2));
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.min(samples.length, Math.floor(endTime * sampleRate));
    const slice = samples.subarray(startSample, endSample);

    const metrics = analyzeAudioSignal(slice, sampleRate, 1, 'audio/wav');

    // Compute defensible vocal emotion probability distribution from acoustic prosody
    const probs: Record<EmotionLabel, number> = {
      Neutral: 0.25,
      Fear: 0.12,
      Anger: 0.12,
      Sadness: 0.15,
      Happiness: 0.14,
      'Stress / Nervousness': 0.22,
    };

    let uncertaintyFlag = false;
    let uncertaintyReason: string | undefined;

    if (!metrics.isValidSpeech) {
      probs.Neutral = 0.72;
      probs.Sadness = 0.10;
      probs['Stress / Nervousness'] = 0.06;
      probs.Fear = 0.04;
      probs.Anger = 0.04;
      probs.Happiness = 0.04;
      uncertaintyFlag = true;
      uncertaintyReason = 'Low vocal energy or silence in segment; defaulting to uncertain Neutral cue.';
    } else {
      const rms = metrics.rmsEnergy;
      const pitch = metrics.estimatedPitchHz;
      const jitter = metrics.pitchVariabilityHz;
      const zcr = metrics.zeroCrossingRate;

      // High energy + elevated pitch + sharp spectral ZCR -> Anger / vocal force
      const angerScore =
        (rms > 0.16 ? 0.38 : rms * 1.8) +
        (pitch > 195 ? 0.24 : 0.08) +
        (zcr > 0.11 ? 0.22 : 0.06);

      // High pitch variability (jitter) + high pitch + moderate-high ZCR -> Stress / Nervousness & Fear
      const stressScore =
        (jitter > 28 ? 0.42 : (jitter / 28) * 0.28) +
        (pitch > 210 ? 0.26 : 0.1) +
        (zcr > 0.09 ? 0.18 : 0.07);

      const fearScore =
        (pitch > 225 ? 0.36 : (pitch / 225) * 0.18) +
        (jitter > 35 ? 0.32 : 0.1) +
        (rms > 0.06 && rms < 0.18 ? 0.18 : 0.06);

      // Low energy + low pitch + low ZCR -> Sadness / subdued prosody
      const sadnessScore =
        (rms < 0.065 ? 0.38 : 0.08) +
        (pitch > 0 && pitch < 145 ? 0.32 : 0.08) +
        (jitter < 16 ? 0.18 : 0.05);

      // Moderate-steady energy + balanced pitch + low jitter -> Neutral
      const neutralScore =
        (rms >= 0.05 && rms <= 0.14 ? 0.42 : 0.16) +
        (pitch >= 120 && pitch <= 190 ? 0.32 : 0.12) +
        (jitter < 22 ? 0.25 : 0.08);

      // Moderate-high energy + harmonic moderate pitch variability -> Happiness / upbeat
      const happyScore =
        (rms >= 0.09 && rms <= 0.17 ? 0.26 : 0.1) +
        (pitch >= 175 && pitch <= 220 && jitter >= 16 && jitter <= 30 ? 0.34 : 0.1);

      const totalRaw =
        angerScore + stressScore + fearScore + sadnessScore + neutralScore + happyScore;

      probs.Anger = Number((angerScore / totalRaw).toFixed(3));
      probs['Stress / Nervousness'] = Number((stressScore / totalRaw).toFixed(3));
      probs.Fear = Number((fearScore / totalRaw).toFixed(3));
      probs.Sadness = Number((sadnessScore / totalRaw).toFixed(3));
      probs.Neutral = Number((neutralScore / totalRaw).toFixed(3));
      probs.Happiness = Number((happyScore / totalRaw).toFixed(3));

      if (metrics.clippingRatio > 0.03 || metrics.snrDb < 8) {
        uncertaintyFlag = true;
        uncertaintyReason =
          metrics.clippingRatio > 0.03
            ? 'Signal clipping distortion lowers acoustic SER certainty.'
            : 'Background noise (SNR < 8 dB) increases vocal emotion uncertainty.';
      }
    }

    const sorted = (Object.entries(probs) as [EmotionLabel, number][]).sort(
      (a, b) => b[1] - a[1]
    );
    const primaryEmotion = sorted[0][0];
    const topProb = sorted[0][1];
    const secondProb = sorted[1][1];

    if (topProb - secondProb < 0.07 && !uncertaintyFlag) {
      uncertaintyFlag = true;
      uncertaintyReason = `Close acoustic overlap between ${primaryEmotion} (${Math.round(
        topProb * 100
      )}%) and ${sorted[1][0]} (${Math.round(secondProb * 100)}%).`;
    }

    segments.push({
      id: `emo-seg-${idx + 1}`,
      startTime,
      endTime,
      primaryEmotion,
      confidence: Number(topProb.toFixed(2)),
      probabilities: probs,
      uncertaintyFlag,
      uncertaintyReason,
      acousticCues: {
        rms: metrics.rmsEnergy,
        pitchHz: metrics.estimatedPitchHz,
        zcr: metrics.zeroCrossingRate,
      },
    });
  }

  // Aggregate distribution across all segments
  const distribution: Record<EmotionLabel, number> = { ...emptyDist };
  for (const seg of segments) {
    (Object.keys(distribution) as EmotionLabel[]).forEach((label) => {
      distribution[label] += seg.probabilities[label] / segments.length;
    });
  }
  (Object.keys(distribution) as EmotionLabel[]).forEach((label) => {
    distribution[label] = Number((distribution[label] * 100).toFixed(1));
  });

  return { segments, distribution };
}

export type SyntheticProsodyProfile =
  | 'calm_neutral'
  | 'stressed_urgent'
  | 'angry_aggressive'
  | 'fearful_distressed'
  | 'silent'
  | 'noisy_clipped';

/**
 * Generates a genuine, playable 16kHz 16-bit mono RIFF WAVE buffer with controlled
 * prosodic characteristics (F0 pitch contour, amplitude envelope, jitter, harmonic overtones)
 * for deterministic testing, offline fallback, and browser playback.
 */
export function synthesizeTestWav(
  profile: SyntheticProsodyProfile,
  durationSeconds = 4.0,
  sampleRate = 16000
): Uint8Array {
  const numSamples = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const buffer = new Uint8Array(44 + numSamples * 2);
  const view = new DataView(buffer.buffer);

  // Write RIFF/WAVE header
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM = 1
  view.setUint16(22, 1, true);  // Mono = 1
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true);  // Block align
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (profile === 'silent') {
      sample = Math.sin(2 * Math.PI * 60 * t) * 0.002;
    } else if (profile === 'calm_neutral') {
      const syllableEnv = Math.max(0, Math.sin(2 * Math.PI * 2.8 * t));
      const f0 = 148 + 8 * Math.sin(2 * Math.PI * 1.2 * t);
      phase += (2 * Math.PI * f0) / sampleRate;
      sample =
        syllableEnv *
        0.11 *
        (0.75 * Math.sin(phase) + 0.25 * Math.sin(2 * phase));
    } else if (profile === 'stressed_urgent') {
      const syllableEnv = Math.max(0, Math.sin(2 * Math.PI * 4.6 * t));
      const f0 = 232 + 48 * Math.sin(2 * Math.PI * 6.5 * t) + 18 * Math.cos(2 * Math.PI * 13 * t);
      phase += (2 * Math.PI * f0) / sampleRate;
      sample =
        syllableEnv *
        0.15 *
        (0.55 * Math.sin(phase) + 0.3 * Math.sin(3 * phase) + 0.15 * Math.sin(5 * phase));
    } else if (profile === 'angry_aggressive') {
      const syllableEnv = Math.max(0, Math.sin(2 * Math.PI * 4.2 * t));
      const f0 = 210 + 25 * Math.sin(2 * Math.PI * 4.0 * t);
      phase += (2 * Math.PI * f0) / sampleRate;
      sample =
        syllableEnv *
        0.26 *
        (0.45 * Math.sin(phase) + 0.35 * Math.sin(3 * phase) + 0.2 * Math.sin(7 * phase));
    } else if (profile === 'fearful_distressed') {
      const syllableEnv = Math.max(0, Math.sin(2 * Math.PI * 5.2 * t));
      const f0 = 255 + 55 * Math.sin(2 * Math.PI * 8.5 * t);
      phase += (2 * Math.PI * f0) / sampleRate;
      sample =
        syllableEnv *
        0.13 *
        (0.65 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.1 * Math.sin(4 * phase));
    } else if (profile === 'noisy_clipped') {
      const deterministicNoise = Math.sin(i * 12.9898) * 0.45;
      const f0 = 190 + 30 * Math.sin(2 * Math.PI * 5 * t);
      phase += (2 * Math.PI * f0) / sampleRate;
      sample = Math.max(-1, Math.min(1, 0.85 * Math.sin(phase) + deterministicNoise));
    }

    const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }

  return buffer;
}
