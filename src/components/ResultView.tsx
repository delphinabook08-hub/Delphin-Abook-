import { useState, useRef } from "react";
import { 
  Check, Copy, Edit2, Save, FileText, Table as TableIcon, 
  Share2, RotateCcw, Trash2, X, Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { TranscriptionResult } from "../lib/gemini";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

interface ResultViewProps {
  images: string[];
  result: TranscriptionResult;
  onReset: () => void;
}

export default function ResultView({ images, result, onReset }: ResultViewProps) {
  const [editableText, setEditableText] = useState(result.text);
  const [fileName, setFileName] = useState(`Scan_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<"word" | "pdf" | "excel" | null>(null);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editableText);
    setIsCopied(true);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExportInitiation = (format: "word" | "pdf" | "excel") => {
    if (format === "excel" && (!result.tableData || result.tableData.length === 0)) {
      alert("Aucun tableau structuré n'a été détecté.");
      return;
    }
    setPendingFormat(format);
    setIsSaveModalOpen(true);
  };

  const executeExport = async () => {
    setIsSaveModalOpen(false);
    
    if (pendingFormat === "word") {
      const doc = new Document({
        sections: [{
          properties: {},
          children: editableText.split("\n").map(line => new Paragraph({
            children: [new TextRun(line)],
          })),
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${fileName}.docx`);
    } else if (pendingFormat === "pdf") {
      const doc = new jsPDF();
      const splitText = doc.splitTextToSize(editableText, 180);
      doc.text(splitText, 15, 20);
      doc.save(`${fileName}.pdf`);
    } else if (pendingFormat === "excel") {
      const ws = XLSX.utils.aoa_to_sheet(result.tableData!);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    }
    confetti({ particleCount: 50 });
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Document AbookScan',
          text: editableText,
        });
      } catch (err) {}
    } else {
      copyToClipboard();
    }
  };

  const wordCount = editableText.trim() === "" ? 0 : editableText.trim().split(/\s+/).length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full flex flex-col gap-6 pb-12 px-4"
    >
      {/* Save Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setIsSaveModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Save className="w-8 h-8 text-teal-500" />
                </div>
                <h3 className="text-xl font-light text-white">Nommer le document</h3>
                <input 
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-teal-500/50"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && executeExport()}
                />
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-3 bg-white/5 rounded-xl text-xs uppercase font-bold text-slate-400">Annuler</button>
                  <button onClick={executeExport} className="flex-1 py-3 bg-teal-500 text-black rounded-xl text-xs uppercase font-bold">Confirmer</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onReset} className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition-colors">
            <RotateCcw className="w-5 h-5" />
          </button>
          <div className="space-y-1">
            <input 
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="text-xl font-display font-light text-white bg-transparent border-none outline-none focus:ring-1 focus:ring-teal-500/50 rounded-lg px-2"
            />
            <div className="flex items-center gap-2 px-2">
              <span className="text-[8px] uppercase font-mono text-slate-500 tracking-widest">{wordCount} mots</span>
              <div className="w-1 h-1 bg-slate-700 rounded-full" />
              <div className={`flex items-center gap-1.5 ${isEditing ? "text-teal-400" : "text-slate-500"}`}>
                <div className={`w-1 h-1 rounded-full ${isEditing ? "bg-teal-400 animate-pulse" : "bg-slate-700"}`} />
                <span className="text-[8px] uppercase font-mono tracking-widest">{isEditing ? "Mode Édition" : "Mode Lecture"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              isEditing 
              ? "bg-teal-500 text-black shadow-[0_0_20px_rgba(20,184,166,0.3)]" 
              : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
            }`}
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            {isEditing ? "Terminer" : "Éditer"}
          </button>
          <div className="w-px h-10 bg-white/10 mx-1" />
          <button 
            onClick={copyToClipboard} 
            className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            {isCopied ? <Check className="w-4 h-4 text-teal-500" /> : <Copy className="w-4 h-4" />}
            {isCopied ? "Copié" : "Copier"}
          </button>
          <button 
            onClick={shareNative} 
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-teal-500 hover:text-black transition-all"
          >
            <Share2 className="w-4 h-4" /> Partager
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        <div className={`lg:col-span-4 flex flex-col gap-4 transition-all duration-500 ${isEditing ? "opacity-30 grayscale-[0.8] scale-95 pointer-events-none" : "opacity-100"}`}>
          <div className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden flex-1 relative flex flex-col p-4 shadow-xl">
             <div className="relative w-full aspect-[3/4] bg-white rounded-xl shadow-lg overflow-hidden mb-4">
               <img src={images[activeImageIndex]} title="Aperçu original" alt="Aperçu original" className="w-full h-full object-contain" />
             </div>
             {images.length > 1 && (
               <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar justify-center">
                 {images.map((img, idx) => (
                   <button 
                     key={idx} 
                     onClick={() => setActiveImageIndex(idx)} 
                     className={`w-10 h-14 border-2 transition-all rounded-lg overflow-hidden shrink-0 ${activeImageIndex === idx ? "border-teal-500 ring-2 ring-teal-500/20" : "border-transparent opacity-50 hover:opacity-80"}`}
                   >
                     <img src={img} alt={`Source ${idx + 1}`} className="w-full h-full object-cover" />
                   </button>
                 ))}
               </div>
             )}
          </div>
        </div>

        <div className={`flex flex-col gap-6 transition-all duration-500 ${isEditing ? "lg:col-span-12" : "lg:col-span-8"}`}>
          <div className={`flex-1 overflow-hidden flex flex-col relative transition-all duration-300 ${
            isEditing 
            ? "bg-zinc-950 border-2 border-teal-500/30 rounded-[2.5rem] shadow-[0_0_50px_rgba(20,184,166,0.1)]" 
            : "bg-zinc-900 shadow-xl border border-white/5 rounded-3xl"
          }`}>
            <div className="flex-1 overflow-y-auto no-scrollbar p-10">
              {isEditing ? (
                <textarea
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  className="w-full h-full bg-transparent text-white font-light text-xl leading-relaxed outline-none resize-none placeholder:text-zinc-700"
                  placeholder="Commencez à éditer votre texte ici..."
                  autoFocus
                />
              ) : (
                <div className="text-slate-200 font-light text-lg leading-relaxed whitespace-pre-wrap selection:bg-teal-500/30">
                  {editableText}
                </div>
              )}
            </div>

            {isEditing && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-10"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-teal-500">Sauvegarde automatique active</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <button 
                  onClick={() => setIsEditing(false)}
                  className="text-[10px] uppercase font-bold tracking-widest text-white hover:text-teal-400 transition-colors"
                >
                  Valider les modifications
                </button>
              </motion.div>
            )}
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-300 ${isEditing ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
            <button 
              onClick={() => handleExportInitiation("word")}
              className="flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
            >
              <FileText className="w-5 h-5 text-blue-400" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 group-hover:text-white">DOCX</span>
            </button>
            <button 
              onClick={() => handleExportInitiation("pdf")}
              className="flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
            >
              <Download className="w-5 h-5 text-red-400" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 group-hover:text-white">PDF</span>
            </button>
            <button 
              onClick={() => handleExportInitiation("excel")}
              disabled={!result.tableData}
              className={`flex items-center justify-center gap-3 py-4 border rounded-2xl transition-all group ${
                result.tableData 
                ? "bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/10" 
                : "bg-white/2 border-white/5 opacity-50 cursor-not-allowed"
              }`}
            >
              <TableIcon className={`w-5 h-5 ${result.tableData ? "text-teal-400" : "text-slate-600"}`} />
              <span className={`text-[10px] uppercase font-bold tracking-widest ${result.tableData ? "text-teal-400" : "text-slate-600"}`}>EXCEL</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
