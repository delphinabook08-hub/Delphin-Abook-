import { useState, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, Globe, CreditCard, LayoutGrid, FileText, Loader2, Settings, Share2, Smartphone, Sparkles, X } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import Scanner from "./components/Scanner";
import ResultView from "./components/ResultView";
import LoadingOverlay from "./components/LoadingOverlay";

import SettingsModal from "./components/SettingsModal";
import QRCodeModal from "./components/QRCodeModal";
import TermsModal from "./components/TermsModal";
import OnboardingModal from "./components/OnboardingModal";

export interface TranscriptionResult {
  text: string;
  tableData?: string[][];
}

const LANGUAGES = [
  { code: "French", label: "Français" },
  { code: "English", label: "English" },
  { code: "Lingala", label: "Lingala" },
  { code: "Swahili", label: "Kiswahili" },
  { code: "Portuguese", label: "Português" },
  { code: "Spanish", label: "Español" },
  { code: "German", label: "Deutsch" },
  { code: "Italian", label: "Italiano" },
  { code: "Chinese", label: "中文" },
  { code: "Japanese", label: "日本語" },
  { code: "Arabic", label: "العربية" },
];

export default function App() {
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("French");
  
  // New: Usage tracking for monetization
  const [scanCount, setScanCount] = useState(() => {
    const saved = localStorage.getItem("scriptscan_count");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isPro, setIsPro] = useState(() => {
    const saved = localStorage.getItem("scriptscan_pro");
    // Granting permanent Pro access to the owner as requested
    if (saved === null) {
      localStorage.setItem("scriptscan_pro", "true");
      return true;
    }
    return saved === "true";
  });
  const [showPaywall, setShowPaywall] = useState(false);
  const [isFinishingPayment, setIsFinishingPayment] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    return !localStorage.getItem("abookscan_onboarded");
  });
  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem("abookscan_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [qrModalTab, setQrModalTab] = useState<"share" | "install">("share");
  const [showFloatingInstallBanner, setShowFloatingInstallBanner] = useState(false);

  // Advanced confidentiality features for maximum Android compliance
  const [isPrivateMode, setIsPrivateMode] = useState(() => {
    return localStorage.getItem("abookscan_private_mode") === "true";
  });
  const [isScreenProtect, setIsScreenProtect] = useState(() => {
    return localStorage.getItem("abookscan_screen_protect") === "true";
  });
  const [isBlurred, setIsBlurred] = useState(false);

  const handlePrivateModeChange = (val: boolean) => {
    setIsPrivateMode(val);
    localStorage.setItem("abookscan_private_mode", String(val));
  };

  const handleScreenProtectChange = (val: boolean) => {
    setIsScreenProtect(val);
    localStorage.setItem("abookscan_screen_protect", String(val));
    if (!val) {
      setIsBlurred(false);
    }
  };

  useEffect(() => {
    const handleBlur = () => {
      if (isScreenProtect) {
        setIsBlurred(true);
      }
    };
    const handleFocus = () => {
      setIsBlurred(false);
    };
    const handleVisibilityUpdate = () => {
      if (document.hidden && isScreenProtect) {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityUpdate);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityUpdate);
    };
  }, [isScreenProtect]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
      const dismissed = sessionStorage.getItem("abookscan_install_dismissed") === "true";
      if (!dismissed) {
        setShowFloatingInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Automative delayed check for general PWA promotion (e.g. mobile Safari)
    const isCurrentlyStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const dismissed = sessionStorage.getItem("abookscan_install_dismissed") === "true";

    if (!isCurrentlyStandalone && !dismissed) {
      const timer = setTimeout(() => {
        setShowFloatingInstallBanner(true);
      }, 5000);
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        clearTimeout(timer);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("Device app installation accepted by user");
    }
    setDeferredPrompt(null);
    setShowInstallBtn(false);
    setShowFloatingInstallBanner(false);
  };

  const handleDismissFloatingBanner = () => {
    setShowFloatingInstallBanner(false);
    sessionStorage.setItem("abookscan_install_dismissed", "true");
  };

  const handleOpenInstallGuide = () => {
    setQrModalTab("install");
    setIsQRModalOpen(true);
    setShowFloatingInstallBanner(false);
  };

  useEffect(() => {
    // Check for Stripe payment results in URL
    const query = new URLSearchParams(window.location.search);
    if (query.get("payment") === "success") {
      setIsPro(true);
      localStorage.setItem("scriptscan_pro", "true");
      alert("Payment successful! Welcome to ScriptScan Pro.");
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (query.get("payment") === "cancel") {
      alert("Payment cancelled.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleStripePayment = async () => {
    setIsFinishingPayment(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const { id, error } = await response.json();
      
      if (error) throw new Error(error);

      const stripePublishableKey = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY;
      const stripe = await loadStripe(stripePublishableKey);
      if (stripe) {
        await (stripe as any).redirectToCheckout({ sessionId: id });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Payment initialization failed");
    } finally {
      setIsFinishingPayment(false);
    }
  };

  const FREE_LIMIT = 3;

  const handleImagesCaptured = async (base64Array: string[]) => {
    if (!isPro && scanCount >= FREE_LIMIT) {
      setShowPaywall(true);
      return;
    }

    if (base64Array.length > 20 && !isPro) {
      alert("La version gratuite est limitée à 20 pages par scan. Passez à Pro pour plus !");
      return;
    }

    setCapturedImages(base64Array);
    setIsProcessing(true);
    setError(null);
    
    try {
      const mimeType = "image/jpeg";
      
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Images: base64Array,
          mimeType,
          language: selectedLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "La transcription a échoué. Veuillez réessayer.");
      }

      const result = await response.json();
      setTranscriptionResult(result);
      
      // Zero-Retention check: skip logging if in private mode
      if (!isPrivateMode) {
        const newHistoryItem = {
          text: result.text,
          preview: base64Array[0],
          date: new Date().toLocaleString(),
          images: base64Array,
          result: result
        };
        
        const updatedHistory = [newHistoryItem, ...history.slice(0, 19)]; // Limit to 20 items
        setHistory(updatedHistory);
        localStorage.setItem("abookscan_history", JSON.stringify(updatedHistory));
      }

      if (!isPro) {
        const newCount = scanCount + 1;
        setScanCount(newCount);
        localStorage.setItem("scriptscan_count", newCount.toString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    // Aggressive clearing for Private Mode document protection
    if (isPrivateMode) {
      setCapturedImages([]);
      setTranscriptionResult(null);
      // Explicit dereferencing of large base64 buffers to trigger instant browser garbage collection
      try {
        (window as any)._lastBuffer = null;
      } catch (_) {}
    } else {
      setCapturedImages([]);
      setTranscriptionResult(null);
    }
    setError(null);
    if (!isPro && scanCount >= FREE_LIMIT) {
      setShowPaywall(true);
    }
  };

  const handleActivatePro = () => {
    // In a real app, this would verify a code with a server
    // For now, this is the activation flow
    const code = prompt("Enter your Pro License Code:");
    if (code === "DRC-PRO-2026") { // Example bypass for testing
       setIsPro(true);
       localStorage.setItem("scriptscan_pro", "true");
       setShowPaywall(false);
       alert("Welcome to ScriptScan Pro! Unlimited access granted.");
    } else if (code) {
       alert("Invalid License Code.");
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("abookscan_history");
  };

  const selectHistoryItem = (item: any) => {
    setCapturedImages(item.images || [item.preview]);
    setTranscriptionResult(item.result);
  };

  const shareApp = async () => {
    setQrModalTab("share");
    setIsQRModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-300 font-sans selection:bg-teal-500/30 overflow-x-hidden relative">
      {/* Privacy Task-Switcher Cover Backdrop */}
      <AnimatePresence>
        {isBlurred && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsBlurred(false)}
            className="fixed inset-0 z-[200] bg-zinc-950/98 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-6 cursor-pointer pointer-events-auto"
          >
            <div className="max-w-md space-y-4 flex flex-col items-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-display font-light text-white">Écran Sécurisé Actif</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                Le masquage d'arrière-plan AbookScan est actif pour préserver la confidentialité de vos transcriptions et documents des aperçus multitâches Android.
              </p>
              <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-teal-500/40 animate-pulse">Tapez n'importe où pour reprendre</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cloud-inspired Background System */}
      <div className="fixed inset-0 z-0 bg-zinc-950 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full tech-grid opacity-10" />
        
        {/* Animated Clouds */}
        <div className="absolute top-[10%] left-[5%] w-[40%] h-[40%] bg-teal-500/10 cloud-sphere" />
        <div className="absolute top-[40%] left-[50%] w-[35%] h-[35%] bg-teal-400/5 cloud-sphere" style={{ animationDelay: '-5s' }} />
        <div className="absolute -bottom-[5%] right-[10%] w-[50%] h-[50%] bg-teal-600/10 cloud-sphere" style={{ animationDelay: '-10s' }} />
        <div className="absolute top-[60%] left-[10%] w-[30%] h-[30%] bg-zinc-400/5 cloud-sphere" style={{ animationDelay: '-15s' }} />
        
        {/* Atmospheric overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60" />
        <div className="absolute inset-0 bg-zinc-950/20 backdrop-blur-[2px]" />
      </div>

      <main className="relative z-10 container mx-auto px-6 py-6 min-h-screen flex flex-col">
        {isProcessing && <LoadingOverlay />}
        
        {showPaywall && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8"
          >
            <div className="w-20 h-20 bg-teal-500 rounded-[2rem] flex items-center justify-center shadow-[0_0_40px_rgba(20,184,166,0.3)] mb-4">
               <Zap className="w-10 h-10 text-black fill-black" />
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-display font-light text-white leading-tight">Passez à ScriptScan Pro</h2>
              <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                Vous avez atteint votre limite gratuite de {FREE_LIMIT} scans. Débloquez l'OCR illimité, les exports Word/Excel et un support premium.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-8">
              <div className="bg-zinc-900/50 border border-teal-500/20 p-6 rounded-3xl space-y-4 text-left">
                <h3 className="text-teal-400 font-bold uppercase tracking-widest text-[10px]">Utilisateurs Congo (RDC)</h3>
                <p className="text-xs text-slate-500 leading-relaxed">Payez via Mobile Money (M-Pesa, Orange, Airtel). Envoyez 5$ au <span className="text-white font-mono">+243 811 339 303</span> et envoyez la capture sur WhatsApp.</p>
                <button 
                  onClick={() => window.open("https://wa.me/243811339303", "_blank")}
                  className="w-full py-3 bg-teal-500 text-black font-bold rounded-xl text-[10px] uppercase tracking-widest"
                >
                  Contacter le support
                </button>
              </div>

              <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl space-y-4 text-left">
                <h3 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Utilisateurs Internationaux</h3>
                <p className="text-xs text-slate-500 leading-relaxed">Payez par Carte Bancaire via Stripe ou PayPal. Traitement international sécurisé.</p>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={handleStripePayment}
                    disabled={isFinishingPayment}
                    className="w-full py-3 bg-white text-black font-bold rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    {isFinishingPayment ? "Redirection..." : "Payer par Carte"}
                  </button>
                  <button 
                    onClick={handleActivatePro}
                    className="w-full py-2 text-slate-500 hover:text-white text-[8px] uppercase tracking-widest transition-all"
                  >
                    Utiliser un code de licence
                  </button>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowPaywall(false)}
              className="text-slate-500 text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors"
            >
              Peut-être plus tard
            </button>
          </motion.div>
        )}

        {capturedImages.length === 0 && !transcriptionResult && !showPaywall && (
          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full pt-16">
            {/* Header / Navigation Bar - Horizontally Scrollable on Mobile */}
            <div className="fixed top-8 left-0 right-0 px-6 z-30 pointer-events-none">
              <div className="max-w-4xl mx-auto flex items-center gap-4 pointer-events-auto">
                <div className="flex-1 overflow-x-auto no-scrollbar pb-2">
                  <div className="flex items-center gap-3 glass-card p-2 rounded-full w-max min-w-full sm:min-w-0">
                    <div className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] uppercase font-bold tracking-[0.3em] bg-teal-500 text-black shadow-[0_0_30px_rgba(20,184,166,0.4)] whitespace-nowrap">
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Scanner IA
                    </div>
                    
                    <div className="h-4 w-[1px] bg-white/20 mx-1" />
                    
                    <button 
                      onClick={() => setIsSettingsOpen(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-white transition-all whitespace-nowrap overflow-hidden group relative bg-white/5"
                    >
                      <Settings className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-700" />
                      <span>Paramètres</span>
                    </button>

                    <button 
                      onClick={shareApp}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] uppercase font-bold tracking-widest text-teal-400 hover:text-teal-300 transition-all whitespace-nowrap bg-teal-500/10 border border-teal-500/10 group"
                    >
                      {showInstallBtn ? (
                        <>
                          <Smartphone className="w-3.5 h-3.5 animate-pulse text-teal-300" />
                          <span>Installer l'App</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5 text-teal-400 group-hover:scale-110 transition-transform" />
                          <span>Installer & Partager</span>
                        </>
                      )}
                    </button>

                    <div className="h-4 w-[1px] bg-white/20 mx-1" />
                    
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-full whitespace-nowrap">
                       <div className={`w-1 h-1 rounded-full ${isPro ? "bg-teal-500" : "bg-orange-500"}`} />
                       <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500">
                         {isPro ? "Pro" : `${scanCount}/${FREE_LIMIT}`}
                       </span>
                    </div>

                    {isPrivateMode && (
                      <>
                        <div className="h-4 w-[1px] bg-white/20 mx-1" />
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-teal-500/10 border border-teal-500/20 rounded-full whitespace-nowrap">
                          <div className="w-1 h-1 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_rgba(45,212,191,1)]" />
                          <span className="text-[7px] font-mono uppercase tracking-widest text-teal-400 font-bold">
                            Mode Privé
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col justify-center"
            >
              <Scanner 
                onImagesCaptured={handleImagesCaptured} 
                selectedLanguage={selectedLanguage}
              />
            </motion.div>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center justify-between backdrop-blur-md">
            <span>{error}</span>
            <button 
              onClick={handleReset}
              className="px-3 py-1 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {transcriptionResult && (
          <div className="flex-1 w-full">
            <ResultView 
              images={capturedImages} 
              result={transcriptionResult} 
              onReset={handleReset} 
            />
          </div>
        )}

        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          languages={LANGUAGES}
          history={history}
          onClearHistory={clearHistory}
          onSelectHistoryItem={selectHistoryItem}
          isPrivateMode={isPrivateMode}
          onPrivateModeChange={handlePrivateModeChange}
          isScreenProtect={isScreenProtect}
          onScreenProtectChange={handleScreenProtectChange}
        />
        <QRCodeModal 
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          url={window.location.origin.includes("ais-dev-") ? window.location.origin.replace("ais-dev-", "ais-pre-") : window.location.origin}
          onInstall={handleInstallApp}
          showInstallBtn={showInstallBtn}
          initialTab={qrModalTab}
        />
        <TermsModal 
          isOpen={isTermsOpen}
          onClose={() => setIsTermsOpen(false)}
        />
        <OnboardingModal 
          isOpen={isOnboardingOpen}
          onClose={() => {
            setIsOnboardingOpen(false);
            localStorage.setItem("abookscan_onboarded", "true");
          }}
        />

        {/* Automatic Highly Visible PWA Install Banner */}
        <AnimatePresence>
          {showFloatingInstallBanner && (
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-[380px] z-[100] p-5 rounded-3xl bg-zinc-900/98 border border-teal-500/20 shadow-[0_10px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col gap-4 text-left pointer-events-auto"
            >
              <button
                onClick={handleDismissFloatingBanner}
                className="absolute top-3.5 right-3.5 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-start gap-3 pr-6">
                <div className="p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 shrink-0 text-teal-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-teal-400 font-bold">Installation Rapide</span>
                    <Sparkles className="w-3 h-3 text-teal-300 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">Scanner en Pleine Vitesse</h3>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed font-light">
                Ajoutez AbookScan sur votre écran d'accueil sans passer par l'App Store. Bénéficiez d'un accès instantané et d'un confort de scan accru !
              </p>

              <div className="flex gap-2.5 mt-1">
                <button
                  onClick={showInstallBtn ? handleInstallApp : handleOpenInstallGuide}
                  className="flex-1 py-2.5 bg-teal-500 text-black font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-teal-400 transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] text-center flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="w-3 h-3" />
                  {showInstallBtn ? "Installer l'App" : "Comment Installer"}
                </button>
                <button
                  onClick={handleDismissFloatingBanner}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all text-center border border-white/5"
                >
                  Plus tard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / System Status */}
      <footer className="fixed bottom-0 left-0 right-0 p-2 flex flex-col items-center gap-1.5 pointer-events-none z-20">
        <button 
          onClick={() => setIsTermsOpen(true)}
          className="px-3 py-1 bg-black/40 backdrop-blur-md border border-white/5 rounded-full text-[7px] uppercase tracking-[0.2em] text-slate-500 hover:text-teal-500 hover:border-teal-500/20 transition-all pointer-events-auto shadow-2xl"
        >
          Conditions d'Utilisation • Confidentialité
        </button>
        
        <div className="px-4 py-1 bg-zinc-900/80 backdrop-blur-xl border border-white/5 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-3">
          <div className="w-1 h-1 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,1)]" />
          <p className="text-[9px] font-mono text-slate-500 tracking-widest uppercase">
            Système Actif • AbookScan v2.4 • <span className="text-teal-500/70">Sécurisé</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

