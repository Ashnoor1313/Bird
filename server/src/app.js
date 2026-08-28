import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import './prisma.js'; // initialize prisma singleton and WAL pragmas

import authRoutes from './routes/auth.js';
import businessRoutes from './routes/business.js';
import productRoutes from './routes/products.js';
import stockRoutes from './routes/stock.js';
import salesRoutes from './routes/sales.js';
import purchaseRoutes from './routes/purchases.js';
import customerRoutes from './routes/customers.js';
import supplierRoutes from './routes/suppliers.js';
import moneyRoutes from './routes/money.js';
import reportRoutes from './routes/reports.js';
import importRoutes from './routes/imports.js';
import ordersRoutes from './routes/orders.js';
import locationRoutes from './routes/locations.js';

dotenv.config();

// =============================================================================
// PROCESS ERROR RESILIENCE (Prevent server crash on any async/database error)
// =============================================================================
process.on('uncaughtException', (err) => {
  console.error('🚨 [BIRD Server] Uncaught Exception trapped (preventing exit):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [BIRD Server] Unhandled Promise Rejection trapped:', reason);
});

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads folder
app.use('/uploads', express.static(path.resolve('uploads')));

// Root API endpoint index
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    app: 'MI2 Impex — Mobile Spare-Parts ERP Backend API',
    endpoints: {
      health: '/api/health',
      businesses: '/api/businesses',
      locations: '/api/locations',
      products: '/api/products',
      sales: '/api/sales',
      purchases: '/api/purchases',
      customers: '/api/customers',
      suppliers: '/api/suppliers',
      money: '/api/money',
      reports: '/api/reports',
      orders: '/api/orders'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'BIRD Mobile Spare-Parts OS', time: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/money', moneyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/orders', ordersRoutes);

// =============================================================================
// SERVE PRODUCTION CLIENT SPA (For 1-Command Deployment on Cloud / VPS)
// =============================================================================
const candidatePaths = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve('client/dist'),
  path.resolve('../client/dist'),
  path.resolve('./client/dist'),
];

const clientDistPath = candidatePaths.find(p => fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html')));

if (clientDistPath) {
  console.log(`📦 Serving production SPA from: ${clientDistPath}`);
  app.use(express.static(clientDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  console.warn('⚠️ client/dist not found. API routes are active.');
}

// Friendly Global Error Handler (Rule: Never show technical 500 crash to user)
app.use((err, req, res, next) => {
  console.error('BIRD Server Error Handler:', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Something went wrong processing your request. Please try again.',
      message: err.message,
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 BIRD Server running on http://localhost:${PORT}`);
});

// Keep connection alive and avoid early TCP socket disconnects
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Ensure baseline Business, Locations & Categories exist on fresh database & WIPE dummy data for clean start
async function initBaselineData() {
  try {
    const prisma = (await import('./prisma.js')).default;
    let business = await prisma.business.findFirst();
    if (!business) {
      business = await prisma.business.create({
        data: {
          name: 'MI2 Impex',
          billPrefix: 'MI2',
          startingBillNo: 1001,
          state: 'Delhi',
        },
      });
      console.log('✅ Created default business: MI2 Impex');
    }

    // Ensure Categories
    const categories = ['Folders', 'Batteries'];
    for (const catName of categories) {
      const existingCat = await prisma.category.findFirst({
        where: { businessId: business.id, name: catName },
      });
      if (!existingCat) {
        await prisma.category.create({
          data: {
            businessId: business.id,
            name: catName,
            description: `${catName} spare parts`,
          },
        });
        console.log(`✅ Created category: ${catName}`);
      }
    }

    // Ensure Locations
    const defaultLocations = [
      { name: 'Godown', type: 'GODOWN' },
      { name: 'Store 1', type: 'STORE' },
      { name: 'Store 2', type: 'STORE' },
    ];
    for (const loc of defaultLocations) {
      const existingLoc = await prisma.location.findFirst({
        where: { businessId: business.id, name: loc.name },
      });
      if (!existingLoc) {
        await prisma.location.create({
          data: {
            businessId: business.id,
            name: loc.name,
            type: loc.type,
          },
        });
        console.log(`✅ Created location: ${loc.name}`);
      }
    }

    // Ensure Master Catalog Products exist if catalog is empty
    const productCount = await prisma.product.count({ where: { businessId: business.id } });
    if (productCount === 0) {
      const foldersCat = await prisma.category.findFirst({ where: { businessId: business.id, name: 'Folders' } });
      const batteriesCat = await prisma.category.findFirst({ where: { businessId: business.id, name: 'Batteries' } });

      const initialProducts = [
        {
          name: 'Samsung A15 Display',
          brand: 'Samsung',
          model: 'Galaxy A15 5G',
          partType: 'Display',
          variant: 'With Frame / Black',
          quality: 'OEM',
          unit: 'PCS',
          itemCode: 'DISP-SAM-A15',
          sku: 'SAM-A15-DISP',
          aliases: 'A15 LCD, Samsung A15 LCD, A15 Screen, A15 Display, A15 INCELL, Samsung A15 Folder',
          purchasePrice: 1850.0,
          sellingPrice: 2400.0,
          currentStock: 120,
          goodStock: 120,
          minStock: 15,
          warranty: '7 Days Testing Warranty',
          categoryId: foldersCat?.id,
        },
        {
          name: 'Vivo Y20 Folder',
          brand: 'Vivo',
          model: 'Y20 / Y20i / Y20s',
          partType: 'Display',
          variant: 'Black Frame',
          quality: 'OEM',
          unit: 'PCS',
          itemCode: 'DISP-VIV-Y20',
          aliases: 'Vivo Y20 LCD, Y20 Folder, Vivo Y20 Display',
          purchasePrice: 980.0,
          sellingPrice: 1350.0,
          currentStock: 40,
          goodStock: 40,
          minStock: 10,
          warranty: '7 Days Testing',
          categoryId: foldersCat?.id,
        },
        {
          name: 'Redmi Note 10 Folder',
          brand: 'Xiaomi / Redmi',
          model: 'Note 10 4G',
          partType: 'Folder',
          variant: 'Black Frame',
          quality: 'OEM',
          unit: 'PCS',
          itemCode: 'FOLD-RED-N10',
          sku: 'RED-N10-FOLD',
          aliases: 'Redmi Note 10 LCD, Note 10 Folder, Redmi Note 10 Screen, Note 10 Display',
          purchasePrice: 1200.0,
          sellingPrice: 1650.0,
          currentStock: 80,
          goodStock: 80,
          minStock: 10,
          warranty: '7 Days Testing Warranty',
          categoryId: foldersCat?.id,
        },
        {
          name: 'Samsung A15 Battery',
          brand: 'Samsung',
          model: 'Galaxy A15',
          partType: 'Battery',
          variant: '5000 mAh',
          quality: 'Original',
          unit: 'PCS',
          itemCode: 'BAT-SAM-A15',
          sku: 'SAM-A15-BAT',
          aliases: 'A15 Battery, Samsung A15 Batt, A15 Cell, Samsung A15 5000mAh',
          purchasePrice: 450.0,
          sellingPrice: 750.0,
          currentStock: 85,
          goodStock: 85,
          minStock: 15,
          warranty: '6 Months Warranty',
          categoryId: batteriesCat?.id,
        },
        {
          name: 'BLP793 Battery (Oppo A15 / A15s)',
          brand: 'Oppo',
          model: 'A15 / A15s / A16',
          partType: 'Battery',
          variant: '4230 mAh BLP793',
          quality: 'Original',
          unit: 'PCS',
          itemCode: 'BAT-BLP793',
          aliases: 'BLP793, BLP 793, Oppo A15 Battery, BLP793 Battery',
          purchasePrice: 380.0,
          sellingPrice: 650.0,
          currentStock: 50,
          goodStock: 50,
          minStock: 10,
          warranty: '6 Months Warranty',
          categoryId: batteriesCat?.id,
        },
      ];

      for (const prod of initialProducts) {
        if (prod.categoryId) {
          await prisma.product.create({
            data: {
              businessId: business.id,
              ...prod,
            },
          });
        }
      }
      console.log('✅ Baseline master catalog products created.');
    }

    // Ensure common stock synchronization across Godown, Store 1, Store 2
    const { StockEngine } = await import('./services/StockEngine.js');
    await StockEngine.syncBusinessStocks(business.id);

    console.log('✅ Baseline business, locations, categories, and common inventory synchronized and ready.');
  } catch (err) {
    console.warn('Database baseline initialization notice:', err.message);
  }
}

initBaselineData();


