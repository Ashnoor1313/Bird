import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { OcrJobService } from '../services/OcrJobService.js';

const router = express.Router();

const getUploadDir = () => {
  const uploadDir = path.resolve('uploads');
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      return uploadDir;
    } catch (e) {
      return os.tmpdir();
    }
  }
  return uploadDir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (req, file, cb) => {
    cb(null, `ocr_${Date.now()}_${path.extname(file.originalname || '.jpg')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

// CREATE OCR ASYNC JOB (Instant return, eliminates mobile connection timeout)
router.post('/jobs', upload.single('billFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Bill file/image is required' });
    }

    const job = OcrJobService.createJob(req.file, req.body);
    res.status(202).json({
      success: true,
      jobId: job.id,
      status: job.status,
      step: job.step,
      percent: job.percent,
      message: job.message,
    });
  } catch (err) {
    console.error('OCR Job creation error:', err);
    res.status(500).json({ error: 'Failed to create OCR job' });
  }
});

// GET OCR JOB STATUS (Fast 10ms polling for mobile devices)
router.get('/jobs/:id', (req, res) => {
  try {
    const job = OcrJobService.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'OCR Job not found or expired' });
    }

    res.json({
      success: true,
      id: job.id,
      status: job.status,
      step: job.step,
      percent: job.percent,
      message: job.message,
      error: job.error,
      result: job.result,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

export default router;
