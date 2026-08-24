import React, { useState } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Boxes,
  ArrowRight,
  Edit2,
  FileCheck,
  X,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ImportPage = () => {
  const { activeBusinessId } = useBusiness();
  const { activeLocationId, activeLocation, locations } = useLocation();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedImportLocationId, setSelectedImportLocationId] = useState('');

  // Column Mapping
  const [mapping, setMapping] = useState({
    productName: '',
    quantity: '',
    purchaseRate: '',
    sellingPrice: '',
    category: '',
    brand: '',
    model: '',
    sku: '',
  });

  // Invalid rows inline correction
  const [overrideRows, setOverrideRows] = useState([]);
  const [editingRow, setEditingRow] = useState(null);

  const getEffectiveLocationId = () => {
    if (selectedImportLocationId && selectedImportLocationId !== 'ALL') return selectedImportLocationId;
    if (activeLocationId && activeLocationId !== 'ALL') return activeLocationId;
    const godown = (locations || []).find(l => l.type === 'GODOWN');
    return godown?.id || (locations || [])[0]?.id;
  };

  const handleUploadFile = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('importFile', selected);

      const res = await fetch('/api/imports/preview', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
        // Use intelligent column detection returned by server
        setMapping({
          productName: data.detectedMapping?.productName || data.headers[0] || '',
          quantity: data.detectedMapping?.quantity || data.headers[1] || '',
          purchaseRate: data.detectedMapping?.purchaseRate || '',
          sellingPrice: data.detectedMapping?.sellingPrice || '',
          category: data.detectedMapping?.category || '',
          brand: data.detectedMapping?.brand || '',
          model: data.detectedMapping?.model || '',
          sku: data.detectedMapping?.sku || '',
        });
        addToast(`Spreadsheet loaded! Detected ${data.totalDetectedPieces} pieces across ${data.totalRows} rows.`, 'success');
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to read Excel file', 'error');
      }
    } catch (err) {
      addToast('Error processing file upload', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !mapping.productName) {
      addToast('Please select the Product Name column', 'error');
      return;
    }

    setImporting(true);
    try {
      const targetLocId = getEffectiveLocationId();
      const res = await fetch('/api/imports/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          locationId: targetLocId,
          filePath: previewData.filePath,
          mapping,
          overrideRows,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        addToast(json.message || 'Stock imported successfully!', 'success');
        setPreviewData(null);
        setFile(null);
        navigate('/stock');
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Import failed', 'error');
      }
    } catch (err) {
      addToast('Error confirming Excel import', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-4xl mx-auto pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-zinc-700" />
            <span>Bulk Stock Excel Import</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5 font-medium">Upload supplier/godown Excel or CSV spreadsheets to add inventory.</p>
        </div>
      </div>

      {!previewData ? (
        <div className="bird-card p-8 sm:p-12 text-center space-y-4 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 text-zinc-700 flex items-center justify-center mx-auto">
            <Upload className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900">Upload Stock Spreadsheet</h3>
            <p className="text-xs text-zinc-500 font-medium max-w-xs mx-auto">
              Select your stock file (.xlsx, .xls, .csv). Columns and quantities are mapped automatically.
            </p>
          </div>

          <div className="pt-2">
            <label className="btn-primary py-2.5 px-5 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Select File (.xlsx / .csv)</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleUploadFile}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-zinc-600">
              <RefreshCw className="w-4 h-4 animate-spin text-zinc-600" />
              <span>Analyzing spreadsheet columns & rows...</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top Summary Banner */}
          <div className="bird-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                File: {previewData.fileName}
              </span>
              <h2 className="text-lg font-bold text-zinc-900">
                {previewData.totalRows} Rows • {previewData.totalDetectedPieces.toLocaleString('en-IN')} Pieces Detected
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                <span>Destination Branch:</span>
                {locations && locations.length > 1 ? (
                  <select
                    value={selectedImportLocationId || getEffectiveLocationId()}
                    onChange={(e) => setSelectedImportLocationId(e.target.value)}
                    className="py-1 px-2.5 text-xs font-semibold"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong className="text-zinc-900">{activeLocation ? activeLocation.name : 'Godown'}</strong>
                )}
              </div>
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={importing || !mapping.productName}
              className="btn-primary py-2.5 px-4 shrink-0"
            >
              {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Import to Stock</span>
            </button>
          </div>

          {/* Invalid Rows Warning Card */}
          {previewData.invalidCount > 0 && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>⚠ {previewData.invalidCount} row(s) need attention</span>
              </div>
              <p className="text-xs text-amber-700 font-medium">
                Some rows in your Excel file have missing quantities or names. BIRD will safely skip empty rows or you can map columns below.
              </p>
            </div>
          )}

          {/* Intelligent Column Mapping Selectors */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">Intelligent Column Mapping</h3>
              <p className="text-xs text-slate-500 font-medium">Check detected columns from your spreadsheet</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Product Name Column *</label>
                <select
                  value={mapping.productName}
                  onChange={(e) => setMapping({ ...mapping, productName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Select Column --</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Quantity Column *</label>
                <select
                  value={mapping.quantity}
                  onChange={(e) => setMapping({ ...mapping, quantity: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">None (0)</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Purchase Rate Column (₹)</label>
                <select
                  value={mapping.purchaseRate}
                  onChange={(e) => setMapping({ ...mapping, purchaseRate: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">None (0)</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Category Column (Optional)</label>
                <select
                  value={mapping.category}
                  onChange={(e) => setMapping({ ...mapping, category: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Auto-Assign / Default</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Model / Brand (Optional)</label>
                <select
                  value={mapping.model}
                  onChange={(e) => setMapping({ ...mapping, model: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">None</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">SKU / Item Code (Optional)</label>
                <select
                  value={mapping.sku}
                  onChange={(e) => setMapping({ ...mapping, sku: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Auto-Generate</option>
                  {previewData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Live Data Preview Table */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Import Preview (First 15 Rows)</h3>
              <span className="text-xs text-slate-400 font-semibold">Duplicate items will automatically merge into existing stock</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Purchase Rate</th>
                    <th className="p-3">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {previewData.previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{row[mapping.productName] || '<empty>'}</td>
                      <td className="p-3 font-black text-emerald-700">{row[mapping.quantity] || '0'} pcs</td>
                      <td className="p-3">{row[mapping.purchaseRate] ? `₹${row[mapping.purchaseRate]}` : '-'}</td>
                      <td className="p-3 text-slate-500">{row[mapping.category] || 'General'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs"
              >
                Cancel / Choose Another File
              </button>

              <button
                onClick={handleConfirmImport}
                disabled={importing || !mapping.productName}
                className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Add {previewData.totalDetectedPieces} Pieces to Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportPage;
