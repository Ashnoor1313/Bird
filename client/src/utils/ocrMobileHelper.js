/**
 * Mobile-Optimized OCR Helper for BIRD Mobile Spare-Parts ERP
 * Provides client-side image compression, camera orientation normalization,
 * and asynchronous job-based polling to eliminate mobile connection timeouts.
 */

/**
 * Compress and downscale large mobile camera images (typically 5-15MB)
 * to an optimal resolution (~1400-1600px, 250-450KB) that retains 100% of
 * text sharpness while uploading 20x faster.
 */
export async function compressMobileBillImage(imageFile, maxDimension = 1600, quality = 0.85) {
  if (!imageFile) return null;
  // Skip non-images (e.g. PDFs)
  if (imageFile.type === 'application/pdf' || imageFile.name?.toLowerCase().endsWith('.pdf')) {
    return imageFile;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Downscale if larger than max dimension while preserving aspect ratio
          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: false });

          // Fill white background in case of transparent PNG/WEBP
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const safeName = (imageFile.name || 'bill_scan.jpg').replace(/\.[^/.]+$/, '.jpg');
                const compressed = new File([blob], safeName, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                console.log(`[BIRD Mobile OCR] Compressed image: ${(imageFile.size / (1024 * 1024)).toFixed(2)} MB -> ${(compressed.size / 1024).toFixed(1)} KB`);
                resolve(compressed);
              } else {
                resolve(imageFile);
              }
            },
            'image/jpeg',
            quality
          );
        } catch (canvasErr) {
          console.warn('[BIRD Mobile OCR] Canvas compression notice, using original file:', canvasErr);
          resolve(imageFile);
        }
      };

      img.onerror = () => {
        console.warn('[BIRD Mobile OCR] Image decode failed (e.g. HEIC/raw), using original file');
        resolve(imageFile);
      };

      img.src = e.target.result;
    };

    reader.onerror = () => resolve(imageFile);
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Submit OCR job and poll until completion
 * Handles 5 mobile stages:
 *  1: Uploading...
 *  2: Reading bill...
 *  3: Processing...
 *  4: Preparing result...
 *  5: Completed
 */
export async function submitAndPollOcrJob({
  jobUrl,
  fallbackSyncUrl,
  file,
  formDataFields = {},
  onProgress = () => {},
  maxPollAttempts = 60,
  pollIntervalMs = 800,
}) {
  onProgress({
    status: 'UPLOADING',
    step: 1,
    message: 'Uploading...',
    percent: 15,
  });

  // Prepare FormData
  const formData = new FormData();
  formData.append('billFile', file);
  for (const [key, value] of Object.entries(formDataFields)) {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  }

  let jobId = null;

  try {
    // 1. Attempt non-blocking fast async job submission
    const res = await fetch(jobUrl, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      jobId = data.jobId;
    } else if (res.status === 404 && fallbackSyncUrl) {
      // Fallback to synchronous endpoint if async endpoint is not available
      console.warn(`[BIRD Mobile OCR] ${jobUrl} not found, falling back to ${fallbackSyncUrl}`);
      onProgress({
        status: 'PROCESSING',
        step: 3,
        message: 'Processing bill...',
        percent: 50,
      });

      const syncRes = await fetch(fallbackSyncUrl, {
        method: 'POST',
        body: formData,
      });

      if (!syncRes.ok) {
        throw new Error('OCR failed — Retry');
      }

      const syncData = await syncRes.json();
      onProgress({
        status: 'COMPLETED',
        step: 5,
        message: 'Completed',
        percent: 100,
      });
      return syncData;
    } else {
      const errText = await res.text().catch(() => '');
      throw new Error(`Upload failed (${res.status}): ${errText || 'Please try again'}`);
    }
  } catch (err) {
    // If job creation network error, try synchronous fallback
    if (fallbackSyncUrl && !jobId) {
      console.warn('[BIRD Mobile OCR] Network error on job creation, trying sync fallback:', err.message);
      const syncRes = await fetch(fallbackSyncUrl, {
        method: 'POST',
        body: formData,
      });
      if (syncRes.ok) {
        return await syncRes.json();
      }
    }
    throw err;
  }

  if (!jobId) {
    throw new Error('OCR failed — Retry');
  }

  // 2. Poll job status
  let consecutiveNetworkErrors = 0;
  const pollStatusUrl = `/api/ocr/jobs/${jobId}`;

  for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    try {
      const pollRes = await fetch(pollStatusUrl);
      if (!pollRes.ok) {
        if (pollRes.status === 404) {
          throw new Error('OCR job expired or not found');
        }
        consecutiveNetworkErrors++;
        if (consecutiveNetworkErrors > 5) {
          throw new Error('Network lost while checking OCR status');
        }
        continue;
      }

      consecutiveNetworkErrors = 0;
      const job = await pollRes.json();

      const step = job.step || 2;
      const status = job.status || 'PROCESSING';
      const message = job.message || 'Processing...';
      const percentMap = { 1: 20, 2: 40, 3: 65, 4: 85, 5: 100 };
      const percent = percentMap[step] || Math.min(90, 20 + attempt * 2);

      onProgress({
        status,
        step,
        message,
        percent,
      });

      if (status === 'COMPLETED') {
        if (!job.result) {
          throw new Error('OCR completed but returned empty data');
        }
        return job.result;
      }

      if (status === 'FAILED') {
        throw new Error(job.error || 'OCR failed — Retry');
      }
    } catch (pollErr) {
      if (pollErr.message.includes('OCR failed') || pollErr.message.includes('expired')) {
        throw pollErr;
      }
      consecutiveNetworkErrors++;
      if (consecutiveNetworkErrors > 5) {
        throw new Error('Connection lost. Please retry scanning.');
      }
    }
  }

  throw new Error('OCR timed out — Retry');
}
