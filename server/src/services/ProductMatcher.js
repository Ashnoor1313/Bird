import prisma from '../prisma.js';
import { ProductNormalizer } from './ProductNormalizer.js';

export class ProductMatcher {
  /**
   * Compare OCR parsed raw item text with business product catalog
   * @param {string} rawItemName
   * @param {string} businessId
   * @param {Array} existingProducts
   */
  static async matchItem(rawItemName, businessId, existingProducts = null) {
    return await ProductNormalizer.matchProduct(rawItemName, businessId, existingProducts);
  }

  /**
   * Match an array of OCR extracted line items
   */
  static async matchAllItems(ocrItems, businessId) {
    const products = await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: {
        category: true,
        locationStocks: { include: { location: true } },
      },
    });

    const matchedItems = [];
    for (const item of ocrItems) {
      const matchResult = await this.matchItem(item.productName, businessId, products);
      const matchedProd = matchResult.match;

      const resolvedUnitPrice = parseFloat(item.unitPrice || 0);

      matchedItems.push({
        ...item,
        unitPrice: resolvedUnitPrice,
        matchedProductId: matchedProd ? matchedProd.id : null,
        matchedProduct: matchedProd,
        possibleMatches: matchResult.candidates || [],
        confidence: matchResult.confidence,
        suggestionType: matchResult.suggestionType,
      });
    }
    return matchedItems;
  }
}
