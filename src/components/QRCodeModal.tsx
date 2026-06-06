import { motion, AnimatePresence } from "motion/react";
import { 
  X, Download, Share2, Copy, Check, Smartphone, Monitor, Laptop, 
  HelpCircle, QrCode, Sparkles, AlertCircle, ChevronRight
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState, useEffect } from "react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  onInstall?: () => void;
  showInstallBtn?: boolean;
  initialTab?: "share" | "install";
}

export default function QRCodeModal({ 
  isOpen, 
  onClose, 
  url,
  onInstall,
  showInstallBtn = false,
  initialTab = "share"
}: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"share" | "install">(initialTab);
  const [installPlatform, setInstallPlatform] = useState<"android" | "ios" | "pc">("android");

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      
      // Auto-detect user platform for a personalized guide!
      const userAgent = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setInstallPlatform("ios");
      } else if (/android/.test(userAgent)) {
        setInstallPlatform("android");
      } else {
        setInstallPlatform("pc");
      }
    }
  }, [isOpen, initialTab]);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const svg = document.getElementById("abookscan-qr");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = "AbookScan_QR.png";
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl p-6 md:p-8 flex flex-col space-y-6 relative"
          >
            {/* Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400 font-bold">Options Mobiles</span>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                id="close-qr-modal-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Interactive Tabs */}
            <div className="flex p-1 bg-black/40 border border-white/5 rounded-2xl">
              <button
                onClick={() => setActiveTab("share")}
                className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${
                  activeTab === "share" 
                    ? "bg-white/10 text-white shadow-inner" 
                    : "text-slate-500 hover:text-slate-300"
                }`}
                id="tab-share-link"
              >
                <QrCode className="w-3.5 h-3.5" />
                Partager
              </button>
              <button
                onClick={() => setActiveTab("install")}
                className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${
                  activeTab === "install" 
                    ? "bg-white/10 text-white shadow-inner" 
                    : "text-slate-500 hover:text-slate-300"
                }`}
                id="tab-install-guide"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Installer l'App
              </button>
            </div>

            {/* Tab: Share / QR Code */}
            {activeTab === "share" && (
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-light text-white">Scanner pour installer</h2>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 px-4">
                    Scannez ce code QR avec un autre téléphone pour y ouvrir instantanément AbookScan.
                  </p>
                </div>

                <div className="p-5 bg-white rounded-[2rem] shadow-2xl relative group">
                  <QRCodeSVG
                    id="abookscan-qr"
                    value={url}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="w-full space-y-3">
                  <button
                    onClick={copyLink}
                    className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all group"
                    id="copy-link-btn"
                  >
                    {copied ? <Check className="w-4 h-4 text-teal-500" /> : <Copy className="w-4 h-4 text-slate-400 group-hover:text-white" />}
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 group-hover:text-white">
                      {copied ? "Lien Copié !" : "Copier le Lien Public"}
                    </span>
                  </button>

                  <button
                    onClick={downloadQR}
                    className="w-full py-4 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center justify-center gap-3 hover:bg-teal-500/20 transition-all"
                    id="download-qr-btn"
                  >
                    <Download className="w-4 h-4 text-teal-500" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-teal-500 font-bold">
                      Télécharger le Code QR
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab: PWA Installation Guide */}
            {activeTab === "install" && (
              <div className="flex flex-col space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-display font-light text-white">Comment installer ?</h2>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">
                    AbookScan est une application web progressive de haute technologie.
                  </p>
                </div>

                {/* Platform Selector buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setInstallPlatform("android")}
                    className={`py-2 rounded-xl text-[9px] uppercase font-bold tracking-wider transition-all flex flex-col items-center gap-1.5 border ${
                      installPlatform === "android"
                        ? "bg-teal-500/10 border-teal-500/30 text-teal-400"
                        : "bg-white/2 border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                    id="platform-android-btn"
                  >
                    <Smartphone className="w-4 h-4 text-green-400" />
                    Android (Chrome)
                  </button>
                  <button
                    onClick={() => setInstallPlatform("ios")}
                    className={`py-2 rounded-xl text-[9px] uppercase font-bold tracking-wider transition-all flex flex-col items-center gap-1.5 border ${
                      installPlatform === "ios"
                        ? "bg-teal-500/10 border-teal-500/30 text-teal-400"
                        : "bg-white/2 border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                    id="platform-ios-btn"
                  >
                    <Smartphone className="w-4 h-4 text-amber-500" />
                    iPhone (Safari)
                  </button>
                  <button
                    onClick={() => setInstallPlatform("pc")}
                    className={`py-2 rounded-xl text-[9px] uppercase font-bold tracking-wider transition-all flex flex-col items-center gap-1.5 border ${
                      installPlatform === "pc"
                        ? "bg-teal-500/10 border-teal-500/30 text-teal-400"
                        : "bg-white/2 border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                    id="platform-pc-btn"
                  >
                    <Monitor className="w-4 h-4 text-blue-400" />
                    PC / Mac
                  </button>
                </div>

                {/* Direct Prompt Installation (if available) */}
                {showInstallBtn && onInstall && (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-2xl text-center space-y-3"
                  >
                    <p className="text-xs text-teal-300 leading-relaxed font-light">
                      Votre navigateur supporte l'installation directe en 1 clic !
                    </p>
                    <button
                      onClick={onInstall}
                      className="w-full py-3 bg-teal-500 text-black font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-teal-400 transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)]"
                      id="direct-install-btn"
                    >
                      Installer l'application maintenant
                    </button>
                  </motion.div>
                )}

                {/* Custom Step List based on Platform */}
                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 md:p-5 space-y-4">
                  {installPlatform === "android" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Sur Google Chrome</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">1</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Ouvrez l'application web dans votre navigateur <strong className="text-white">Google Chrome</strong>.
                          </p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">2</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Appuyez sur le bouton de <strong className="text-white">Menu</strong> (les trois points verticaux en haut à droite).
                          </p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">3</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Appuyez sur <strong className="text-white">"Installer l'application"</strong> ou <strong className="text-white">"Ajouter à l'écran d'accueil"</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {installPlatform === "ios" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Sur Apple Safari</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">1</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Ouvrez le lien obligatoirement dans le navigateur <strong className="text-white">Safari</strong> de votre iPhone.
                          </p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">2</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Appuyez sur l'icône de <strong className="text-white">Partage</strong> (le rectangle avec la flèche vers le haut en bas).
                          </p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">3</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Descendez dans le menu et appuyez sur <strong className="text-amber-500">"Sur l'écran d'accueil"</strong> (Add to Home Screen).
                          </p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">4</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Appuyez enfin sur <strong className="text-white">"Ajouter"</strong> en haut à droite.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {installPlatform === "pc" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Sur Ordinateur</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">1</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Bénéficiez de l'expérience plein écran sur Chrome, Edge, Brave ou Opera sur ordinateur.
                          </p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">2</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Cliquez sur la petite <strong className="text-white">icône d'écran munie d'une flèche vers le bas</strong> (ou un symbole "+") située sur la droite de votre barre d'adresse de recherche.
                          </p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-teal-400 font-mono shrink-0 mt-0.5">3</div>
                          <p className="text-xs text-slate-300 leading-relaxed font-light">
                            Cliquez sur <strong className="text-white">"Installer"</strong>. L'application devient un raccourci de bureau indépendant.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center font-mono text-[8px] text-slate-600 py-2 uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
                  Une fois installée, l'app se lance sans navigateur !
                </div>
              </div>
            )}

            <p className="text-[8px] text-slate-600 text-center font-mono uppercase tracking-[0.2em] pt-2 border-t border-white/5">
              AbookScan IA • Progressive Web App
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
