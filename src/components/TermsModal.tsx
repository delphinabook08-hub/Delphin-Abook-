import { motion, AnimatePresence } from "motion/react";
import { X, ShieldCheck, FileText, Scale } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-2xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/20 rounded-xl text-teal-500">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-light text-white">Règles & Conditions</h2>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Dernière mise à jour : Avril 2026</p>
                </div>
              </div>
              <button onClick={onClose} className="p-3 rounded-full hover:bg-white/10 text-slate-400 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
              <section className="space-y-4">
                <div className="flex items-center gap-3 text-teal-500">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="text-xs uppercase font-bold tracking-widest">1. Intégrité des Données</h3>
                </div>
                <div className="text-sm text-slate-400 leading-relaxed font-sans space-y-3">
                  <p>AbookScan garantit une confidentialité absolue. Vos manuscrits sont traités via l'architecture neuronale Gemini et ne font l'objet d'aucune conservation persistante sur nos serveurs.</p>
                  <p>L'indexation de vos documents est stockée <strong>exclusivement</strong> sur votre terminal local. La suppression de vos données de navigation entraînera la réinitialisation de votre historique.</p>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3 text-teal-500">
                  <FileText className="w-5 h-5" />
                  <h3 className="text-xs uppercase font-bold tracking-widest">2. Gouvernance de l'Usage</h3>
                </div>
                <div className="text-sm text-slate-400 leading-relaxed font-sans space-y-3">
                  <p>L'exploitation de l'IA pour la transcription cursive relève de la responsabilité de l'utilisateur. Bien que notre taux de précision atteigne 98.4%, une vérification humaine est recommandée pour les documents critiques.</p>
                  <p>Le palier gratuit permet 3 analyses par cycle de 24h. Le protocole Pro lève toute restriction opérationnelle.</p>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3 text-teal-500">
                  <Scale className="w-5 h-5" />
                  <h3 className="text-xs uppercase font-bold tracking-widest">3. Propriété Intellectuelle</h3>
                </div>
                <div className="text-sm text-slate-400 leading-relaxed font-sans space-y-3">
                  <p>Tous les droits sur l'application AbookScan et son interface appartiennent à Delphin Abook. Toute reproduction non autorisée est strictement interdite.</p>
                  <p>Les documents générés (Word, PDF, Excel) appartiennent entièrement à l'utilisateur.</p>
                </div>
              </section>

              <section className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-3">
                <h4 className="text-[10px] uppercase font-bold text-white tracking-widest">Besoin d'éclaircissements ?</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pour toute question relative à ces conditions, veuillez contacter le support via le panneau des paramètres ou par email à : <span className="text-teal-500">delphinabook08@gmail.com</span>
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="p-8 bg-black/40 border-t border-white/5 flex items-center justify-between">
                <p className="text-[8px] text-slate-600 font-mono uppercase tracking-[0.3em]">AbookScan AI • Protection des Utilisateurs</p>
                <button 
                  onClick={onClose}
                  className="px-8 py-3 bg-white text-black text-[10px] uppercase font-bold tracking-widest rounded-full hover:bg-slate-200 transition-all"
                >
                  J'ai compris
                </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
