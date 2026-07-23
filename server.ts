import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import { transcribeHandwriting, formatTranscriptionText } from "./src/lib/gemini";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe initialization
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  let stripe: Stripe | null = null;
  if (stripeSecretKey) {
    stripe = new Stripe(stripeSecretKey);
  }

  // Increase payload size limit to allow high-resolution multi-page scans (up to 20 pages)
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

  // API Route for Handwrited Script OCR Transcription via Gemini
  app.post("/api/transcribe", async (req, res) => {
    const { base64Images, mimeType, language } = req.body;
    
    if (!base64Images || (Array.isArray(base64Images) && base64Images.length === 0)) {
      return res.status(400).json({ error: "Aucune image n'a été fournie pour la transcription." });
    }

    try {
      const result = await transcribeHandwriting(base64Images, mimeType || "image/jpeg", language || "French");
      res.json(result);
    } catch (err: any) {
      console.error("Gemini Transcription Route Error:", err);
      res.status(500).json({ error: err.message || "Échec de l'analyse OCR par l'IA. Veuillez réessayer." });
    }
  });

  // API Route for Handwrited Script Text Formatting (Formatting and structure styling)
  app.post("/api/format", async (req, res) => {
    const { text, style, language } = req.body;
    
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Aucun texte fourni pour la mise en forme brute." });
    }

    try {
      const formattedText = await formatTranscriptionText(text, style || "standard", language || "French");
      res.json({ formattedText });
    } catch (err: any) {
      console.error("Gemini Formatting Route Error:", err);
      res.status(500).json({ error: err.message || "Échec de la mise en forme de texte par l'IA. Veuillez réessayer." });
    }
  });

  // API Route for Stripe Checkout
  app.post("/api/create-checkout-session", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured. Please add STRIPE_SECRET_KEY to .env" });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "ScriptScan Pro - Accès 3 Mois",
                description: "Accès illimité pendant 3 mois à l'OCR d'écriture manuscrite, exports Word/Excel, et support premium.",
              },
              unit_amount: 500, // $5.00
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.origin}?payment=success`,
        cancel_url: `${req.headers.origin}?payment=cancel`,
      });

      res.json({ id: session.id });
    } catch (err: any) {
      console.error("Stripe Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
