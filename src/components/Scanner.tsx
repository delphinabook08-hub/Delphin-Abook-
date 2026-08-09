import React, { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Camera, Upload, X, Zap, Smartphone, Crop, Check, Sparkles, Grid, SlidersHorizontal, Sliders } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { compressImagesInParallel } from "../lib/imageCompressor";
import { autoCropAndTrimPaper, autoCropBatch, ScanFilterMode } from "../lib/documentCropper";
import { processUploadedDocumentFiles } from "../lib/pdfConverter";
import DocumentEditorModal from "./DocumentEditorModal";

interface ScannerProps {
  onImagesCaptured: (base64Array: string[]) => void;
  onTextCaptured?: (text: string) => void;
  selectedLanguage: string;
  activeTab?: "ocr" | "voice";
  onDirectFileUpload?: (files: File[]) => void;
}

export default function Scanner({ onImagesCaptured, onTextCaptured, activeTab, onDirectFileUpload }: ScannerProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPages, setCapturedPages] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [autoCropEnabled, setAutoCropEnabled] = useState(true);
  const [scanFilterMode, setScanFilterMode] = useState<ScanFilterMode>("magic");
  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  
  // CamScanner Editor Modal state
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [pagesToEdit, setPagesToEdit] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const toggleFlash = async () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          advanced: [{ torch: !isFlashOn } as any],
        });
        setIsFlashOn(!isFlashOn);
      } catch (err) {
        console.error("Error toggling flash:", err);
      }
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsFlashOn(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("Direct HTML5 mediaDevices camera is not supported in this environment (WebView, non-HTTPS, or older Android browser).");
      setCameraError(
        "Votre navigateur ou version d'Android restreint l'accès direct à la caméra (ou vous n'êtes pas sur un site sécurisé HTTPS). Utilisez l'appareil photo natif Android ci-dessous, il est 100% compatible !"
      );
      return;
    }

    // Multi-stage progressive constraints designed for all versions of Android and browsers
    const constraintStages = [
      // Stage 1: Rear Camera, FHD Resolution
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      },
      // Stage 2: Rear Camera, HD Resolution
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      // Stage 3: Broad Android back-facing camera
      {
        video: {
          facingMode: "environment"
        }
      },
      // Stage 4: Resilient fallback to any available capture stream
      {
        video: true
      }
    ];

    let activeStream: MediaStream | null = null;
    let succeeded = false;
    let fallbackError: any = null;

    for (const constraints of constraintStages) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        succeeded = true;
        break;
      } catch (err) {
        fallbackError = err;
        console.warn("Retrying with camera fallback stream due to:", err);
      }
    }

    if (succeeded && activeStream) {
      setShowCamera(true);
      const stream = activeStream;
      
      const track = stream.getVideoTracks()[0];
      setTimeout(() => {
        try {
          if (track && typeof track.getCapabilities === "function") {
            const capabilities = track.getCapabilities() as any;
            setHasTorch(!!capabilities?.torch);
          } else {
            setHasTorch(false);
          }
        } catch (_) {
          setHasTorch(false);
        }
      }, 500);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } else {
      console.error("All media device capture streams failed:", fallbackError);
      setCameraError(
        "Impossible d'accéder au flux caméra direct. Utilisez l'appareil photo natif Android ci-dessous, cela fonctionne sur 100% des téléphones !"
      );
    }
  };

  const triggerNativeCapture = () => {
    cameraInputRef.current?.click();
  };

  const triggerGalleryPicker = () => {
    galleryInputRef.current?.click();
  };

  const processAndSubmitFiles = async (files: File[]) => {
    setCameraError(null);

    // Check if any file is an audio file
    const hasAudio = files.some(f => {
      const nameLower = f.name.toLowerCase();
      return f.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|webm|flac|amr|wma|mp4)$/i.test(nameLower);
    });

    if (hasAudio && onDirectFileUpload) {
      onDirectFileUpload(files);
      return;
    }

    setIsCropping(true);
    try {
      const rawImageUrls = await processUploadedDocumentFiles(files);
      if (rawImageUrls.length === 0) {
        setCameraError("Aucune image ni page PDF valide n'a pu être extraite. Veuillez vérifier vos fichiers.");
        setIsCropping(false);
        return;
      }

      let processed = rawImageUrls;
      if (autoCropEnabled && scanFilterMode !== "original") {
        try {
          processed = await autoCropBatch(rawImageUrls, { filterMode: scanFilterMode });
        } catch (e) {
          console.warn("AutoCrop batch skipped, using raw images:", e);
        }
      }

      setIsCropping(false);
      const allPages = [...capturedPages, ...processed];
      setCapturedPages(allPages);
    } catch (err: any) {
      console.error("Error processing document files:", err);
      setCameraError("Erreur lors du traitement des fichiers : " + (err.message || "Fichier invalide"));
      setIsCropping(false);
    }
  };

  const handleNativeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processAndSubmitFiles(Array.from(files));
    }
    // Reset value so uploading the same file again triggers onChange
    e.target.value = "";
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const MAX_WIDTH = 1200;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      if (autoCropEnabled) {
        const cropRes = await autoCropAndTrimPaper(dataUrl, { padding: 12, filterMode: scanFilterMode });
        setCapturedPages(prev => [...prev, cropRes.croppedDataUrl]);
      } else {
        setCapturedPages(prev => [...prev, dataUrl]);
      }
      
      setTimeout(() => setIsCapturing(false), 200);
    }
  };

  const removePage = (index: number) => {
    setCapturedPages(prev => prev.filter((_, i) => i !== index));
  };

  const finishCapture = () => {
    if (capturedPages.length > 0) {
      onImagesCaptured(capturedPages);
      stopCamera();
      setCapturedPages([]);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    const rejectedFiles = (fileRejections || []).map(r => r.file).filter(Boolean);
    const filesToProcess = [...acceptedFiles, ...rejectedFiles];

    if (filesToProcess.length > 0) {
      processAndSubmitFiles(filesToProcess);
    }
  }, [autoCropEnabled, onImagesCaptured]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[], fileRejections: any[]) => onDrop(acceptedFiles, fileRejections),
    noClick: true, // Prevents dropzone from attaching conflicting internal click handlers
    multiple: true,
  } as any);

  return (
    <div className="w-full space-y-8">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-4">
          <div className="h-[1px] w-12 bg-teal-500/30" />
          <motion.h2 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[10px] uppercase font-mono text-teal-400 font-bold tracking-[0.4em] px-3 py-1 border border-teal-500/20 rounded-md bg-teal-500/5"
          >
            Neural Vision Interface v2.4
          </motion.h2>
          <div className="h-[1px] w-12 bg-teal-500/30" />
        </div>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-6xl font-display font-light text-white tracking-tighter"
        >
          Numérisation <span className="text-teal-500 italic">IA</span>
        </motion.p>
      </div>



      {capturedPages.length > 0 && !showCamera && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 rounded-3xl bg-zinc-900/90 border border-teal-500/40 backdrop-blur-xl space-y-4 shadow-2xl ring-1 ring-teal-500/20"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-teal-400 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  Dossier de numérisation ({capturedPages.length} page{capturedPages.length > 1 ? "s" : ""})
                  <span className="text-[9px] font-mono font-normal text-teal-300 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30">
                    1 seul document final
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Toutes les pages scannées seront compilées dans un même fichier Word, PDF et Excel.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={triggerNativeCapture}
                className="px-3 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                title="Scanner un autre papier avec l'appareil photo"
              >
                <Camera className="w-3.5 h-3.5 text-teal-400" />
                <span>+ Photo Papier</span>
              </button>

              <button
                type="button"
                onClick={triggerGalleryPicker}
                className="px-3 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                title="Ajouter un autre document ou image depuis la galerie"
              >
                <Upload className="w-3.5 h-3.5 text-teal-400" />
                <span>+ Galerie / Fichier</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPagesToEdit(capturedPages);
                  setShowEditorModal(true);
                }}
                className="px-3 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Crop className="w-3.5 h-3.5 text-teal-400" />
                <span>✂️ Recadrer</span>
              </button>

              <button
                type="button"
                onClick={() => setCapturedPages([])}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs transition-all"
                title="Effacer tout le dossier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {capturedPages.map((page, idx) => (
              <div key={idx} className="relative group aspect-[3/4] rounded-2xl overflow-hidden border border-teal-500/20 bg-black shadow-lg">
                <img src={page} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPagesToEdit([page]);
                      setShowEditorModal(true);
                    }}
                    className="p-2 rounded-xl bg-teal-500 text-black shadow-lg"
                    title="Ajuster les 4 coins de cette page"
                  >
                    <Crop className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePage(idx)}
                    className="p-2 rounded-xl bg-red-500 text-white shadow-lg"
                    title="Supprimer la page du dossier"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-1 left-1 bg-black/80 text-teal-400 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-white/10">
                  P.{idx + 1}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/5">
            <span className="text-[10px] text-slate-400 font-mono">
              💡 Cliquez sur "+ Photo Papier" pour ajouter une page supplémentaire à ce dossier.
            </span>

            <button
              type="button"
              onClick={() => onImagesCaptured(capturedPages)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black font-bold text-xs uppercase tracking-widest transition-all shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2 scale-105"
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>Numériser tout le dossier ({capturedPages.length} page{capturedPages.length > 1 ? "s" : ""})</span>
            </button>
          </div>
        </motion.div>
      )}

      {isCropping && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-teal-500/20 border border-teal-500/40 text-teal-200 text-xs rounded-xl flex items-center justify-center gap-2 font-mono uppercase tracking-wider"
        >
          <Sparkles className="w-4 h-4 text-teal-400 animate-spin" />
          <span>Détection des contours et rognage du papier en cours...</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Direct live camera feed */}
        <motion.button
          whileHover={{ scale: 1.01, borderColor: "rgba(20, 184, 166, 0.4)" }}
          whileTap={{ scale: 0.99 }}
          onClick={startCamera}
          className="flex flex-col items-center justify-center p-6 glass-card rounded-xl gap-3 group transition-all relative overflow-hidden tech-grid scanner-effect text-left h-full w-full"
        >
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-teal-500/30 group-hover:border-teal-500 transition-colors" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-teal-500/30 group-hover:border-teal-500 transition-colors" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-teal-500/30 group-hover:border-teal-500 transition-colors" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-teal-500/30 group-hover:border-teal-500 transition-colors" />
          
          <div className="absolute inset-0 bg-teal-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/5 group-hover:border-teal-500 group-hover:text-teal-400 text-slate-500 transition-all shadow-2xl relative z-10">
            <Camera className="w-6 h-6" />
          </div>
          <div className="text-center relative z-10 space-y-1">
            <span className="block font-display text-lg text-white tracking-tight">Viseur IA Live</span>
            <span className="inline-block px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-[0.2em] border bg-teal-500/10 text-teal-400 border-teal-500/20">
              Flux HTML5 Direct
            </span>
          </div>
        </motion.button>

        {/* Native mobile camera fallback for older or restricted Android devices */}
        <motion.button
          whileHover={{ scale: 1.01, borderColor: "rgba(20, 184, 166, 0.4)" }}
          whileTap={{ scale: 0.99 }}
          onClick={triggerNativeCapture}
          className="flex flex-col items-center justify-center p-6 glass-card rounded-xl gap-3 group transition-all relative overflow-hidden tech-grid scanner-effect text-left h-full w-full"
        >
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-teal-500/30 group-hover:border-teal-500 transition-colors" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-teal-500/30 group-hover:border-teal-500 transition-colors" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-teal-500/30 group-hover:border-teal-500 transition-colors" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-teal-500/30 group-hover:border-teal-500 transition-colors" />
          
          <div className="absolute inset-0 bg-teal-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/5 group-hover:border-teal-500 group-hover:text-teal-400 text-slate-500 transition-all shadow-2xl relative z-10">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="text-center relative z-10 space-y-1">
            <span className="block font-display text-lg text-white tracking-tight">Appareil Natif</span>
            <span className="inline-block px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-[0.2em] border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Compatibilité 100%
            </span>
          </div>
        </motion.button>

        {/* Gallery / File selection */}
        <div
          onClick={triggerGalleryPicker}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              processAndSubmitFiles(Array.from(e.dataTransfer.files));
            }
          }}
          className="relative group cursor-pointer rounded-xl border border-white/5 hover:border-teal-500/50 hover:bg-teal-950/20 transition-all p-6 flex flex-col items-center justify-center gap-3 glass-card overflow-hidden tech-grid h-full"
        >
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-white/10 group-hover:border-teal-500/50 transition-colors" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-white/10 group-hover:border-teal-500/50 transition-colors" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-white/10 group-hover:border-teal-500/50 transition-colors" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-white/10 group-hover:border-teal-500/50 transition-colors" />

          <div className="absolute inset-0 bg-teal-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/5 group-hover:border-teal-500/40 text-slate-500 group-hover:text-teal-400 transition-all shadow-2xl relative z-10">
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-center relative z-10 space-y-1">
            <span className="block font-display text-lg text-white tracking-tight">Importation</span>
            <span className="inline-block px-2 py-0.5 rounded-full bg-white/5 text-[7px] text-slate-400 font-mono uppercase tracking-[0.2em] border border-white/10 group-hover:text-teal-300 group-hover:border-teal-500/30">
              Galerie & Fichiers (PDF, Photos, Audio)
            </span>
          </div>
        </div>
      </div>

      {cameraError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex flex-col md:flex-row items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>{cameraError}</span>
          </div>
          <button
            onClick={triggerNativeCapture}
            className="px-4 py-2 bg-amber-500 text-black font-bold uppercase text-[9px] tracking-wider rounded-lg hover:bg-amber-400 transition-all shrink-0 shadow-lg"
          >
            Prendre une photo
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-2xl p-4"
          >
            <div className="relative w-full max-w-2xl bg-zinc-900 rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/5">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                // @ts-ignore
                webkit-playsinline="true"
                className={`w-full aspect-[3/4] object-cover brightness-110 transition-all duration-300 ${
                  isCapturing ? "brightness-150 scale-[1.02]" : ""
                }`}
              />
              
              {/* Technical Overlay & Grid */}
              <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between">
                <div className="absolute inset-8 border border-white/10 rounded-2xl">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-teal-500 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-teal-500 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-teal-500 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-teal-500 rounded-br-lg" />
                </div>

                {/* Optional Grid alignment lines */}
                {showGridOverlay && (
                  <div className="absolute inset-8 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    <div className="border-r border-b border-teal-500/20" />
                    <div className="border-r border-b border-teal-500/20" />
                    <div className="border-b border-teal-500/20" />
                    <div className="border-r border-b border-teal-500/20" />
                    <div className="border-r border-b border-teal-500/20 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full border border-teal-500/40 flex items-center justify-center">
                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-ping" />
                      </div>
                    </div>
                    <div className="border-b border-teal-500/20" />
                    <div className="border-r border-teal-500/20" />
                    <div className="border-r border-teal-500/20" />
                    <div />
                  </div>
                )}
                
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 border-t-2 border-l-2 border-teal-500/50" />
                  <div className="w-8 h-8 border-t-2 border-r-2 border-teal-500/50" />
                </div>
                <div className="flex flex-col items-center gap-2">
                   <div className="w-48 h-[1px] bg-gradient-to-r from-transparent via-teal-500 to-transparent animate-pulse" />
                   <span className="text-[10px] font-mono text-teal-500 uppercase tracking-widest">Alignement Viseur CamScanner</span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="w-8 h-8 border-b-2 border-l-2 border-teal-500/50" />
                  <div className="w-8 h-8 border-b-2 border-r-2 border-teal-500/50" />
                </div>
              </div>
              
              <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-20">
                <button
                  onClick={() => {
                    stopCamera();
                    setCapturedPages([]);
                  }}
                  className="p-4 rounded-full bg-black/40 backdrop-blur-md text-slate-400 hover:text-white transition-all border border-white/5"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-2">
                  <div className="bg-teal-500 text-black px-5 py-2 rounded-full font-bold text-[12px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(20,184,166,0.4)]">
                     Document • Page {capturedPages.length + 1}
                  </div>

                  <button
                    onClick={() => setShowGridOverlay(!showGridOverlay)}
                    className={`p-2.5 rounded-full backdrop-blur-md border border-white/10 transition-colors ${
                      showGridOverlay ? "bg-teal-500/30 text-teal-300" : "bg-black/40 text-slate-400"
                    }`}
                    title="Activer/Désactiver la grille de cadrage"
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                </div>

                {hasTorch ? (
                  <button
                    onClick={toggleFlash}
                    className={`p-4 rounded-full backdrop-blur-md transition-all border border-white/5 ${
                      isFlashOn ? "bg-teal-500 text-black shadow-[0_0_20px_rgba(20,184,166,0.5)]" : "bg-black/40 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Zap className={`w-6 h-6 ${isFlashOn ? "fill-current" : ""}`} />
                  </button>
                ) : (
                  <div className="w-14" />
                )}
              </div>
              
              <div className="absolute top-24 left-0 right-0 px-4 flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                 {capturedPages.map((page, idx) => (
                   <motion.div 
                     key={idx}
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     className="relative flex-shrink-0 w-16 h-20 rounded-lg border border-teal-500/50 overflow-hidden bg-black shadow-lg"
                   >
                     <img src={page} className="w-full h-full object-cover opacity-60" />
                     <button 
                       onClick={() => removePage(idx)}
                       className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5"
                     >
                       <X className="w-2.5 h-2.5" />
                     </button>
                     <div className="absolute bottom-0 inset-x-0 bg-teal-500 text-black text-[6px] font-bold text-center py-0.5">
                       P{idx + 1}
                     </div>
                   </motion.div>
                 ))}

                 {capturedPages.length > 0 && (
                   <button
                     onClick={() => {
                       setPagesToEdit(capturedPages);
                       setShowEditorModal(true);
                     }}
                     className="flex-shrink-0 px-3 py-2 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-bold flex items-center gap-1.5 hover:bg-teal-500/30 transition-all"
                   >
                     <SlidersHorizontal className="w-4 h-4 text-teal-400" />
                     <span>Éditer 4-Corners & Filtres</span>
                   </button>
                 )}
              </div>
              
              <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-10">
                <button
                  onClick={capturePhoto}
                  className="w-24 h-24 rounded-full border border-white/20 p-2 flex items-center justify-center bg-black/40 backdrop-blur-md"
                >
                  <div className="w-full h-full rounded-full bg-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.6)] hover:scale-95 transition-transform" />
                </button>
                <button
                  onClick={finishCapture}
                  disabled={capturedPages.length === 0}
                  className="px-8 py-5 rounded-3xl bg-white text-black font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-all disabled:opacity-20 disabled:grayscale shadow-2xl"
                >
                  Lancer OCR IA & Word {capturedPages.length > 0 && `(${capturedPages.length})`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
      
      {/* Native Camera Input (Forces environment camera on mobile) */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={cameraInputRef} 
        onChange={handleNativeCapture} 
        className="hidden" 
      />

      {/* Gallery & Multi-Document Input (Images, PDFs, Word, Text, Audio) */}
      <input 
        type="file" 
        accept="image/*,audio/*,video/*,.pdf,application/pdf,.doc,.docx,.txt,.csv,.rtf,.heic,.heif,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac,.amr,.wma,.mp4" 
        multiple
        ref={galleryInputRef} 
        onChange={handleNativeCapture} 
        className="hidden" 
      />

      {/* Document Crop & Filter Editor Modal */}
      <DocumentEditorModal
        isOpen={showEditorModal}
        pages={pagesToEdit}
        onClose={() => setShowEditorModal(false)}
        onSave={(processedPages) => {
          setCapturedPages(processedPages);
          setShowEditorModal(false);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 border-t border-white/5">
        {[
          { title: "Précision Optique", desc: "Analyse Vectorielle 4K", stat: "98.4%" },
          { title: "Moteur Cognitif", desc: "Transcription Cursive IA", stat: "Ultra-Rapide" },
          { title: "Standard Sécurité", desc: "Chiffrement Cloud de Bout en Bout", stat: "AES-256" }
        ].map((item, idx) => (
          <div key={idx} className="flex gap-4 items-start">
            <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-1 animate-pulse" />
            <div className="space-y-1">
              <h4 className="text-[9px] font-mono text-teal-400 uppercase tracking-[0.2em] font-bold">{item.title}</h4>
              <p className="text-xs text-white font-medium">{item.desc}</p>
              <div className="text-[8px] font-mono text-slate-600 uppercase tracking-widest bg-white/5 inline-block px-2 py-0.5 rounded">
                Status: {item.stat}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

