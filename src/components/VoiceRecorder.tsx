import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, RefreshCw, Upload, Sparkles, Volume2, Radio, CheckCircle2, FileAudio } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VoiceRecorderProps {
  onAudioCaptured: (base64Audio: string, mimeType: string, promptMode: "formatted" | "verbatim" | "meeting_notes") => void;
  selectedLanguage: string;
  isProcessing?: boolean;
}

export default function VoiceRecorder({ onAudioCaptured, selectedLanguage, isProcessing }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [promptMode, setPromptMode] = useState<"formatted" | "verbatim" | "meeting_notes">("formatted");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start recording voice
  const startRecording = async () => {
    setAudioError(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAudioError("L'accès au microphone n'est pas supporté par votre navigateur ou votre version d'Android.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Audio visualizer setup
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setMicVolume(avg);
            }
            animFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (err) {
        console.warn("AudioContext visualizer initialization skipped:", err);
      }

      // Determine mime type
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
        }
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
        setMicVolume(0);
      };

      mediaRecorder.start(200); // chunk every 200ms
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setAudioError("Impossible d'accéder au microphone. Veuillez vérifier les permissions dans votre navigateur.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resetAudio = () => {
    if (isRecording) {
      stopRecording();
    }
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setAudioError(null);
  };

  // Handle manual file upload (.mp3, .wav, .m4a, etc.)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setAudioError("Le fichier audio dépasse la limite autorisée de 50 Mo.");
        return;
      }
      setAudioError(null);
      setAudioBlob(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
    }
  };

  // Convert Blob to Base64 and trigger transcription
  const handleTranscribeClick = async () => {
    if (!audioBlob) return;

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        onAudioCaptured(base64Audio, audioBlob.type || "audio/webm", promptMode);
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      console.error("Error reading audio blob:", err);
      setAudioError("Erreur lors de la préparation de l'audio. Veuillez réessayer.");
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, [audioUrl]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Top Banner / Mode Switcher */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-6 border border-indigo-500/30 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/20">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                Dictée Vocale & Audio HD
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  Gemini 3.6 IA
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Enregistrez votre voix ou importez un fichier audio pour une transcription texte ultra-précise en {selectedLanguage}.
              </p>
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all"
          >
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Importer un fichier audio</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Error message */}
        {audioError && (
          <div className="p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-xl flex items-start gap-2">
            <span className="font-bold">⚠️</span>
            <span>{audioError}</span>
          </div>
        )}

        {/* Recording Visualizer & Controls */}
        <div className="flex flex-col items-center justify-center py-6 space-y-6 bg-slate-950/50 rounded-2xl border border-slate-800/80 p-6 relative overflow-hidden">
          {/* Animated Background glow while recording */}
          {isRecording && !isPaused && (
            <div className="absolute inset-0 bg-indigo-600/10 animate-pulse pointer-events-none" />
          )}

          {/* Time & Status indicator */}
          <div className="text-center space-y-1">
            <div className="text-4xl font-mono font-bold tracking-wider text-white">
              {formatTime(recordingTime)}
            </div>
            <div className="text-xs text-slate-400 flex items-center justify-center gap-2">
              {isRecording ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  {isPaused ? "En pause" : "Enregistrement en cours..."}
                </span>
              ) : audioBlob ? (
                <span className="text-indigo-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Enregistrement prêt pour l'IA
                </span>
              ) : (
                <span>Cliquez sur le microphone pour démarrer</span>
              )}
            </div>
          </div>

          {/* Audio Wave Volume Bars (during recording) */}
          {isRecording && (
            <div className="flex items-center justify-center gap-1.5 h-12 my-2">
              {[...Array(12)].map((_, i) => {
                const heightPercent = Math.max(15, Math.min(100, (micVolume * (1 + (i % 5) * 0.3)) / 2));
                return (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-indigo-500 to-violet-400 rounded-full"
                    animate={{ height: `${isPaused ? 10 : heightPercent}%` }}
                    transition={{ duration: 0.1 }}
                  />
                );
              })}
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="flex items-center justify-center gap-4 z-10">
            {!isRecording && !audioBlob && (
              <button
                onClick={startRecording}
                className="group relative p-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full shadow-2xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                title="Démarrer la dictée"
              >
                <div className="absolute -inset-1 rounded-full bg-indigo-500/30 blur-md group-hover:bg-indigo-400/40 transition-all" />
                <Mic className="w-8 h-8 relative z-10" />
              </button>
            )}

            {isRecording && (
              <>
                <button
                  onClick={pauseRecording}
                  className="p-4 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-full border border-slate-700 shadow-lg transition-all"
                  title={isPaused ? "Reprendre" : "Mettre en pause"}
                >
                  {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6" />}
                </button>

                <button
                  onClick={stopRecording}
                  className="p-5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg shadow-red-600/30 animate-pulse transition-all"
                  title="Terminer l'enregistrement"
                >
                  <Square className="w-6 h-6 fill-current" />
                </button>
              </>
            )}

            {audioBlob && !isRecording && (
              <div className="flex items-center gap-3">
                <button
                  onClick={resetAudio}
                  className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 flex items-center gap-2 text-xs transition-all"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <span>Réenregistrer</span>
                </button>
              </div>
            )}
          </div>

          {/* Playback preview if audio exists */}
          {audioUrl && !isRecording && (
            <div className="w-full max-w-md mt-4 p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-3">
              <FileAudio className="w-5 h-5 text-indigo-400 shrink-0" />
              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                controls
                className="w-full h-8 text-xs accent-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Prompt Mode Options */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
            <span>Style de transcription souhaité</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setPromptMode("formatted")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                promptMode === "formatted"
                  ? "bg-indigo-600/20 border-indigo-500/60 text-white font-medium"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/50"
              }`}
            >
              <div className="font-semibold text-slate-200 mb-0.5">⚡ Standard & Propre</div>
              <div className="text-[11px] text-slate-400 leading-tight">Grammaire corrigée, ponctuation et paragraphes fluides.</div>
            </button>

            <button
              type="button"
              onClick={() => setPromptMode("verbatim")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                promptMode === "verbatim"
                  ? "bg-indigo-600/20 border-indigo-500/60 text-white font-medium"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/50"
              }`}
            >
              <div className="font-semibold text-slate-200 mb-0.5">📝 Mot à Mot (Fidèle)</div>
              <div className="text-[11px] text-slate-400 leading-tight">Transcription exacte brut sans aucune omission.</div>
            </button>

            <button
              type="button"
              onClick={() => setPromptMode("meeting_notes")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                promptMode === "meeting_notes"
                  ? "bg-indigo-600/20 border-indigo-500/60 text-white font-medium"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/50"
              }`}
            >
              <div className="font-semibold text-slate-200 mb-0.5">📊 Compte-Rendu & Points</div>
              <div className="text-[11px] text-slate-400 leading-tight">Synthèse structurée, décisions et actions.</div>
            </button>
          </div>
        </div>

        {/* Submit Transcription Button */}
        {audioBlob && !isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-2"
          >
            <button
              onClick={handleTranscribeClick}
              disabled={isProcessing}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm rounded-xl shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5 text-indigo-200 animate-spin-slow" />
              <span>Lancer la transcription vocale par l'IA Gemini</span>
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
