import React from 'react';
import { Loader2, AlertCircle, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';

export const OcrScanProgress = ({ progress, error, onRetry }) => {
  const { status, step = 1, message = 'Uploading...', percent = 20 } = progress || {};

  const stages = [
    { label: 'Uploading...', stepNum: 1 },
    { label: 'Reading bill...', stepNum: 2 },
    { label: 'Processing...', stepNum: 3 },
    { label: 'Preparing result...', stepNum: 4 },
    { label: 'Completed', stepNum: 5 },
  ];

  if (error) {
    return (
      <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3 animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-extrabold text-rose-900">OCR failed — Retry</h4>
          <p className="text-xs text-rose-700 max-w-xs mx-auto">
            {error || 'Unable to clearly read text from this photo. Ensure good lighting and hold phone steady.'}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-md space-y-4 animate-in fade-in duration-150 text-center">
      <div className="flex items-center justify-center gap-2.5">
        {status === 'COMPLETED' ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-bounce" />
        ) : (
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        )}
        <span className="font-extrabold text-sm text-zinc-900">
          {message}
        </span>
      </div>

      {/* Visual Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-zinc-200">
          <div
            className="h-full rounded-full bg-linear-to-r from-blue-600 to-indigo-600 transition-all duration-300 ease-out shadow-xs"
            style={{ width: `${Math.min(100, Math.max(10, percent))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 px-1">
          <span>Stage {step} of 5</span>
          <span>{percent}%</span>
        </div>
      </div>

      {/* Step Pills */}
      <div className="grid grid-cols-5 gap-1 pt-1">
        {stages.map((stage) => {
          const isDone = step > stage.stepNum;
          const isCurrent = step === stage.stepNum;
          return (
            <div
              key={stage.stepNum}
              className={`py-1 px-0.5 rounded text-[10px] font-bold truncate transition-colors ${
                isDone
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isCurrent
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-50 text-zinc-400 border border-zinc-100'
              }`}
            >
              {stage.label.replace('...', '')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OcrScanProgress;
