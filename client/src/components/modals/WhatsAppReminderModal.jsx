import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare } from 'lucide-react';

export const WhatsAppReminderModal = ({ isOpen, onClose, customer, business }) => {
  if (!isOpen || !customer) return null;

  const dueAmount = customer.moneyToReceive || 0;
  const phone = customer.phone?.replace(/[^0-9]/g, '') || '';

  const defaultMessage = `Hello ${customer.name} 👋,

This is a gentle payment reminder from *${business?.name || 'BIRD Mobile Parts'}*.

💰 *Pending Balance:* ₹${dueAmount.toLocaleString('en-IN')}

Please find your updated Khata balance summary. Let us know once payment via Cash / UPI is completed.

Bank Details / UPI:
UPI: ${business?.upiId || 'birdparts@hdfcbank'}

Thank you for your business! 🐦`;

  const [message, setMessage] = useState(defaultMessage);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const encoded = encodeURIComponent(message);
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <MessageSquare className="w-5 h-5" />
            <span>Send WhatsApp Khata Statement</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div>
            <div className="font-bold text-white text-sm">{customer.name}</div>
            <div className="text-slate-400">{customer.phone || 'No phone number'}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-400">Total Pending</div>
            <div className="font-extrabold text-rose-400 text-base">₹{dueAmount.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Editable Message</label>
          <textarea
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-xs text-slate-300 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Text'}</span>
          </button>

          <button
            onClick={handleSendWhatsApp}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Open WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
