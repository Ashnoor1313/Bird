import prisma from '../prisma.js';

export class SupplierMatcher {
  /**
   * Search and match OCR extracted supplier information against current store's suppliers
   * @param {Object} extractedSupplier { name, gstin, phone }
   * @param {string} businessId
   * @param {string} locationId - Mandatory store location filter for isolation
   */
  static async matchSupplier(extractedSupplier, businessId, locationId) {
    if (!extractedSupplier || !businessId) {
      return { matchedSupplier: null, confidence: 0, suggestionType: 'NONE' };
    }

    const { name, gstin, phone } = extractedSupplier;

    // Fetch suppliers SCOPED STRICTLY TO THE CURRENT BUSINESS AND STORE LOCATION
    const whereClause = { businessId };
    if (locationId && locationId !== 'ALL') {
      whereClause.locationId = locationId;
    }

    const suppliers = await prisma.supplier.findMany({
      where: whereClause,
    });

    // 1. GSTIN Exact Match (100% confidence)
    if (gstin && gstin.trim()) {
      const gstinClean = gstin.trim().toUpperCase();
      const exactGstinMatch = suppliers.find(s => s.gstin && s.gstin.toUpperCase() === gstinClean);
      if (exactGstinMatch) {
        return {
          matchedSupplier: exactGstinMatch,
          confidence: 100,
          suggestionType: 'EXACT_GSTIN',
        };
      }
    }

    // 2. Phone Match (95% confidence)
    if (phone && phone.trim()) {
      const phoneClean = phone.replace(/[^0-9]/g, '');
      if (phoneClean.length >= 10) {
        const exactPhoneMatch = suppliers.find(s => s.phone && s.phone.replace(/[^0-9]/g, '').includes(phoneClean));
        if (exactPhoneMatch) {
          return {
            matchedSupplier: exactPhoneMatch,
            confidence: 95,
            suggestionType: 'EXACT_PHONE',
          };
        }
      }
    }

    // 3. Name Fuzzy Token Match
    if (name && name.trim()) {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      const nameTokens = cleanName.split(/\s+/).filter(Boolean);

      let bestSupplier = null;
      let maxScore = 0;

      for (const supp of suppliers) {
        const suppNameClean = supp.name.toLowerCase().replace(/[^a-z0-9]/g, ' ');
        const suppTokens = suppNameClean.split(/\s+/).filter(Boolean);

        let matchCount = 0;
        for (const token of nameTokens) {
          if (token.length >= 3 && suppTokens.some(st => st.includes(token) || token.includes(st))) {
            matchCount++;
          }
        }

        const score = matchCount / Math.max(nameTokens.length, suppTokens.length);
        if (score > maxScore) {
          maxScore = score;
          bestSupplier = supp;
        }
      }

      if (maxScore >= 0.5) {
        return {
          matchedSupplier: bestSupplier,
          confidence: Math.round(maxScore * 100),
          suggestionType: maxScore >= 0.8 ? 'LIKELY_NAME' : 'FUZZY_NAME',
        };
      }
    }

    return {
      matchedSupplier: null,
      confidence: 0,
      suggestionType: 'NONE',
    };
  }
}
