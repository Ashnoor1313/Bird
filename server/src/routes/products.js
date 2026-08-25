import express from 'express';
import xlsx from 'xlsx';
import prisma from '../prisma.js';
import { StockEngine } from '../services/StockEngine.js';
import { ProductNormalizer } from '../services/ProductNormalizer.js';

const router = express.Router();

// Get products list with filters & powerful search
router.get('/', async (req, res) => {
  try {
    const { businessId, categoryId, quality, stockStatus, locationId, search } = req.query;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    let where = {
      businessId,
      status: 'ACTIVE',
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (quality) {
      where.quality = quality;
    }

    if (search) {
      const q = search.trim().toLowerCase();
      where.OR = [
        { name: { contains: q } },
        { model: { contains: q } },
        { brand: { contains: q } },
        { partType: { contains: q } },
        { itemCode: { contains: q } },
        { sku: { contains: q } },
        { aliases: { contains: q } },
        { barcode: { contains: q } },
      ];
    }

    let products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        locationStocks: {
          include: { location: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Common inventory across Godown, Store 1, Store 2, and ALL
    products = products.map(p => {
      const locQuantity = p.currentStock || 0;
      const locGood = p.goodStock !== undefined && p.goodStock !== null ? p.goodStock : locQuantity;
      const locDefective = p.defectiveStock || 0;

      return {
        ...p,
        locationStockQuantity: locQuantity,
        locationGoodStock: locGood,
        locationDefectiveStock: locDefective,
      };
    });

    if (stockStatus) {
      if (stockStatus === 'LOW') {
        products = products.filter(p => p.currentStock > 0 && p.currentStock <= (p.minStock || 5));
      } else if (stockStatus === 'OUT') {
        products = products.filter(p => p.currentStock <= 0);
      } else if (stockStatus === 'GOOD') {
        products = products.filter(p => p.currentStock > (p.minStock || 5));
      }
    }

    res.json(products);
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// EXPORT STOCK TO EXCEL (.xlsx)
// Supports: scope=category, scope=godown, scope=all, locationId filter
// Returns only 4 clean columns: Product Name, Qty, Selling Price, Purchase Price
router.get('/export/excel', async (req, res) => {
  try {
    const { businessId, scope = 'all', categoryId, categoryName, locationId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    let where = { businessId, status: 'ACTIVE' };
    let exportFileName = 'BIRD_Stock_Export.xlsx';

    // Location resolution
    let targetLocId = null;
    let targetLocName = 'All Locations';

    if (locationId && locationId !== 'ALL') {
      targetLocId = locationId;
      const loc = await prisma.location.findUnique({ where: { id: locationId } });
      if (loc) targetLocName = loc.name;
    } else if (scope === 'godown') {
      const defaultGodown = await StockEngine.getDefaultGodown(businessId, prisma);
      targetLocId = defaultGodown?.id || null;
      targetLocName = defaultGodown?.name || 'Godown';
    }

    // Category resolution
    if (scope === 'category') {
      if (categoryId) {
        where.categoryId = categoryId;
        const cat = await prisma.category.findUnique({ where: { id: categoryId } });
        if (cat) exportFileName = `BIRD_${cat.name.replace(/[^a-zA-Z0-9]/g, '_')}_${targetLocName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
      } else if (categoryName) {
        const isBattery = /batter|cell|mah/i.test(categoryName);
        const cats = await prisma.category.findMany({ where: { businessId } });
        const matchedCatIds = cats
          .filter(c => isBattery ? /batter|cell|mah/i.test(c.name) : !/batter|cell|mah/i.test(c.name))
          .map(c => c.id);

        if (isBattery) {
          where.OR = [
            { categoryId: { in: matchedCatIds } },
            { name: { contains: 'Battery' } },
            { partType: 'Battery' }
          ];
          exportFileName = `BIRD_Batteries_Stock_${targetLocName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
        } else {
          where.OR = [
            { categoryId: { in: matchedCatIds } },
            { partType: { not: 'Battery' } }
          ];
          exportFileName = `BIRD_Folders_Stock_${targetLocName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
        }
      }
    } else if (targetLocId) {
      exportFileName = `BIRD_${targetLocName.replace(/[^a-zA-Z0-9]/g, '_')}_Stock.xlsx`;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        locationStocks: {
          include: { location: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const exportRows = products.map((p) => {
      let qty = p.goodStock !== undefined ? p.goodStock : p.currentStock;

      if (targetLocId) {
        const locStock = p.locationStocks?.find((ls) => ls.locationId === targetLocId);
        qty = locStock ? (locStock.goodStock !== undefined ? locStock.goodStock : locStock.quantity) : 0;
      }

      return {
        'Product Name': p.name || '',
        'Qty': Number(qty || 0),
        'Selling Price': Number(p.sellingPrice || 0),
        'Purchase Price': Number(p.purchasePrice || 0),
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(exportRows);

    // Auto set column widths for clean readability
    worksheet['!cols'] = [
      { wch: 40 }, // Product Name
      { wch: 10 }, // Qty
      { wch: 16 }, // Selling Price
      { wch: 16 }, // Purchase Price
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Stock');

    // Generate binary buffer
    const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);
    res.send(excelBuffer);
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Failed to export inventory spreadsheet' });
  }
});

// Check if a matching product already exists
router.post('/check-duplicate', async (req, res) => {
  try {
    const { businessId, name } = req.body;
    if (!businessId || !name || !name.trim()) {
      return res.status(400).json({ error: 'businessId and name are required' });
    }

    const matchResult = await ProductNormalizer.matchProduct(name, businessId);

    if (matchResult.match) {
      return res.json({ exists: true, existingProduct: matchResult.match, confidence: matchResult.confidence });
    }

    return res.json({ exists: false, suggestions: matchResult.candidates });
  } catch (err) {
    console.error('Check duplicate error:', err);
    res.status(500).json({ error: 'Failed to check duplicate product' });
  }
});

// Get Categories list
router.get('/categories', async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const categories = await prisma.category.findMany({
      where: { businessId },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create Category
router.post('/categories', async (req, res) => {
  try {
    const { businessId, name, description } = req.body;
    if (!businessId || !name || !name.trim()) {
      return res.status(400).json({ error: 'businessId and Category Name are required' });
    }

    const cat = await prisma.category.create({
      data: { businessId, name: name.trim(), description },
    });
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update Category (Rename)
router.put('/categories/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });

    const updated = await prisma.category.update({
      where: { id: req.params.id },
      data: { name: name.trim(), description },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete Category (Gracefully reassigns products to default Folders category)
router.delete('/categories/:id', async (req, res) => {
  try {
    const cat = await prisma.category.findUnique({
      where: { id: req.params.id },
    });
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    // Find default Folders category
    const defaultCat = await prisma.category.findFirst({
      where: { businessId: cat.businessId, name: 'Folders' },
    });

    if (defaultCat && defaultCat.id !== cat.id) {
      await prisma.product.updateMany({
        where: { categoryId: cat.id },
        data: { categoryId: defaultCat.id },
      });
    }

    await prisma.category.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Category deleted and products reassigned successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});


// Get Single Product detail with Movement History & Location Stocks
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        locationStocks: {
          include: { location: true },
        },
        stockMovements: {
          include: { fromLocation: true, toLocation: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

// Create New Product
router.post('/', async (req, res) => {
  try {
    const {
      businessId,
      locationId,
      categoryId,
      name,
      brand,
      model,
      partType,
      variant,
      quality,
      unit,
      sku,
      aliases,
      itemCode,
      purchasePrice,
      sellingPrice,
      currentStock,
      minStock,
      description,
    } = req.body;

    if (!businessId || !name || !name.trim()) {
      return res.status(400).json({ error: 'businessId and Product Name are required' });
    }

    const cleanedName = ProductNormalizer.stripNoiseWords(name.trim()) || name.trim();
    const initialStock = parseInt(currentStock || 0, 10);
    let validCategoryId = categoryId && categoryId.trim() !== '' ? categoryId : null;
    if (!validCategoryId) {
      const isBattery = partType === 'Battery' || /batter|cell|mah/i.test(cleanedName);
      const cat = await prisma.category.findFirst({
        where: {
          businessId,
          name: isBattery ? { contains: 'Batter' } : { contains: 'Folder' },
        },
      });
      if (cat) validCategoryId = cat.id;
    }

    // Check if duplicate exists via ProductNormalizer
    const matchResult = await ProductNormalizer.matchProduct(cleanedName, businessId);
    const existing = matchResult.match;

    if (existing) {
      // Add stock to the existing product rather than duplicate record
      if (initialStock > 0) {
        await StockEngine.recordMovement({
          businessId,
          productId: existing.id,
          locationId,
          type: 'OPENING',
          quantity: initialStock,
          stockState: 'GOOD',
          reference: 'STOCK_ADDITION',
          note: `Stock added to existing product (${existing.name})`,
        });
      }

      const updated = await prisma.product.findUnique({
        where: { id: existing.id },
        include: { category: true, locationStocks: { include: { location: true } } },
      });

      return res.status(200).json(updated);
    }

    const product = await prisma.product.create({
      data: {
        businessId,
        categoryId: validCategoryId,
        name: cleanedName,
        brand,
        model,
        partType: partType || 'Display',
        variant,
        quality: quality || 'OEM',
        unit: unit || 'PCS',
        sku: sku || null,
        aliases: aliases ? String(aliases).trim() : null,
        itemCode: itemCode || `ITEM-${Math.floor(1000 + Math.random() * 9000)}`,
        purchasePrice: parseFloat(purchasePrice || 0.0),
        sellingPrice: parseFloat(sellingPrice || purchasePrice || 0.0),
        repairShopPrice: parseFloat(req.body.repairShopPrice || sellingPrice || purchasePrice || 0.0),
        dealerPrice: parseFloat(req.body.dealerPrice || sellingPrice || purchasePrice || 0.0),
        wholesalePrice: parseFloat(req.body.wholesalePrice || sellingPrice || purchasePrice || 0.0),
        mrp: parseFloat(req.body.mrp || sellingPrice || purchasePrice || 0.0),
        warranty: req.body.warranty || '7 Days Testing',
        currentStock: 0,
        goodStock: 0,
        minStock: parseInt(minStock || 5, 10),
        description,
      },
    });

    // Record Opening Stock into target location (or default Godown)
    if (initialStock > 0) {
      await StockEngine.recordMovement({
        businessId,
        productId: product.id,
        locationId,
        type: 'OPENING',
        quantity: initialStock,
        stockState: 'GOOD',
        reference: 'OPENING_STOCK',
        note: 'Initial product stock entry',
      });
    }

    const finalProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, locationStocks: { include: { location: true } } },
    });

    res.status(201).json(finalProduct || product);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update Product Details
router.put('/:id', async (req, res) => {
  try {
    const {
      categoryId,
      name,
      brand,
      model,
      partType,
      variant,
      quality,
      unit,
      sku,
      aliases,
      itemCode,
      purchasePrice,
      sellingPrice,
      repairShopPrice,
      dealerPrice,
      wholesalePrice,
      mrp,
      warranty,
      minStock,
      description,
    } = req.body;

    let resolvedCategoryId = undefined;
    if (categoryId !== undefined) {
      resolvedCategoryId = categoryId && categoryId.trim() !== '' ? categoryId.trim() : null;
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        categoryId: resolvedCategoryId,
        name: name ? name.trim() : undefined,
        brand: brand !== undefined ? brand.trim() : undefined,
        model: model !== undefined ? model.trim() : undefined,
        partType: partType !== undefined ? partType : undefined,
        variant: variant !== undefined ? variant : undefined,
        quality: quality !== undefined ? quality : undefined,
        unit: unit !== undefined ? unit : undefined,
        sku: sku !== undefined ? sku : undefined,
        aliases: aliases !== undefined ? aliases : undefined,
        itemCode: itemCode !== undefined ? itemCode : undefined,
        purchasePrice: purchasePrice !== undefined && purchasePrice !== '' ? parseFloat(purchasePrice) : undefined,
        sellingPrice: sellingPrice !== undefined && sellingPrice !== '' ? parseFloat(sellingPrice) : undefined,
        repairShopPrice: repairShopPrice !== undefined && repairShopPrice !== '' ? parseFloat(repairShopPrice) : undefined,
        dealerPrice: dealerPrice !== undefined && dealerPrice !== '' ? parseFloat(dealerPrice) : undefined,
        wholesalePrice: wholesalePrice !== undefined && wholesalePrice !== '' ? parseFloat(wholesalePrice) : undefined,
        mrp: mrp !== undefined && mrp !== '' ? parseFloat(mrp) : undefined,
        warranty: warranty !== undefined ? warranty : undefined,
        minStock: minStock !== undefined && minStock !== '' ? parseInt(minStock, 10) : undefined,
        description: description !== undefined ? description : undefined,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: err.message || 'Failed to update product' });
  }
});

// Archive Product
router.delete('/:id', async (req, res) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED' },
    });
    res.json({ message: 'Product archived successfully', product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive product' });
  }
});

export default router;
