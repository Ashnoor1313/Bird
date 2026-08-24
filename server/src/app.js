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
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
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

// Ensure baseline Business, Locations & Categories exist on fresh database
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

    // Auto-seed initial 29 phone models and stocks if database is empty
    const { seedProductsIfEmpty } = await import('./scripts/seed_cloud_products.js');
    await seedProductsIfEmpty(business.id);
  } catch (err) {
    console.warn('Database baseline initialization notice:', err.message);
  }
}

initBaselineData();


