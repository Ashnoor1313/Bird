import prisma from '../prisma.js';

export class ProductNormalizer {
  /**
   * Common mobile brand dictionaries
   */
  static BRANDS = [
    { name: 'Samsung', keywords: ['samsung', 'sam', 'galaxy'] },
    { name: 'Apple', keywords: ['apple', 'iphone', 'ip', 'ipad'] },
    { name: 'Xiaomi / Redmi', keywords: ['xiaomi', 'redmi', 'mi', 'poco'] },
    { name: 'Vivo', keywords: ['vivo', 'iqoo'] },
    { name: 'Oppo', keywords: ['oppo', 'find', 'reno'] },
    { name: 'Realme', keywords: ['realme', 'narzo'] },
    { name: 'OnePlus', keywords: ['oneplus', '1+', 'op', 'nord'] },
    { name: 'Motorola', keywords: ['motorola', 'moto'] },
    { name: 'Nokia', keywords: ['nokia'] },
    { name: 'Google', keywords: ['google', 'pixel'] },
    { name: 'Infinix', keywords: ['infinix', 'hot', 'smart', 'note'] },
    { name: 'Tecno', keywords: ['tecno', 'spark', 'pova', 'camon'] },
  ];

  /**
   * Noise words, quality tags, currency symbols, and bill abbreviations to clean
   */
  static NOISE_REGEX = /\b(?:\d+\s*(?:pcs?|pc|pieces?|nos)|incell|in-cell|in\s+cell|wd|w\/d|bid|big|sub\s*board|subboard|sub-|oem|og|100%\s*og|service\s*pack|copy|first\s*copy|orig|original|assembly|aaa|grade\s*[a-c]|grade|premium|diamond|crown|with\s+frame|without\s+frame|w\/f|wo\/f|wf|wof|pcs|pc|nos|qty|quantity|rate|price|cost|amt|amount|total|grand\s*total|subtotal|rs\.?|inr|particulars|s\.no|sl\.?\s*no)\b/gi;

  /**
   * Clean noise tags (incell, wd, oem, copy, rs, pcs, etc.) and return clean product/model description
   */
  static stripNoiseWords(rawText) {
    if (!rawText) return '';
    let text = String(rawText)
      .replace(this.NOISE_REGEX, ' ')
      .replace(/\b\d+\s*(?:pcs?|pc|nos)\b/gi, ' ')
      .replace(/[\/\\@#=|_~]+/g, ' ')
      .replace(/[-:]+\s*$/g, ' ')
      .replace(/[-:]+\s*(?=[-\s])/g, ' ')
      .replace(/\b\d+[-/]\d+[-/]\d+\b/g, ' ') // Strip dates if on item line
      .replace(/\s+/g, ' ')
      .trim();

    // Remove trailing/leading stray symbols, dots, x multipliers, and leading serial numbers (e.g. "1." or "2. ")
    text = text.replace(/\s+[xX]\b/g, ' ')
      .replace(/^\d+[.\s|-]+/, '')
      .replace(/[\s./\\@#=|_~:-]+$/g, '')
      .replace(/^[\s./\\@#=|_~:-]+/g, '')
      .trim();

    // Title case if all lowercase or all uppercase
    if (text === text.toLowerCase() || text === text.toUpperCase()) {
      text = text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    return text;
  }

  /**
   * Clean and normalize raw text string for searching & indexing
   */
  static cleanText(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(this.NOISE_REGEX, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[^\w\s/+.#-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract Brand and Model from clean string
   */
  static extractEntities(rawText) {
    const stripped = this.stripNoiseWords(rawText);
    const clean = this.cleanText(rawText);
    const tokens = clean.split(' ').filter(Boolean);

    let detectedBrand = null;

    // Detect brand
    for (const b of this.BRANDS) {
      if (b.keywords.some(k => tokens.includes(k) || clean.includes(k))) {
        detectedBrand = b.name;
        break;
      }
    }

    // Default to Folders (Display) unless battery keyword is present
    const isBattery = /battery|batt|mah|cell/i.test(rawText);

    return {
      rawText,
      cleanName: stripped || rawText,
      clean,
      tokens,
      detectedBrand,
      detectedPartType: isBattery ? 'Battery' : 'Display',
    };
  }

  /**
   * Match raw string against existing products in business catalog.
   * Checks Product ID, SKU, exact name, product aliases, brand, model, and fuzzy token overlap.
   */
  static async matchProduct(rawInput, businessId, existingProducts = null) {
    if (!rawInput || !String(rawInput).trim()) {
      return { match: null, confidence: 0, suggestionType: 'NONE', candidates: [] };
    }

    const cleanInput = this.cleanText(rawInput);
    const inputTokens = cleanInput.split(' ').filter(Boolean);

    if (inputTokens.length === 0) {
      return { match: null, confidence: 0, suggestionType: 'NONE', candidates: [] };
    }

    const products = existingProducts || await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: {
        category: true,
        locationStocks: { include: { location: true } },
      },
    });

    let exactMatch = null;
    let aliasMatch = null;
    const scoredList = [];

    for (const prod of products) {
      const prodNameClean = this.cleanText(prod.name);
      const prodModelClean = this.cleanText(prod.model || '');
      const prodBrandClean = this.cleanText(prod.brand || '');
      const prodSkuClean = this.cleanText(prod.sku || prod.itemCode || '');

      // 1. EXACT NAME OR SKU MATCH
      if (prodNameClean === cleanInput || (prodSkuClean && prodSkuClean === cleanInput)) {
        exactMatch = prod;
        break;
      }

      // 2. PRODUCT ALIAS MATCHING
      if (prod.aliases) {
        const aliasList = prod.aliases.split(/[,;\n]+/).map(a => this.cleanText(a)).filter(Boolean);
        if (aliasList.includes(cleanInput)) {
          aliasMatch = prod;
          break;
        }
        for (const al of aliasList) {
          if (al.length > 3 && (cleanInput.includes(al) || al.includes(cleanInput))) {
            aliasMatch = prod;
            break;
          }
        }
        if (aliasMatch) break;
      }

      // 3. TOKEN OVERLAP & SIMILARITY SCORING
      const combinedProdText = `${prodNameClean} ${prodModelClean} ${prodBrandClean} ${prod.variant || ''} ${prod.aliases || ''}`;
      const prodTokens = this.cleanText(combinedProdText).split(' ').filter(Boolean);

      let matchedTokens = 0;
      for (const token of inputTokens) {
        if (token.length < 2) continue;

        const isHit = prodTokens.some(pt => {
          if (pt === token) return true;
          if (/^\d+$/.test(token) || /^\d+$/.test(pt)) {
            return pt === token;
          }
          if (token.length >= 4 && pt.length >= 4) {
            return pt.includes(token) || token.includes(pt);
          }
          return false;
        });

        if (isHit) matchedTokens++;
      }

      const score = inputTokens.length > 0 ? (matchedTokens / Math.max(inputTokens.length, Math.min(prodTokens.length, 6))) : 0;
      const normalizedScore = Math.min(1.0, score);

      if (normalizedScore > 0.3) {
        scoredList.push({
          product: prod,
          score: Math.round(normalizedScore * 100),
        });
      }
    }

    if (exactMatch) {
      return {
        match: exactMatch,
        confidence: 100,
        suggestionType: 'EXACT',
        candidates: [exactMatch],
      };
    }

    if (aliasMatch) {
      return {
        match: aliasMatch,
        confidence: 96,
        suggestionType: 'ALIAS',
        candidates: [aliasMatch],
      };
    }

    scoredList.sort((a, b) => b.score - a.score);

    const best = scoredList[0] || null;
    const topCandidates = scoredList.slice(0, 3).map(s => s.product);

    if (best && best.score >= 65) {
      return {
        match: best.product,
        confidence: best.score,
        suggestionType: best.score >= 80 ? 'EXACT' : 'LIKELY',
        candidates: topCandidates,
      };
    }

    if (best && best.score >= 40) {
      return {
        match: null,
        possibleMatch: best.product,
        confidence: best.score,
        suggestionType: 'POSSIBLE',
        candidates: topCandidates,
      };
    }

    return {
      match: null,
      confidence: 0,
      suggestionType: 'NONE',
      candidates: [],
    };
  }
}
