/**
 * Advanced Client-Side Automatic Paper Detection, Cropping, and Edge Trimming Utility.
 * Automatically locates document/paper boundaries against backgrounds and trims margins.
 */

export interface CropOptions {
  padding?: number; // Padding in pixels around cropped paper
  enhanceContrast?: boolean; // Apply document scan white-level filter
  minPaperAreaRatio?: number; // Minimum ratio of image area considered paper (e.g. 0.20)
}

/**
 * Detects paper boundaries on canvas and crops/trims automatically.
 */
export function autoCropAndTrimPaper(
  inputDataUrl: string,
  options: CropOptions = {}
): Promise<{ croppedDataUrl: string; cropped: boolean; bounds?: { x: number; y: number; width: number; height: number } }> {
  const { padding = 12, enhanceContrast = true, minPaperAreaRatio = 0.25 } = options;

  return new Promise((resolve) => {
    if (!inputDataUrl || !inputDataUrl.startsWith("data:image/")) {
      resolve({ croppedDataUrl: inputDataUrl, cropped: false });
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const origWidth = img.width;
        const origHeight = img.height;

        // Create working canvas
        const canvas = document.createElement("canvas");
        canvas.width = origWidth;
        canvas.height = origHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          resolve({ croppedDataUrl: inputDataUrl, cropped: false });
          return;
        }

        ctx.drawImage(img, 0, 0, origWidth, origHeight);
        const imageData = ctx.getImageData(0, 0, origWidth, origHeight);
        const data = imageData.data;

        // Downsampled grid sampling for fast & robust paper boundary detection
        const stepX = Math.max(1, Math.floor(origWidth / 200));
        const stepY = Math.max(1, Math.floor(origHeight / 200));

        // 1. Calculate average brightness of image border to identify background tone
        let borderLuminanceSum = 0;
        let borderCount = 0;

        for (let x = 0; x < origWidth; x += stepX) {
          // Top & bottom edges
          const topIdx = (x) * 4;
          const botIdx = ((origHeight - 1) * origWidth + x) * 4;
          borderLuminanceSum += (data[topIdx] * 0.299 + data[topIdx + 1] * 0.587 + data[topIdx + 2] * 0.114);
          borderLuminanceSum += (data[botIdx] * 0.299 + data[botIdx + 1] * 0.587 + data[botIdx + 2] * 0.114);
          borderCount += 2;
        }

        for (let y = 0; y < origHeight; y += stepY) {
          // Left & right edges
          const leftIdx = (y * origWidth) * 4;
          const rightIdx = (y * origWidth + (origWidth - 1)) * 4;
          borderLuminanceSum += (data[leftIdx] * 0.299 + data[leftIdx + 1] * 0.587 + data[leftIdx + 2] * 0.114);
          borderLuminanceSum += (data[rightIdx] * 0.299 + data[rightIdx + 1] * 0.587 + data[rightIdx + 2] * 0.114);
          borderCount += 2;
        }

        const avgBorderLum = borderCount > 0 ? borderLuminanceSum / borderCount : 120;

        // 2. Scan rows & columns to find paper region (where brightness/contrast differs significantly from border)
        let minX = origWidth;
        let maxX = 0;
        let minY = origHeight;
        let maxY = 0;

        // Paper is generally brighter than dark desk OR distinctly contrasting
        for (let y = 0; y < origHeight; y += stepY) {
          for (let x = 0; x < origWidth; x += stepX) {
            const i = (y * origWidth + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const lum = r * 0.299 + g * 0.587 + b * 0.114;

            // Is this pixel part of the paper? (Light document paper or high contrast from background border)
            const isPaperPixel = Math.abs(lum - avgBorderLum) > 28 || lum > 140;

            if (isPaperPixel) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        // Apply safety padding & bounds checking
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(origWidth - 1, maxX + padding);
        maxY = Math.min(origHeight - 1, maxY + padding);

        const cropWidth = maxX - minX;
        const cropHeight = maxY - minY;
        const croppedAreaRatio = (cropWidth * cropHeight) / (origWidth * origHeight);

        // If paper bounding box is valid and covers a substantial portion of image (e.g. > 25% and < 98%)
        const isCropped = cropWidth > 100 && cropHeight > 100 && croppedAreaRatio >= minPaperAreaRatio && croppedAreaRatio < 0.98;

        const targetX = isCropped ? minX : 0;
        const targetY = isCropped ? minY : 0;
        const targetW = isCropped ? cropWidth : origWidth;
        const targetH = isCropped ? cropHeight : origHeight;

        // Create output canvas with cropped paper dimensions
        const outCanvas = document.createElement("canvas");
        outCanvas.width = targetW;
        outCanvas.height = targetH;
        const outCtx = outCanvas.getContext("2d");

        if (!outCtx) {
          resolve({ croppedDataUrl: inputDataUrl, cropped: false });
          return;
        }

        // Draw cropped portion
        outCtx.drawImage(
          img,
          targetX, targetY, targetW, targetH,
          0, 0, targetW, targetH
        );

        // 3. Document Scan Enhancement Filter (White Level & Contrast Adjustment)
        if (enhanceContrast) {
          const outImgData = outCtx.getImageData(0, 0, targetW, targetH);
          const outData = outImgData.data;

          for (let p = 0; p < outData.length; p += 4) {
            let r = outData[p];
            let g = outData[p + 1];
            let b = outData[p + 2];

            // Subtle contrast stretch to whiten paper background and darken text
            // Lum threshold scaling
            const lum = r * 0.299 + g * 0.587 + b * 0.114;
            if (lum > 170) {
              // Whiten paper background
              r = Math.min(255, r + (255 - r) * 0.35);
              g = Math.min(255, g + (255 - g) * 0.35);
              b = Math.min(255, b + (255 - b) * 0.35);
            } else if (lum < 100) {
              // Darken text ink for high legibility
              r = Math.max(0, r * 0.85);
              g = Math.max(0, g * 0.85);
              b = Math.max(0, b * 0.85);
            }

            outData[p] = r;
            outData[p + 1] = g;
            outData[p + 2] = b;
          }

          outCtx.putImageData(outImgData, 0, 0);
        }

        const croppedDataUrl = outCanvas.toDataURL("image/jpeg", 0.75);
        resolve({
          croppedDataUrl,
          cropped: isCropped,
          bounds: isCropped ? { x: targetX, y: targetY, width: targetW, height: targetH } : undefined
        });

      } catch (err) {
        console.error("Auto paper crop error:", err);
        resolve({ croppedDataUrl: inputDataUrl, cropped: false });
      }
    };

    img.onerror = () => {
      resolve({ croppedDataUrl: inputDataUrl, cropped: false });
    };

    img.src = inputDataUrl;
  });
}

/**
 * Process multiple scanned images with auto paper cropping in parallel.
 */
export async function autoCropBatch(
  images: string[],
  options?: CropOptions
): Promise<string[]> {
  try {
    const results = await Promise.all(images.map(img => autoCropAndTrimPaper(img, options)));
    return results.map(res => res.croppedDataUrl);
  } catch (err) {
    console.error("Batch auto crop error:", err);
    return images;
  }
}
