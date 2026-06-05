import { motion, AnimatePresence } from "motion/react";
import { X, Globe, History, Phone, Mail, Trash2, ShieldCheck, ExternalLink } from "lucide-react";
import { useState } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  languages: { code: string; label: string }[];
  history: any[];
  onClearHistory: () => void;
  onSelectHistoryItem: (item: any) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  selectedLanguage,
  onLanguageChange,
  languages,
  history,
  onClearHistory,
  onSelectHistoryItem
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "history">("general");
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-lg bg-zinc-900 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
              <h2 className="text-sm font-display font-light text-white flex items-center gap-2">
                Panneau de Configuration <span className="text-[10px] text-teal-500 font-mono uppercase tracking-widest">v2.0</span>
              </h2>
              <button 
                onClick={() => {
                  onClose();
                  setIsConfirmingClear(false);
                }} 
                className="p-2 rounded-full hover:bg-white/10 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex p-2 gap-2 bg-black/20">
              <button 
                onClick={() => {
                  setActiveTab("general");
                  setIsConfirmingClear(false);
                }}
                className={`flex-1 py-3 rounded-2xl text-[10px] uppercase font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${
                  activeTab === "general" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> Général
              </button>
              <button 
                onClick={() => {
                  setActiveTab("history");
                  setIsConfirmingClear(false);
                }}
                className={`flex-1 py-3 rounded-2xl text-[10px] uppercase font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${
                  activeTab === "history" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <History className="w-4 h-4" /> Historique
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {activeTab === "general" ? (
                <>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-teal-500 font-bold block">Langue du Système</label>
                    <div className="grid grid-cols-2 gap-2">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => onLanguageChange(lang.code)}
                          className={`p-2.5 rounded-lg border text-[10px] font-mono uppercase tracking-widest transition-all text-left ${
                            selectedLanguage === lang.code 
                            ? "bg-teal-500/20 border-teal-500 text-teal-400" 
                            : "bg-white/5 border-white/5 text-slate-500 hover:border-white/10"
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-teal-500 font-bold block">Canaux d'assistance</label>
                    <div className="space-y-2">
                      <a href="tel:+243811339303" className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group">
                        <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-500">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">Téléphone Direct</span>
                          <span className="text-xs text-white font-mono">+243 811 339 303</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-700 group-hover:text-teal-500" />
                      </a>
                      <a href="mailto:delphinabook08@gmail.com" className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group">
                        <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-500">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">Email Support</span>
                          <span className="text-xs text-white font-mono">delphinabook08@gmail.com</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-700 group-hover:text-teal-500" />
                      </a>
                    </div>
                  </div>

                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-teal-500 font-bold">Archives Locales</label>
                    {isConfirmingClear ? (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setIsConfirmingClear(false)}
                          className="text-[8px] uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                        >
                          Annuler
                        </button>
                        <button 
                          onClick={() => {
                            onClearHistory();
                            setIsConfirmingClear(false);
                          }}
                          className="text-[8px] uppercase tracking-widest text-red-500 font-bold hover:text-red-400 transition-colors bg-red-500/10 px-2 py-1 rounded"
                        >
                          Confirmer la suppression
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsConfirmingClear(true)}
                        disabled={history.length === 0}
                        className="text-[8px] uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors disabled:opacity-20 flex items-center gap-1 group"
                      >
                        <Trash2 className="w-3 h-3 group-hover:animate-shake" /> Tout supprimer
                      </button>
                    )}
                  </div>

                  {history.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-700">
                        <History className="w-8 h-8" />
                      </div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">Aucune archive détectée</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {history.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            onSelectHistoryItem(item);
                            onClose();
                          }}
                          className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all text-left group"
                        >
                          <div className="w-12 h-16 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/10 group-hover:border-teal-500/50 transition-all">
                            <img src={item.preview} className="w-full h-full object-cover opacity-60" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <span className="block text-[8px] text-teal-500 font-mono uppercase tracking-widest mb-1">{item.date}</span>
                            <span className="block text-xs text-white truncate">{item.text.substring(0, 40)}...</span>
                          </div>
                          <div className="p-2 rounded-full bg-white/5 group-hover:bg-teal-500 group-hover:text-black transition-all">
                            <ExternalLink className="w-4 h-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-black/40 border-t border-white/5 text-center">
              <p className="text-[8px] text-slate-600 font-mono uppercase tracking-[0.3em]">
                Propulsé par AbookScan AI • RDC Kinshasa
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
