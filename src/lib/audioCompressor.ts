/**
 * Client-side Audio Compressor & Resampler for Speech-To-Text AI.
 * Resamples audio files (MP3, WAV, M4A, OGG, WebM) down to 16kHz Mono WAV.
 * Reduces 30MB+ stereo audio files down to ~1-3MB without losing any speech fidelity.
 * Prevents payload limit errors, timeouts, and "Failed to fetch" network errors.
 */

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, "RIFF");
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, "WAVE");
  /* format chunk identifier */
  writeString(view, 12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM = 1) */
  view.setUint16(20, 1, true);
  /* channel count (mono = 1) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * 2 bytes/sample) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (2 bytes) */
  view.setUint16(32, 2, true);
  /* bits per sample (16-bit) */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, "data");
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples using direct typed array buffer view
  const pcmBuffer = new Int16Array(buffer, 44, samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      if (res) resolve(res);
      else reject(new Error("Echec de lecture du fichier audio"));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Optimizes any audio Blob/File into a 16kHz mono WAV base64 string.
 * Fallbacks to original data URI if Web Audio API fails to decode.
 */
export async function optimizeAudioBlob(
  blob: Blob,
  onStatusUpdate?: (status: string) => void
): Promise<{ base64: string; mimeType: string }> {
  try {
    // Fast path: if the audio file/recording is small (< 2.5 MB), skip heavy Web Audio decoding/resampling
    // and convert directly to base64 instantly in native browser code (takes ~1ms).
    if (blob.size < 2.5 * 1024 * 1024) {
      if (onStatusUpdate) onStatusUpdate("Préparation ultra-rapide de l'audio...");
      const originalBase64 = await blobToBase64(blob);
      return { base64: originalBase64, mimeType: blob.type || "audio/webm" };
    }

    if (onStatusUpdate) onStatusUpdate("Optimisation de l'audio pour l'IA...");

    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioCtx) {
      const originalBase64 = await blobToBase64(blob);
      return { base64: originalBase64, mimeType: blob.type || "audio/webm" };
    }

    const tempCtx = new AudioCtx();
    let audioBuffer: AudioBuffer;

    try {
      audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    } catch (decodeErr) {
      console.warn("AudioContext decoding failed, using raw audio format:", decodeErr);
      tempCtx.close().catch(() => {});
      const originalBase64 = await blobToBase64(blob);
      return { base64: originalBase64, mimeType: blob.type || "audio/webm" };
    }

    tempCtx.close().catch(() => {});

    // Target sample rate for Gemini Speech-to-Text (16000 Hz Mono)
    const targetSampleRate = 16000;
    const targetLength = Math.ceil(audioBuffer.duration * targetSampleRate);

    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineCtx) {
      const originalBase64 = await blobToBase64(blob);
      return { base64: originalBase64, mimeType: blob.type || "audio/webm" };
    }

    const offlineCtx = new OfflineCtx(1, Math.max(1, targetLength), targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const pcmData = renderedBuffer.getChannelData(0);
    const wavBlob = encodeWAV(pcmData, targetSampleRate);

    const optimizedBase64 = await blobToBase64(wavBlob);
    return {
      base64: optimizedBase64,
      mimeType: "audio/wav",
    };
  } catch (err) {
    console.warn("Audio optimization fallback triggered:", err);
    const fallbackBase64 = await blobToBase64(blob);
    return { base64: fallbackBase64, mimeType: blob.type || "audio/webm" };
  }
}
