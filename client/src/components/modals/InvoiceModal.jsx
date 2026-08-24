import React, { useRef } from 'react';
import { X, Printer, Share2, Download, CheckCircle2, Phone, Calendar, Receipt, Store } from 'lucide-react';

export const InvoiceModal = ({ isOpen, onClose, sale, business }) => {
  const printRef = useRef(null);

  if (!isOpen || !sale) return null;

  const businessName = business?.name || sale?.business?.name || 'BIRD Mobile Spare Parts';
  const businessPhone = business?.phone || sale?.business?.phone || '';
  const businessAddress = business?.address || sale?.business?.address || '';
  const businessGstin = business?.gstin || sale?.business?.gstin || '';
  const locationName = sale?.location?.name || 'Main Store';
  const billNo = sale?.billNo || sale?.invoiceNumber || '1001';
  const dateStr = sale?.createdAt
    ? new Date(sale.createdAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  const items = sale?.items || [];
  const subtotal = sale?.subtotal ?? items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
  const discount = sale?.discount || 0;
  const total = sale?.total ?? (subtotal - discount);
  const paidAmount = sale?.paidAmount ?? total;
  const dueAmount = sale?.dueAmount ?? Math.max(0, total - paidAmount);
  const paymentMethod = sale?.paymentMethod || 'CASH';

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    let text = `*INVOICE / CASH MEMO*\n`;
    text += `*${businessName}* (${locationName})\n`;
    if (businessPhone) text += `📞 Phone: ${businessPhone}\n`;
    text += `---------------------------\n`;
    text += `📄 *Bill No:* #${billNo}\n`;
    text += `📅 *Date:* ${dateStr}\n`;
    text += `👤 *Customer:* ${sale.customerName || 'Walk-in Customer'}\n`;
    if (sale.customerPhone) text += `📱 *Phone:* ${sale.customerPhone}\n`;
    text += `---------------------------\n`;
    text += `*ITEMS:*\n`;
    items.forEach((item, idx) => {
      text += `${idx + 1}. ${item.productName} (${item.quantity} x ₹${item.unitPrice}) = ₹${(item.quantity * item.unitPrice).toLocaleString('en-IN')}\n`;
    });
    text += `---------------------------\n`;
    if (discount > 0) text += `Subtotal: ₹${subtotal.toLocaleString('en-IN')}\nDiscount: -₹${discount.toLocaleString('en-IN')}\n`;
    text += `*GRAND TOTAL: ₹${total.toLocaleString('en-IN')}*\n`;
    text += `*Paid (${paymentMethod}): ₹${paidAmount.toLocaleString('en-IN')}*\n`;
    if (dueAmount > 0) text += `⚠️ *Balance Due: ₹${dueAmount.toLocaleString('en-IN')}*\n`;
    text += `---------------------------\n`;
    text += `Terms: 7 Days Testing Warranty.\nThank you for your business!`;

    const cleanPhone = (sale.customerPhone || '').replace(/\D/g, '').slice(-10);
    const targetUrl = cleanPhone.length === 10
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(targetUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 16px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white border border-zinc-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header Action Bar */}
        <div className="p-3.5 bg-zinc-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs">Sales Invoice #{billNo}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>Print</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Basic Invoice Body */}
        <div id="printable-invoice" ref={printRef} className="p-6 sm:p-8 space-y-5 bg-white text-zinc-900 font-sans text-xs">
          {/* Store / Business Header */}
          <div className="text-center pb-3 border-b-2 border-zinc-900 space-y-1">
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-zinc-900">
              {businessName}
            </h1>
            <p className="text-[11px] font-semibold text-zinc-600">
              {locationName} {businessAddress ? `• ${businessAddress}` : ''}
            </p>
            {businessPhone && (
              <p className="text-[11px] font-medium text-zinc-600">
                Phone: <span className="font-bold text-zinc-900">{businessPhone}</span>
              </p>
            )}
            {businessGstin && (
              <p className="text-[10px] font-mono text-zinc-500">
                GSTIN: {businessGstin}
              </p>
            )}
            <div className="pt-1">
              <span className="inline-block px-3 py-0.5 rounded bg-zinc-900 text-white text-[10px] font-extrabold uppercase tracking-wider">
                CASH MEMO / SALES INVOICE
              </span>
            </div>
          </div>

          {/* Invoice Metadata (Bill No, Date, Customer) */}
          <div className="grid grid-cols-2 gap-4 py-2 border-b border-zinc-200">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">Billed To:</span>
              <p className="font-extrabold text-zinc-900 text-xs sm:text-sm">
                {sale.customerName || 'Walk-in Customer'}
              </p>
              {sale.customerPhone && (
                <p className="text-zinc-600 font-medium">
                  Ph: {sale.customerPhone}
                </p>
              )}
            </div>

            <div className="text-right space-y-1">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400">Invoice No:</span>
                <p className="font-mono font-extrabold text-zinc-900 text-sm">
                  #{billNo}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400">Date:</span>
                <p className="font-medium text-zinc-700">{dateStr}</p>
              </div>
            </div>
          </div>

          {/* Clean Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-900 text-[10px] uppercase font-black text-zinc-800">
                  <th className="py-2 pr-2 w-8 text-center">#</th>
                  <th className="py-2 pr-2">Item Description</th>
                  <th className="py-2 px-2 text-center w-12">Qty</th>
                  <th className="py-2 px-2 text-right w-20">Rate</th>
                  <th className="py-2 pl-2 text-right w-24">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {items.map((item, idx) => (
                  <tr key={idx} className="text-xs">
                    <td className="py-2 pr-2 text-center text-zinc-500 font-bold">{idx + 1}</td>
                    <td className="py-2 pr-2">
                      <div className="font-bold text-zinc-900">{item.productName}</div>
                      {item.model && item.model !== item.productName && (
                        <div className="text-[10px] text-zinc-500 font-medium">Model: {item.model}</div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center font-extrabold text-zinc-900">{item.quantity}</td>
                    <td className="py-2 px-2 text-right font-medium text-zinc-800 tabular-nums">
                      ₹{item.unitPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 pl-2 text-right font-extrabold text-zinc-900 tabular-nums">
                      ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Payment Breakdown */}
          <div className="border-t-2 border-zinc-900 pt-3 space-y-1.5">
            <div className="flex justify-between text-zinc-600 font-medium">
              <span>Subtotal:</span>
              <span className="font-bold text-zinc-900">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-rose-700 font-semibold">
                <span>Discount:</span>
                <span>-₹{discount.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="flex justify-between text-sm sm:text-base font-black text-zinc-900 pt-1 border-t border-zinc-200">
              <span>Total Amount:</span>
              <span className="tabular-nums">₹{total.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-xs font-bold text-zinc-800 pt-1">
              <span>Paid via {paymentMethod}:</span>
              <span className="text-emerald-700">₹{paidAmount.toLocaleString('en-IN')}</span>
            </div>

            {dueAmount > 0 ? (
              <div className="flex justify-between text-xs font-black text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-200">
                <span>Balance Due (Khata):</span>
                <span>₹{dueAmount.toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <div className="flex justify-between text-[11px] font-bold text-emerald-700 bg-emerald-50 p-1 rounded border border-emerald-200">
                <span>Payment Status:</span>
                <span>PAID IN FULL</span>
              </div>
            )}
          </div>

          {/* Footer Terms & Conditions */}
          <div className="border-t border-zinc-200 pt-3 text-[10px] text-zinc-500 space-y-1 text-center font-medium">
            <p className="font-bold text-zinc-700">Terms & Conditions:</p>
            <p>1. 7 Days Testing Warranty on Folders & Batteries (stamp & seal required).</p>
            <p>2. Physical damage, flex tear, or display glass break is NOT covered under testing warranty.</p>
            <p className="font-bold text-zinc-900 pt-1">Thank you for your business!</p>
          </div>
        </div>

        {/* Bottom Button Bar */}
        <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 transition-colors"
          >
            Done
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Send on WhatsApp</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
