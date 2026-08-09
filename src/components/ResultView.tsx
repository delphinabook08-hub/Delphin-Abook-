import React, { useState, useRef } from "react";
import { 
  Check, Copy, Edit2, Save, FileText, Table as TableIcon, 
  Share2, RotateCcw, Trash2, X, Download, Sparkles, Undo2,
  Send, Mail, MessageSquare, Printer, CheckCircle2, ExternalLink,
  Languages, Volume2, VolumeX, Play, Pause, Square, BookOpen,
  ListChecks, ArrowRight, RefreshCw, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { TranscriptionResult } from "../lib/gemini";
import { checkMahagiAlurFidelity, sanitizeAndFixAlurConjugation, FidelityIssue } from "../lib/alurConjugation";
import { Document, Packer, Paragraph, TextRun, PageBreak } from "docx";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import TableView from "./TableView";
import { parseMarkdownTable } from "../lib/tableUtils";

interface ResultViewProps {
  images: string[];
  result: TranscriptionResult;
  onReset: () => void;
  activeTab?: "ocr" | "voice";
}

async function safeJsonFetch<T = any>(response: Response, defaultErrorMsg: string): Promise<T> {
  const text = await response.text().catch(() => "");
  const trimmed = text.trim();

  if (
    trimmed.startsWith("<!doctype") || 
    trimmed.startsWith("<html") || 
    trimmed.includes("Please wait while your application starts") ||
    trimmed.includes("Starting Server")
  ) {
    throw new Error("Le serveur est en cours de démarrage. Veuillez patienter un instant et réessayer.");
  }

  if (!response.ok) {
    let errDetail = defaultErrorMsg;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.error) errDetail = parsed.error;
    } catch (_) {}
    throw new Error(errDetail);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch (e) {
    throw new Error("Réponse du serveur invalide. Veuillez réessayer.");
  }
}

function HighlightedFidelityText({
  text,
  issues,
  onSelectIssue
}: {
  text: string;
  issues: FidelityIssue[];
  onSelectIssue: (issue: FidelityIssue, original: string) => void;
}) {
  if (!issues || issues.length === 0) {
    return <div className="text-slate-200 font-light text-lg leading-relaxed whitespace-pre-wrap selection:bg-teal-500/30 min-h-[320px]">{text}</div>;
  }

  const uniqueWords = Array.from(new Set(issues.map(i => i.originalWord)));
  const patterns = uniqueWords
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  if (!patterns) {
    return <div className="text-slate-200 font-light text-lg leading-relaxed whitespace-pre-wrap selection:bg-teal-500/30 min-h-[320px]">{text}</div>;
  }

  const regex = new RegExp(`(\\b(?:${patterns})\\b)`, 'gi');
  const parts = text.split(regex);

  return (
    <div className="text-slate-200 font-light text-lg leading-relaxed whitespace-pre-wrap selection:bg-teal-500/30 min-h-[320px]">
      {parts.map((part, idx) => {
        const matchingIssue = issues.find(
          iss => iss.originalWord.toLowerCase() === part.toLowerCase()
        );

        if (matchingIssue) {
          return (
            <span
              key={idx}
              onClick={() => onSelectIssue(matchingIssue, part)}
              className="inline-flex items-center gap-1 bg-amber-300 text-zinc-950 font-extrabold px-2 py-0.5 rounded-lg cursor-pointer hover:bg-amber-200 hover:scale-105 transition-all border border-amber-400 shadow-md mx-0.5 my-0.5"
              title={`Cliquer pour remplacer ${part} par ${matchingIssue.suggestedWord}`}
            >
              <span>{part}</span>
              <span className="text-[10px] bg-zinc-900 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">
                → {matchingIssue.suggestedWord}
              </span>
            </span>
          );
        }

        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}

export default function ResultView({ images, result, onReset }: ResultViewProps) {
  const [editableText, setEditableText] = useState(result.text);

  // Table Data & Active View Mode State
  const [tableData, setTableData] = useState<string[][] | null>(() => {
    if (result.tableData && result.tableData.length > 0) {
      return result.tableData;
    }
    const parsed = parseMarkdownTable(result.text);
    return parsed && parsed.length > 0 ? parsed : null;
  });

  const [activeViewMode, setActiveViewMode] = useState<"text" | "table">(() => {
    if ((result.tableData && result.tableData.length > 0) || parseMarkdownTable(result.text)) {
      return "table";
    }
    return "text";
  });
  const [fileName, setFileName] = useState(`Scan_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<"word" | "pdf" | "excel" | null>(null);

  // States for automatic AI formatting
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [previousTexts, setPreviousTexts] = useState<string[]>([]);

  // States for Direct Send / Numérisation & Envoi Direct
  const [isDirectSendOpen, setIsDirectSendOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState(`[AbookScan] ${fileName}`);
  const [customNote, setCustomNote] = useState("");
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  // FEATURE 3: Translation states
  const [isTranslateOpen, setIsTranslateOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedTargetLang, setSelectedTargetLang] = useState("Anglais");
  const [translationSuccess, setTranslationSuccess] = useState<string | null>(null);

  // FEATURE 4: AI Summary (Résumé & Points Clés Executif)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState<{ summary?: string; keyPoints?: string[]; actionItems?: string[] } | null>(null);

  // FEATURE: Text-To-Speech (Lecteur Audio Synthèse Vocale)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPausedAudio, setIsPausedAudio] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);

  // Audio Speech Handler
  const handlePlayAudio = () => {
    if (!('speechSynthesis' in window)) {
      alert("La synthèse vocale n'est pas prise en charge par ce navigateur.");
      return;
    }

    if (isPausedAudio) {
      window.speechSynthesis.resume();
      setIsPlayingAudio(true);
      setIsPausedAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(editableText);
    utterance.rate = speechRate;
    utterance.lang = "fr-FR";

    utterance.onend = () => {
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
    };

    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
    setIsPausedAudio(false);
  };

  const handlePauseAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPlayingAudio(false);
      setIsPausedAudio(true);
    }
  };

  const handleStopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
    }
  };

  // FEATURE 5: Mahagi Alur Fidelity Comparison
  const [isFidelityCheckActive, setIsFidelityCheckActive] = useState(true);
  const [activeFidelityIssue, setActiveFidelityIssue] = useState<{ issue: FidelityIssue; original: string } | null>(null);

  const fidelityIssues = React.useMemo(() => {
    return checkMahagiAlurFidelity(editableText);
  }, [editableText]);

  // Translation Handler
  const handleTranslateText = async (lang: string) => {
    if (isTranslating || !editableText.trim()) return;
    setIsTranslating(true);
    setTranslationSuccess(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editableText,
          targetLanguage: lang,
        }),
      });

      const data = await safeJsonFetch<{ translatedText?: string }>(response, "Échec du service de traduction.");
      if (data.translatedText) {
        setPreviousTexts(prev => [...prev, editableText]);
        setEditableText(data.translatedText);
        setTranslationSuccess(`Document traduit avec succès en ${lang} !`);
        confetti({ particleCount: 70 });
        setTimeout(() => setIsTranslateOpen(false), 1200);
      }
    } catch (err: any) {
      alert(err.message || "Erreur lors de la traduction du document.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Summary Handler
  const handleGenerateSummary = async () => {
    setIsSummaryOpen(true);
    if (summaryData || isSummarizing || !editableText.trim()) return;
    setIsSummarizing(true);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editableText,
          language: "French",
        }),
      });

      const data = await safeJsonFetch(response, "Échec de la génération de la synthèse.");
      setSummaryData(data);
      confetti({ particleCount: 60 });
    } catch (err: any) {
      alert(err.message || "Erreur lors de la création de la synthèse.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handlePlaySummaryAudio = () => {
    if (!('speechSynthesis' in window)) {
      alert("La synthèse vocale n'est pas prise en charge par ce navigateur.");
      return;
    }

    if (isPausedAudio) {
      window.speechSynthesis.resume();
      setIsPlayingAudio(true);
      setIsPausedAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const textToRead = summaryData
      ? `Résumé : ${summaryData.summary}. Points clés : ${summaryData.keyPoints?.join(". ") || ""}`
      : editableText;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = speechRate;
    utterance.lang = "fr-FR";

    utterance.onend = () => {
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
    };

    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
    setIsPausedAudio(false);
  };

  const openDirectSendModal = () => {
    setEmailSubject(`[Document Numérisé] ${fileName}`);
    setIsDirectSendOpen(true);
    setSendSuccessMessage(null);
  };

  const handleDirectEmailSend = (e: React.FormEvent) => {
    e.preventDefault();
    const fullBody = `${customNote ? customNote + "\n\n-------------------------\n\n" : ""}TEXTE DU DOCUMENT NUMÉRISÉ (${new Date().toLocaleDateString()}) :\n\n${editableText}\n\n---\nNumérisé et transmis via AbookScan AI`;
    
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(fullBody)}`;
    window.location.href = mailtoUrl;

    setSendSuccessMessage("Client e-mail ouvert avec le document numérisé prêt à l'envoi !");
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleWhatsAppSend = () => {
    const message = `*${emailSubject}*\n\n${editableText}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");

    setSendSuccessMessage("Document prêt pour envoi instantané sur WhatsApp !");
    confetti({ particleCount: 60 });
  };

  const handlePrintDirect = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${fileName}</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
              h1 { border-bottom: 2px solid #0d9488; padding-bottom: 8px; font-size: 20px; }
              .meta { font-size: 12px; color: #666; margin-bottom: 24px; }
              .content { white-space: pre-wrap; font-size: 14px; }
              .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 10px; color: #888; }
            </style>
          </head>
          <body>
            <h1>${fileName}</h1>
            <div class="meta">Document numérisé le ${new Date().toLocaleString()} - AbookScan AI</div>
            <div class="content">${editableText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            <div class="footer">Numérisation et transcription haute définition AbookScan</div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleAIFormatting = async (style: string) => {
    if (isFormatting) return;
    setIsFormatting(true);
    setIsFormatMenuOpen(false);

    try {
      const response = await fetch("/api/format", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: editableText,
          style: style,
        }),
      });

      const data = await safeJsonFetch<{ formattedText?: string }>(
        response, 
        "Impossible de communiquer avec le serveur pour la mise en forme."
      );
      if (data.formattedText) {
        setPreviousTexts(prev => [...prev, editableText]);
        setEditableText(data.formattedText);
        confetti({
          particleCount: 100,
          spread: 80,
          colors: ["#14b8a6", "#3b82f6", "#ffffff"]
        });
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Impossible de réaliser la mise en forme de texte par l'IA.");
    } finally {
      setIsFormatting(false);
    }
  };

  const handleUndo = () => {
    if (previousTexts.length === 0) return;
    const prevText = previousTexts[previousTexts.length - 1];
    setEditableText(prevText);
    setPreviousTexts(prev => prev.slice(0, prev.length - 1));
  };

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
    setPendingFormat(format);
    setIsSaveModalOpen(true);
  };

  const handleDownloadRawScanImages = () => {
    if (!images || images.length === 0) {
      alert("Aucune image de numérisation d'origine disponible.");
      return;
    }
    images.forEach((imgBase64, idx) => {
      const link = document.createElement("a");
      link.href = imgBase64;
      link.download = `${fileName}_page_${idx + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    confetti({ particleCount: 50 });
  };

  const executeExport = async () => {
    setIsSaveModalOpen(false);
    
    if (pendingFormat === "word") {
      const paragraphs: Paragraph[] = [];
      const lines = editableText.split("\n");

      lines.forEach((line, idx) => {
        const isPageMarker = line.trim().startsWith("[--- Page") || line.trim().startsWith("[---");
        
        if (isPageMarker && idx > 0) {
          // Insert page break before subsequent page headers
          paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
        }

        paragraphs.push(new Paragraph({
          children: [
            new TextRun({
              text: line,
              bold: isPageMarker,
              size: isPageMarker ? 28 : 24, // 14pt for page markers, 12pt for regular text
              color: isPageMarker ? "0D9488" : "000000", // Teal accent for headers
            })
          ],
          spacing: { after: 120 }
        }));
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${fileName}.docx`);
    } else if (pendingFormat === "pdf") {
      const doc = new jsPDF();
      if (images && images.length > 0) {
        images.forEach((imgBase64, index) => {
          if (index > 0) doc.addPage();
          try {
            doc.addImage(imgBase64, "JPEG", 10, 10, 190, 240);
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`AbookScan - Document Numérisé Original - Page ${index + 1} sur ${images.length}`, 10, 255);
          } catch (err) {
            console.error("Error embedding scan image in PDF:", err);
          }
        });
        
        // Add full multi-page transcribed text with automatic pagination
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(20, 184, 166);
        doc.text("Transcription Complète Multipage", 15, 15);
        doc.setFontSize(10);
        doc.setTextColor(30);
        
        const splitText = doc.splitTextToSize(editableText, 180);
        let cursorY = 25;
        const pageHeight = 275;
        const lineHeight = 6;

        splitText.forEach((line: string) => {
          if (cursorY + lineHeight > pageHeight) {
            doc.addPage();
            cursorY = 20;
          }
          doc.text(line, 15, cursorY);
          cursorY += lineHeight;
        });
      } else {
        const splitText = doc.splitTextToSize(editableText, 180);
        let cursorY = 20;
        const pageHeight = 275;
        const lineHeight = 6;

        splitText.forEach((line: string) => {
          if (cursorY + lineHeight > pageHeight) {
            doc.addPage();
            cursorY = 20;
          }
          doc.text(line, 15, cursorY);
          cursorY += lineHeight;
        });
      }
      doc.save(`${fileName}.pdf`);
    } else if (pendingFormat === "excel") {
      let rows: string[][] = [];
      if (tableData && tableData.length > 0) {
        rows = tableData;
      } else {
        // Fallback: convert transcribed text into tabular rows by lines
        rows = [["Ligne", "Contenu Numérisé"]];
        const lines = editableText.split("\n").filter(l => l.trim().length > 0);
        lines.forEach((l, idx) => {
          rows.push([`Ligne ${idx + 1}`, l]);
        });
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transcription_Numérisée");
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
                  onChange={(e) => setFileName(e.value ? e.value : e.target.value)}
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

      {/* Direct Send Modal (Numérisation pour Envoi Direct) */}
      <AnimatePresence>
        {isDirectSendOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md" 
              onClick={() => setIsDirectSendOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-2xl border border-teal-500/30">
                    <Send className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      Envoi Direct du Document
                    </h3>
                    <p className="text-xs text-slate-400">Transmettez votre numérisation en 1 clic sans intermédiaire</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDirectSendOpen(false)}
                  className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {sendSuccessMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{sendSuccessMessage}</span>
                </motion.div>
              )}

              {/* Form Email Direct Send */}
              <form onSubmit={handleDirectEmailSend} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-teal-400" />
                    <span>E-mail du destinataire</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="exemple@entreprise.com ou destinataire@domaine.fr"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Objet du message</label>
                  <input
                    type="text"
                    required
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Note ou message d'accompagnement (facultatif)</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Veuillez trouver ci-joint le compte-rendu de la réunion numérisé ce jour..."
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Mail className="w-4 h-4" />
                  <span>Envoyer par E-mail Direct</span>
                </button>
              </form>

              {/* Alternative Instant Dispatch Channels */}
              <div className="pt-2 border-t border-white/10 space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Autres Canaux d'Envoi Direct :</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleWhatsAppSend}
                    className="p-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp Direct</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintDirect}
                    className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <Printer className="w-4 h-4 text-indigo-400" />
                    <span>Impression Directe</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FEATURE 3: Translation Modal */}
      <AnimatePresence>
        {isTranslateOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/75 backdrop-blur-md" 
              onClick={() => !isTranslating && setIsTranslateOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                    <Languages className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      Traduction Instantanée IA
                    </h3>
                    <p className="text-xs text-slate-400">Traduisez le texte de votre document en +10 langues</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTranslateOpen(false)}
                  disabled={isTranslating}
                  className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {translationSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{translationSuccess}</span>
                </motion.div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Sélectionnez la langue cible :
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { code: "Français", label: "Français 🇫🇷" },
                    { code: "Anglais", label: "English 🇬🇧" },
                    { code: "Dhu Alur", label: "Dhu Alur (Mahagi) 🇨🇩🇺🇬" },
                    { code: "Lingala", label: "Lingala 🇨🇩" },
                    { code: "Swahili", label: "Kiswahili 🇰🇪" },
                    { code: "Tshiluba", label: "Tshiluba (Ciluba) 🇨🇩" },
                    { code: "Kikongo", label: "Kikongo (Kikongo ya Leta) 🇨🇩" },
                    { code: "Espagnol", label: "Español 🇪🇸" },
                    { code: "Português", label: "Português 🇵🇹" },
                    { code: "Allemand", label: "Deutsch 🇩🇪" },
                    { code: "Italien", label: "Italiano 🇮🇹" },
                    { code: "Arabe", label: "العربية 🇸🇦" },
                    { code: "Chinois", label: "中文 🇨🇳" },
                    { code: "Japonais", label: "日本語 🇯🇵" },
                  ].map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      disabled={isTranslating}
                      onClick={() => {
                        setSelectedTargetLang(item.code);
                        handleTranslateText(item.code);
                      }}
                      className={`p-3 rounded-2xl border text-xs font-semibold transition-all flex items-center justify-between ${
                        selectedTargetLang === item.code
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/10"
                        : "bg-black/40 border-white/10 hover:border-white/20 text-slate-300 hover:text-white"
                      }`}
                    >
                      <span>{item.label}</span>
                      {selectedTargetLang === item.code && isTranslating && (
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {isTranslating && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-indigo-300">Traduction en cours par Gemini AI...</p>
                    <p className="text-slate-400 text-[10px]">Préservation du sens et de la structure originale</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FEATURE 4: AI Summary & Key Takeaways Modal */}
      <AnimatePresence>
        {isSummaryOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/75 backdrop-blur-md" 
              onClick={() => {
                handleStopAudio();
                setIsSummaryOpen(false);
              }} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-zinc-900 border border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-2xl border border-teal-500/30">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      Synthèse Exécutive & Points Clés
                    </h3>
                    <p className="text-xs text-slate-400">Analyse synthétique intelligente de votre document numérisé</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleStopAudio();
                    setIsSummaryOpen(false);
                  }}
                  className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isSummarizing ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-teal-500/10 border border-teal-500/20 rounded-full flex items-center justify-center animate-pulse">
                    <Sparkles className="w-8 h-8 text-teal-400 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">Analyse du document en cours...</h4>
                    <p className="text-xs text-slate-400">Gemini extrait les points clés et rédige un résumé clair</p>
                  </div>
                </div>
              ) : summaryData ? (
                <div className="space-y-5">
                  {/* Executive Summary Audio Reader Controls */}
                  <div className="p-3 bg-black/60 border border-teal-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-white text-xs block">Lecture Vocale du Résumé</span>
                        <span className="text-[9px] text-slate-400">Écoutez la synthèse vocale IA du résumé</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPlayingAudio ? (
                        <button
                          type="button"
                          onClick={handlePauseAudio}
                          className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl font-bold flex items-center gap-1.5 hover:bg-amber-500/30 transition-all text-xs"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePlaySummaryAudio}
                          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-black font-bold rounded-xl flex items-center gap-1.5 transition-all text-xs shadow-lg shadow-teal-500/20"
                        >
                          <Play className="w-3.5 h-3.5 fill-black" />
                          <span>{isPausedAudio ? "Reprendre" : "Écouter le Résumé"}</span>
                        </button>
                      )}

                      {(isPlayingAudio || isPausedAudio) && (
                        <button
                          type="button"
                          onClick={handleStopAudio}
                          className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl transition-all"
                          title="Arrêter la lecture"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="flex items-center bg-black/50 border border-white/10 rounded-xl p-1 gap-1">
                        {[0.8, 1, 1.25, 1.5].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setSpeechRate(rate)}
                            className={`px-1.5 py-0.5 rounded-lg text-[9px] font-bold ${
                              speechRate === rate
                              ? "bg-teal-500 text-black"
                              : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Executive Summary Card */}
                  <div className="p-4 bg-teal-500/10 border border-teal-500/25 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" />
                      <span>Résumé Exécutif</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {summaryData.summary}
                    </p>
                  </div>

                  {/* Key Points */}
                  {summaryData.keyPoints && summaryData.keyPoints.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-wider">
                        <ListChecks className="w-4 h-4 text-emerald-400" />
                        <span>Points Clés Importants</span>
                      </div>
                      <div className="space-y-2">
                        {summaryData.keyPoints.map((point, idx) => (
                          <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
                            <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Items */}
                  {summaryData.actionItems && summaryData.actionItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                        <ArrowRight className="w-4 h-4" />
                        <span>Actions & Décisions</span>
                      </div>
                      <div className="space-y-1.5">
                        {summaryData.actionItems.map((item, idx) => (
                          <div key={idx} className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        const summaryText = `RÉSUMÉ EXÉCUTIF (${fileName}):\n${summaryData.summary}\n\nPOINTS CLÉS:\n${summaryData.keyPoints?.map(p => `• ${p}`).join("\n")}`;
                        navigator.clipboard.writeText(summaryText);
                        confetti({ particleCount: 50 });
                        alert("Synthèse copiée dans le presse-papier !");
                      }}
                      className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copier la Synthèse</span>
                    </button>
                  </div>
                </div>
              ) : null}
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
            <div className="flex items-center gap-2 px-2 flex-wrap">
              <span className="text-[8px] uppercase font-mono text-slate-500 tracking-widest">{wordCount} mots</span>
              <div className="w-1 h-1 bg-slate-700 rounded-full" />
              <div className="flex items-center gap-1.5 text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                <Layers className="w-3 h-3 text-teal-400" />
                <span className="text-[8px] uppercase font-mono tracking-widest font-bold">
                  {images.length > 1 ? `Dossier Multi-Pages (${images.length} pages)` : "Document Unique"}
                </span>
              </div>
              <div className="w-1 h-1 bg-slate-700 rounded-full" />
              <div className={`flex items-center gap-1.5 ${isEditing ? "text-teal-400" : "text-slate-500"}`}>
                <div className={`w-1 h-1 rounded-full ${isEditing ? "bg-teal-400 animate-pulse" : "bg-slate-700"}`} />
                <span className="text-[8px] uppercase font-mono tracking-widest font-bold">
                  {isEditing ? "Mode Édition" : "Mode Lecture OCR"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {previousTexts.length > 0 && (
            <button
              onClick={handleUndo}
              title="Annuler le dernier formatage IA"
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/25 text-red-400 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-md"
            >
              <Undo2 className="w-4 h-4" /> Annuler IA
            </button>
          )}

          <div className="relative">
            <button 
              onClick={() => setIsFormatMenuOpen(!isFormatMenuOpen)} 
              disabled={isFormatting}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                isFormatMenuOpen || isFormatting
                ? "bg-teal-500 text-black shadow-[0_0_20px_rgba(20,184,166,0.4)]" 
                : "bg-teal-500/15 border border-teal-500/30 text-teal-400 hover:bg-teal-500/30"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isFormatting ? "animate-spin" : "animate-pulse"}`} />
              {isFormatting ? "Formatage..." : "Mise en forme IA"}
            </button>

              <AnimatePresence>
                {isFormatMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsFormatMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-white/10 rounded-2xl p-4 shadow-2xl z-50 space-y-2.5 text-left"
                    >
                      <div className="pb-2 border-b border-white/5">
                        <h4 className="text-[10px] uppercase tracking-widest font-bold text-teal-400 font-sans">Mettre en forme automatiquement</h4>
                        <p className="text-[9px] text-slate-400 leading-normal">Optimisez le texte de votre scan par l'IA</p>
                      </div>

                      <button
                        onClick={() => handleAIFormatting("standard")}
                        className="w-full text-left p-2 hover:bg-white/5 rounded-xl transition-all flex flex-col items-start gap-0.5 bg-transparent"
                      >
                        <span className="text-xs text-white font-medium">Standard (Aéré & Propre)</span>
                        <span className="text-[9px] text-slate-400">Paragraphes fluides, correction orthographique robuste</span>
                      </button>

                      <button
                        onClick={() => handleAIFormatting("bullets")}
                        className="w-full text-left p-2 hover:bg-white/5 rounded-xl transition-all flex flex-col items-start gap-0.5 bg-transparent"
                      >
                        <span className="text-xs text-white font-medium">Liste à puces logique</span>
                        <span className="text-[9px] text-slate-400">Convertit le texte en points clés et tirets lisibles</span>
                      </button>

                      <button
                        onClick={() => handleAIFormatting("resume")}
                        className="w-full text-left p-2 hover:bg-white/5 rounded-xl transition-all flex flex-col items-start gap-0.5 bg-transparent"
                      >
                        <span className="text-xs text-white font-medium">Structure Rapport / Synthèse</span>
                        <span className="text-[9px] text-slate-400">Ajout d'en-têtes, divisions claires et sections</span>
                      </button>

                      <button
                        onClick={() => handleAIFormatting("formal")}
                        className="w-full text-left p-2 hover:bg-white/5 rounded-xl transition-all flex flex-col items-start gap-0.5 bg-transparent"
                      >
                        <span className="text-xs text-white font-medium">Courrier & E-mail Formel</span>
                        <span className="text-[9px] text-slate-400">S'adapte au format lettre officielle polie</span>
                      </button>
                      
                      <div className="pt-2 text-center border-t border-white/5">
                        <span className="text-[7px] uppercase tracking-widest font-mono text-slate-500">AbookScan AI Auto-formatting</span>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

          {/* FEATURE 3: Traduction Instantanée IA Button */}
          <button
            onClick={() => setIsTranslateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-md"
            title="Traduire le document numérisé en d'autres langues"
          >
            <Languages className="w-4 h-4 text-indigo-400" />
            <span>Traduire IA</span>
          </button>

          {/* FEATURE 4: Résumé Exécutif & Points Clés Button */}
          <button
            onClick={handleGenerateSummary}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500/15 border border-teal-500/30 text-teal-300 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-teal-500 hover:text-black transition-all shadow-md"
            title="Générer un résumé synthétique du document"
          >
            <BookOpen className="w-4 h-4 text-teal-400" />
            <span>Résumé IA</span>
          </button>

          {/* FEATURE 5: Fidélité Mahagi / JW.ORG Dhu Alur Button */}
          <button
            onClick={() => setIsFidelityCheckActive(!isFidelityCheckActive)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all shadow-md ${
              isFidelityCheckActive && fidelityIssues.length > 0
                ? "bg-amber-400 text-black shadow-amber-400/30 font-extrabold"
                : "bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
            }`}
            title="Activer/Désactiver la comparaison de fidélité Mahagi / JW.ORG en Dhu Alur"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Fidélité Dhu Alur</span>
            {fidelityIssues.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-zinc-900 text-amber-300 font-mono text-[9px] font-bold">
                {fidelityIssues.length}
              </span>
            )}
          </button>

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
            onClick={openDirectSendModal}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-black font-bold rounded-full text-[10px] uppercase tracking-widest hover:scale-105 shadow-lg shadow-teal-500/20 transition-all"
          >
            <Send className="w-4 h-4" /> Envoi Direct
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
            <AnimatePresence>
              {isFormatting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/75 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 text-center p-6 rounded-3xl"
                >
                  <div className="relative">
                    <div className="w-16 h-16 border-t-2 border-b-2 border-teal-500 rounded-full animate-spin" />
                    <Sparkles className="w-6 h-6 text-teal-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white tracking-tight">Mise en forme IA en cours...</p>
                    <p className="text-xs text-slate-400 leading-relaxed font-light">
                      L'IA de haute précision réorganise et corrige l'écriture manuscrite...
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* FEATURE: View Mode Switcher - Texte vs Tableau Éditable */}
            <div className="px-6 py-3 border-b border-white/10 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 bg-black/50 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveViewMode("text")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    activeViewMode === "text"
                      ? "bg-teal-500 text-black shadow-md shadow-teal-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Texte Transcrit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!tableData || tableData.length === 0) {
                      const parsed = parseMarkdownTable(editableText);
                      if (parsed) {
                        setTableData(parsed);
                      } else {
                        const lines = editableText.split("\n").filter(l => l.trim().length > 0);
                        const defaultRows = lines.length > 0 
                          ? [["N°", "Contenu Numérisé"], ...lines.map((l, i) => [`${i + 1}`, l])]
                          : [["En-tête 1", "En-tête 2"], ["", ""]];
                        setTableData(defaultRows);
                      }
                    }
                    setActiveViewMode("table");
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    activeViewMode === "table"
                      ? "bg-teal-500 text-black shadow-md shadow-teal-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Vue Tableau Éditable</span>
                  {tableData && tableData.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-black/40 text-[10px] text-teal-300 font-mono rounded-full border border-teal-500/30">
                      {tableData.length - 1}L
                    </span>
                  )}
                </button>
              </div>

              {tableData && tableData.length > 0 && (
                <div className="flex items-center gap-2 text-teal-300 bg-teal-500/10 px-3 py-1.5 rounded-xl border border-teal-500/20 font-medium text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  <span>Tableau IA : {tableData.length - 1} lignes × {tableData[0]?.length || 0} colonnes</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 min-h-[350px]">
              {isFidelityCheckActive && fidelityIssues.length > 0 && activeViewMode === "text" && !isEditing && (
                <div className="mb-4 p-4 bg-amber-950/70 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-xl shadow-amber-500/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">Comparaison de Fidélité Dhu Alur (Mahagi / JW.ORG)</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black font-extrabold text-[10px]">
                          {fidelityIssues.length} terme(s) surligné(s)
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        Mots non conformes au vocabulaire officiel de Mahagi (JW.ORG) surlignés en jaune. Cliquez dessus pour corriger.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const sanitized = sanitizeAndFixAlurConjugation(editableText);
                        setPreviousTexts(prev => [...prev, editableText]);
                        setEditableText(sanitized);
                        confetti({ particleCount: 80 });
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Tout Corriger ({fidelityIssues.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {activeViewMode === "table" && tableData && tableData.length > 0 ? (
                <TableView
                  initialData={tableData}
                  onDataChange={(newData) => setTableData(newData)}
                  fileName={fileName}
                  isEditable={true}
                />
              ) : isEditing ? (
                <textarea
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  className="w-full h-full bg-transparent text-white font-light text-xl leading-relaxed outline-none resize-none placeholder:text-zinc-700 min-h-[320px]"
                  placeholder="Commencez à éditer votre texte ici..."
                  autoFocus
                />
              ) : isFidelityCheckActive && fidelityIssues.length > 0 ? (
                <HighlightedFidelityText
                  text={editableText}
                  issues={fidelityIssues}
                  onSelectIssue={(iss, orig) => setActiveFidelityIssue({ issue: iss, original: orig })}
                />
              ) : (
                <div className="text-slate-200 font-light text-lg leading-relaxed whitespace-pre-wrap selection:bg-teal-500/30 min-h-[320px]">
                  {editableText}
                </div>
              )}
            </div>

            {isEditing && activeViewMode === "text" && (
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

          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 transition-all duration-300 ${isEditing ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
            <button 
              onClick={openDirectSendModal}
              className="flex items-center justify-center gap-2 py-4 bg-teal-500/15 border border-teal-500/30 rounded-2xl hover:bg-teal-500 hover:text-black transition-all group text-teal-400 hover:text-black"
            >
              <Send className="w-4 h-4 text-teal-400 group-hover:text-black" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Envoi Direct</span>
            </button>

            {images && images.length > 0 && (
              <button 
                onClick={handleDownloadRawScanImages}
                className="flex items-center justify-center gap-2 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all group text-emerald-400"
                title="Télécharger les numérisations HD d'origine"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] uppercase font-bold tracking-widest">Images HD</span>
              </button>
            )}

            <button 
              onClick={() => handleExportInitiation("pdf")}
              className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
              title="Générer le PDF numérisé direct"
            >
              <FileText className="w-4 h-4 text-red-400" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-300 group-hover:text-white">PDF Scan</span>
            </button>

            <button 
              onClick={() => handleExportInitiation("word")}
              className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
              title="Exporter au format Microsoft Word (.docx)"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 group-hover:text-white">DOCX</span>
            </button>

            <button 
              onClick={() => handleExportInitiation("excel")}
              className="flex items-center justify-center gap-2 py-4 border rounded-2xl transition-all group bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500 hover:text-black shadow-md"
              title="Exporter le tableau extrait au format Excel (.xlsx)"
            >
              <TableIcon className="w-4 h-4 text-teal-400 group-hover:text-black" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-teal-400 group-hover:text-black">EXCEL</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {activeFidelityIssue && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setActiveFidelityIssue(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5 z-10"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  <span>Suggestion de Fidélité Dhu Alur Mahagi</span>
                </div>
                <button onClick={() => setActiveFidelityIssue(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-red-400">Terme Décelé (Non Authentique Mahagi) :</span>
                  <p className="text-sm font-mono text-red-200 font-bold">{activeFidelityIssue.original}</p>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Suggestion Officielle (JW.ORG / Mahagi) :</span>
                  <p className="text-sm font-mono text-emerald-200 font-bold">{activeFidelityIssue.issue.suggestedWord}</p>
                </div>

                <div className="p-3 bg-slate-800/80 border border-white/5 rounded-xl text-slate-300 text-[11px] leading-relaxed">
                  <p className="font-semibold text-amber-300 mb-0.5">Règle & Dictionnaire :</p>
                  {activeFidelityIssue.issue.reason}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveFidelityIssue(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Ignorer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const esc = activeFidelityIssue.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\b${esc}\\b`, 'gi');
                    const updated = editableText.replace(regex, activeFidelityIssue.issue.suggestedWord);
                    setPreviousTexts(prev => [...prev, editableText]);
                    setEditableText(updated);
                    setActiveFidelityIssue(null);
                    confetti({ particleCount: 50 });
                  }}
                  className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Remplacer par {activeFidelityIssue.issue.suggestedWord}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
