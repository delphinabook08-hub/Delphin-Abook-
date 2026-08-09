import { motion, AnimatePresence } from "motion/react";
import { X, ShieldCheck, FileText, Scale, Mic, Lock, Cpu, Sparkles, Languages, Eye, HelpCircle } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "dark" | "light";
}

export default function TermsModal({ isOpen, onClose, theme = "dark" }: TermsModalProps) {
  const isLight = theme === "light";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-2xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className={`w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[88vh] border transition-colors duration-200 ${
              isLight
                ? "bg-white border-slate-200 text-slate-900"
                : "bg-zinc-900 border-white/10 text-white"
            }`}
          >
            {/* Header */}
            <div className={`p-6 sm:p-8 border-b flex items-center justify-between ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
            }`}>
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-teal-500/20 rounded-2xl text-teal-500 border border-teal-500/30">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h2 className={`text-xl sm:text-2xl font-display font-semibold flex items-center gap-2 ${
                    isLight ? "text-slate-900" : "text-white"
                  }`}>
                    Conditions d'Utilisation & Confidentialité
                    <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30 rounded-full">
                      v2.6
                    </span>
                  </h2>
                  <p className={`text-[10px] uppercase tracking-widest font-mono mt-0.5 ${
                    isLight ? "text-slate-500" : "text-slate-400"
                  }`}>
                    Mise à jour majeure : Juillet 2026 • Système Linguistique & Protection Privée
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className={`p-2.5 rounded-full transition-colors ${
                  isLight ? "hover:bg-slate-200 text-slate-600" : "hover:bg-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 no-scrollbar">
              
              {/* Feature update banner */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                isLight
                  ? "bg-teal-50/80 border-teal-200 text-teal-950"
                  : "bg-gradient-to-r from-teal-950/60 via-slate-900 to-indigo-950/60 border-teal-500/30"
              }`}>
                <Sparkles className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className={`font-bold ${isLight ? "text-teal-900" : "text-white"}`}>
                    Nouveautés : Moteur Multimodal, Traduction IA & Protection Android
                  </p>
                  <p className={`${isLight ? "text-slate-700" : "text-slate-300"} leading-relaxed`}>
                    Mise à jour intégrant la dictée vocale, le traitement multimodal, le moteur linguistique étendu (Alur, Lingala, Swahili, Tshiluba, Kikongo, Français, Anglais, etc.), le confort visuel et les protocoles de masquage d'écran.
                  </p>
                </div>
              </div>

              {/* Section 1 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5 text-teal-500 font-semibold">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className={`text-xs uppercase font-bold tracking-widest ${isLight ? "text-slate-900" : "text-white"}`}>
                    1. Confidentialité & Traitement Zéro-Rétention
                  </h3>
                </div>
                <div className={`text-xs sm:text-sm leading-relaxed space-y-2 pl-7 border-l-2 border-teal-500/30 ${
                  isLight ? "text-slate-700" : "text-slate-300"
                }`}>
                  <p>
                    AbookScan garantit une confidentialité absolue de vos contenus. Vos manuscrits scannés, images, documents PDF, dictées vocales et fichiers audio sont analysés en temps réel par le moteur d'intelligence artificielle Gemini.
                  </p>
                  <p>
                    <strong>Zéro rétention sur serveurs distants :</strong> Aucun enregistrement audio, aucune image numérisée ni aucun texte transcrit ne sont conservés sur nos serveurs distants après la finalisation du traitement. Vos archives d'historique sont conservées <em>exclusivement en mémoire locale</em> sur votre propre appareil.
                  </p>
                </div>
              </section>

              {/* Section 2 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5 text-indigo-500 font-semibold">
                  <Languages className="w-5 h-5" />
                  <h3 className={`text-xs uppercase font-bold tracking-widest ${isLight ? "text-slate-900" : "text-white"}`}>
                    2. Moteur Linguistique & Traduction Instantanée
                  </h3>
                </div>
                <div className={`text-xs sm:text-sm leading-relaxed space-y-2 pl-7 border-l-2 border-indigo-500/30 ${
                  isLight ? "text-slate-700" : "text-slate-300"
                }`}>
                  <p>
                    L'application intègre un dictionnaire et un moteur de conjugaison et de grammaire pour la langue <strong>Alur</strong>, le Lingala, le Swahili, le Tshiluba, le Kikongo ainsi que les langues internationales (Français, Anglais, Espagnol, etc.).
                  </p>
                  <p>
                    L'utilisateur est libre d'utiliser les fonctionnalités de traduction et de recherche lexicale pour l'apprentissage, la rédaction ou la numérisation de textes bibliques, éducatifs ou professionnels.
                  </p>
                </div>
              </section>

              {/* Section 3 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5 text-sky-500 font-semibold">
                  <Mic className="w-5 h-5" />
                  <h3 className={`text-xs uppercase font-bold tracking-widest ${isLight ? "text-slate-900" : "text-white"}`}>
                    3. Dictée Vocale & Enregistrements Audio
                  </h3>
                </div>
                <div className={`text-xs sm:text-sm leading-relaxed space-y-2 pl-7 border-l-2 border-sky-500/30 ${
                  isLight ? "text-slate-700" : "text-slate-300"
                }`}>
                  <p>
                    L'outil de dictée vocale et d'importation de fichiers audio (MP3, WAV, M4A, OGG jusqu'à 100 Mo) est dédié à la transcription de notes, conférences ou comptes-rendus.
                  </p>
                  <p>
                    L'utilisateur garantit disposer des autorisations nécessaires en cas d'enregistrement ou d'importation de contenus audio contenant la voix ou des informations confidentielles de tiers.
                  </p>
                </div>
              </section>

              {/* Section 4 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5 text-amber-500 font-semibold">
                  <Eye className="w-5 h-5" />
                  <h3 className={`text-xs uppercase font-bold tracking-widest ${isLight ? "text-slate-900" : "text-white"}`}>
                    4. Masquage Écran & Confort Visuel Anti-Fatigue
                  </h3>
                </div>
                <div className={`text-xs sm:text-sm leading-relaxed space-y-2 pl-7 border-l-2 border-amber-500/30 ${
                  isLight ? "text-slate-700" : "text-slate-300"
                }`}>
                  <p>
                    AbookScan propose une fonction de <strong>Masquage d'Écran Récents</strong> pour flouter le contenu de l'application lorsque vous basculez vers une autre application sur votre smartphone.
                  </p>
                  <p>
                    Les modes visuels (Clair et Sombre) ont été conçus pour réduire la fatigue oculaire et optimiser le confort d'utilisation selon la luminosité de votre écran.
                  </p>
                </div>
              </section>

              {/* Section 5 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-500 font-semibold">
                  <FileText className="w-5 h-5" />
                  <h3 className={`text-xs uppercase font-bold tracking-widest ${isLight ? "text-slate-900" : "text-white"}`}>
                    5. Propriété des Fichiers & Droits d'Auteur
                  </h3>
                </div>
                <div className={`text-xs sm:text-sm leading-relaxed space-y-2 pl-7 border-l-2 border-emerald-500/30 ${
                  isLight ? "text-slate-700" : "text-slate-300"
                }`}>
                  <p>
                    Tous les textes transcrits, comptes-rendus et fichiers générés (.docx Word, .pdf, .xlsx Excel, .txt) demeurent la <strong>propriété exclusive de l'utilisateur</strong>.
                  </p>
                  <p>
                    L'application AbookScan, ses composants logiciels, marques et algorithmes linguistiques sont protégés par le droit d'auteur sous l'autorité de <strong>Delphin Abook</strong>.
                  </p>
                </div>
              </section>

              {/* Section 6 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5 text-violet-500 font-semibold">
                  <Cpu className="w-5 h-5" />
                  <h3 className={`text-xs uppercase font-bold tracking-widest ${isLight ? "text-slate-900" : "text-white"}`}>
                    6. Précision IA & Relecture Recommandée
                  </h3>
                </div>
                <div className={`text-xs sm:text-sm leading-relaxed space-y-2 pl-7 border-l-2 border-violet-500/30 ${
                  isLight ? "text-slate-700" : "text-slate-300"
                }`}>
                  <p>
                    L'IA AbookScan atteint un taux de précision moyen d'environ <strong>98,4%</strong>. Une relecture humaine attentive reste conseillée pour les documents officiels, juridiques, médicaux ou comptables.
                  </p>
                </div>
              </section>

              {/* Support Banner */}
              <section className={`p-5 rounded-2xl border space-y-2 ${
                isLight ? "bg-slate-100 border-slate-200" : "bg-zinc-950 border-white/10"
              }`}>
                <h4 className="text-[11px] uppercase font-bold text-teal-500 tracking-wider flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Assistance, Support & Vos Droits</span>
                </h4>
                <p className={`text-xs leading-relaxed ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Pour toute question concernant la confidentialité ou le fonctionnement de l'application, contactez le support :{" "}
                  <a href="mailto:delphinabook08@gmail.com" className="text-teal-500 font-semibold hover:underline">
                    delphinabook08@gmail.com
                  </a>{" "}
                  ou par téléphone au{" "}
                  <a href="tel:+243811339303" className="text-teal-500 font-semibold hover:underline">
                    +243 811 339 303
                  </a>.
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className={`p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${
              isLight ? "bg-slate-100 border-slate-200" : "bg-black/60 border-white/10"
            }`}>
              <p className={`text-[10px] font-mono uppercase tracking-widest text-center sm:text-left ${
                isLight ? "text-slate-500 font-medium" : "text-slate-500"
              }`}>
                AbookScan AI • Protection des Données & Transparence
              </p>
              <button 
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3 bg-teal-500 hover:bg-teal-400 text-black text-xs uppercase font-bold tracking-widest rounded-full transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
              >
                J'accepte les conditions
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


