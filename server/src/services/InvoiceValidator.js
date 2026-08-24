export class InvoiceValidator {
  /**
   * Validate extracted line items, GST calculations, and invoice totals
   * @param {Object} documentResult
   */
  static validateInvoice(documentResult) {
    const discrepancies = [];
    let lineMathValid = true;
    let invoiceTotalsValid = true;
    let gstValid = true;

    const items = documentResult.items || [];
    let calculatedSubtotal = 0;

    // 1. Line Item Math Validation
    items.forEach((item, index) => {
      const qty = parseFloat(item.quantity || 0);
      const price = parseFloat(item.unitPrice || 0);
      const disc = parseFloat(item.discount || 0);
      const reportedTotal = parseFloat(item.total || 0);

      const expectedTotal = qty * price - disc;
      calculatedSubtotal += reportedTotal > 0 ? reportedTotal : expectedTotal;

      if (price > 0 && Math.abs(expectedTotal - reportedTotal) > 2) {
        lineMathValid = false;
        discrepancies.push(`Line #${index + 1} (${item.description || 'Item'}): Math mismatch (Qty ${qty} × Rate ${price} - Disc ${disc} = ${expectedTotal.toFixed(2)}, reported ${reportedTotal.toFixed(2)})`);
      }
    });

    // 2. GST Math Validation
    const cgst = parseFloat(documentResult.cgst || 0);
    const sgst = parseFloat(documentResult.sgst || 0);
    const igst = parseFloat(documentResult.igst || 0);
    const totalTax = parseFloat(documentResult.totalTax || (cgst + sgst + igst));

    if (cgst > 0 && sgst > 0 && Math.abs((cgst + sgst) - totalTax) > 2) {
      gstValid = false;
      discrepancies.push(`GST Mismatch: CGST (₹${cgst}) + SGST (₹${sgst}) does not match Total Tax (₹${totalTax})`);
    }

    // 3. Invoice Grand Total Validation
    const subtotal = parseFloat(documentResult.subtotal || calculatedSubtotal);
    const discount = parseFloat(documentResult.discount || 0);
    const grandTotal = parseFloat(documentResult.grandTotal || 0);

    if (grandTotal > 0) {
      const expectedGrandTotal = subtotal - discount + totalTax;
      if (Math.abs(expectedGrandTotal - grandTotal) > 5) {
        invoiceTotalsValid = false;
        discrepancies.push(`Grand Total Mismatch: Subtotal (₹${subtotal}) - Discount (₹${discount}) + Tax (₹${totalTax}) = ₹${expectedGrandTotal.toFixed(2)}, but invoice grand total is ₹${grandTotal.toFixed(2)}`);
      }
    }

    // 4. GSTIN Format Validation
    const gstin = documentResult.supplier?.gstin;
    if (gstin && gstin.trim()) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin.trim().toUpperCase())) {
        discrepancies.push(`Supplier GSTIN "${gstin}" does not match standard 15-character GSTIN format.`);
      }
    }

    return {
      lineMathValid,
      invoiceTotalsValid,
      gstValid,
      discrepancies,
      calculatedSubtotal,
    };
  }
}
