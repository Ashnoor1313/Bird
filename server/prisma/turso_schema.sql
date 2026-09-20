-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "state" TEXT DEFAULT 'Delhi',
    "billPrefix" TEXT NOT NULL DEFAULT 'BIRD',
    "startingBillNo" INTEGER NOT NULL DEFAULT 1001,
    "bankName" TEXT,
    "accountNo" TEXT,
    "ifscCode" TEXT,
    "upiId" TEXT,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "terms" TEXT DEFAULT 'Goods once sold will not be taken back unless defective under warranty testing.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserBusiness" (
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "businessId"),
    CONSTRAINT "UserBusiness_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBusiness_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Warehouse_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STORE',
    "address" TEXT,
    "phone" TEXT,
    "managerName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "goodStock" INTEGER NOT NULL DEFAULT 0,
    "defectiveStock" INTEGER NOT NULL DEFAULT 0,
    "testingStock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LocationStock_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LocationStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LocationStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "partType" TEXT,
    "variant" TEXT,
    "quality" TEXT NOT NULL DEFAULT 'OEM',
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "sku" TEXT,
    "aliases" TEXT,
    "itemCode" TEXT,
    "barcode" TEXT,
    "hsn" TEXT DEFAULT '8517',
    "gstPercentage" REAL NOT NULL DEFAULT 18.0,
    "purchasePrice" REAL NOT NULL DEFAULT 0.0,
    "sellingPrice" REAL NOT NULL DEFAULT 0.0,
    "repairShopPrice" REAL DEFAULT 0.0,
    "dealerPrice" REAL DEFAULT 0.0,
    "wholesalePrice" REAL DEFAULT 0.0,
    "mrp" REAL DEFAULT 0.0,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 5,
    "goodStock" INTEGER NOT NULL DEFAULT 0,
    "defectiveStock" INTEGER NOT NULL DEFAULT 0,
    "testingStock" INTEGER NOT NULL DEFAULT 0,
    "warranty" TEXT DEFAULT '7 Days Testing',
    "description" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "categoryId" TEXT DEFAULT 'folders',
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "previousSourceQuantity" INTEGER,
    "newSourceQuantity" INTEGER,
    "previousDestQuantity" INTEGER,
    "newDestQuantity" INTEGER,
    "stockState" TEXT NOT NULL DEFAULT 'GOOD',
    "reference" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL DEFAULT 'folders',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "state" TEXT DEFAULT 'Delhi',
    "priceLevel" TEXT NOT NULL DEFAULT 'RETAIL',
    "moneyToReceive" REAL NOT NULL DEFAULT 0.0,
    "totalSales" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Customer_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "state" TEXT DEFAULT 'Delhi',
    "moneyToPay" REAL NOT NULL DEFAULT 0.0,
    "totalPurchases" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Supplier_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierLedger_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL DEFAULT 'folders',
    "billNo" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "saleDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "cgst" REAL NOT NULL DEFAULT 0.0,
    "sgst" REAL NOT NULL DEFAULT 0.0,
    "igst" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    "totalCost" REAL NOT NULL DEFAULT 0.0,
    "grossProfit" REAL NOT NULL DEFAULT 0.0,
    "paidAmount" REAL NOT NULL DEFAULT 0.0,
    "dueAmount" REAL NOT NULL DEFAULT 0.0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sale_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "model" TEXT,
    "quality" TEXT,
    "variant" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "purchasePrice" REAL NOT NULL DEFAULT 0.0,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "gstPercentage" REAL NOT NULL DEFAULT 18.0,
    "cgst" REAL NOT NULL DEFAULT 0.0,
    "sgst" REAL NOT NULL DEFAULT 0.0,
    "igst" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    "warrantyDays" TEXT DEFAULT '7 Days Testing',
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "receivingLocationId" TEXT NOT NULL,
    "categoryId" TEXT DEFAULT 'folders',
    "purchaseNo" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "billNo" TEXT,
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ocrScanned" BOOLEAN NOT NULL DEFAULT false,
    "imagePath" TEXT,
    "subtotal" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "cgst" REAL NOT NULL DEFAULT 0.0,
    "sgst" REAL NOT NULL DEFAULT 0.0,
    "igst" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0.0,
    "dueAmount" REAL NOT NULL DEFAULT 0.0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Purchase_receivingLocationId_fkey" FOREIGN KEY ("receivingLocationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "model" TEXT,
    "quality" TEXT,
    "variant" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "gstPercentage" REAL NOT NULL DEFAULT 18.0,
    "cgst" REAL NOT NULL DEFAULT 0.0,
    "sgst" REAL NOT NULL DEFAULT 0.0,
    "igst" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "categoryId" TEXT DEFAULT 'folders',
    "type" TEXT NOT NULL,
    "partyType" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "partyName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paidFrom" TEXT NOT NULL DEFAULT 'CASH',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT,
    "cashBalance" REAL NOT NULL DEFAULT 0.0,
    "bankBalance" REAL NOT NULL DEFAULT 0.0,
    "upiBalance" REAL NOT NULL DEFAULT 0.0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountBalance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT,
    "quoteNo" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "quoteDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "subtotal" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "cgst" REAL NOT NULL DEFAULT 0.0,
    "sgst" REAL NOT NULL DEFAULT 0.0,
    "igst" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "model" TEXT,
    "quality" TEXT,
    "variant" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "gstPercentage" REAL NOT NULL DEFAULT 18.0,
    "total" REAL NOT NULL,
    CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "cgst" REAL NOT NULL DEFAULT 0.0,
    "sgst" REAL NOT NULL DEFAULT 0.0,
    "igst" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    "advancePaid" REAL NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "model" TEXT,
    "quality" TEXT,
    "variant" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT,
    "challanNo" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "challanDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleNo" TEXT,
    "transport" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DeliveryChallanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryChallanId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "DeliveryChallanItem_deliveryChallanId_fkey" FOREIGN KEY ("deliveryChallanId") REFERENCES "DeliveryChallan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT,
    "poNo" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "poDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" DATETIME,
    "subtotal" REAL NOT NULL,
    "total" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LocationStock_businessId_locationId_idx" ON "LocationStock"("businessId", "locationId");

-- CreateIndex
CREATE INDEX "LocationStock_businessId_productId_idx" ON "LocationStock"("businessId", "productId");

-- CreateIndex
CREATE INDEX "LocationStock_locationId_productId_idx" ON "LocationStock"("locationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationStock_businessId_locationId_productId_key" ON "LocationStock"("businessId", "locationId", "productId");

-- CreateIndex
CREATE INDEX "Product_businessId_categoryId_status_idx" ON "Product"("businessId", "categoryId", "status");

-- CreateIndex
CREATE INDEX "Product_businessId_brand_model_idx" ON "Product"("businessId", "brand", "model");

-- CreateIndex
CREATE INDEX "Product_businessId_status_createdAt_idx" ON "Product"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Product_businessId_name_idx" ON "Product"("businessId", "name");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_categoryId_createdAt_idx" ON "StockMovement"("businessId", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_productId_createdAt_idx" ON "StockMovement"("businessId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_type_createdAt_idx" ON "StockMovement"("businessId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_businessId_locationId_categoryId_createdAt_idx" ON "Customer"("businessId", "locationId", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_businessId_locationId_categoryId_phone_idx" ON "Customer"("businessId", "locationId", "categoryId", "phone");

-- CreateIndex
CREATE INDEX "Customer_businessId_name_idx" ON "Customer"("businessId", "name");

-- CreateIndex
CREATE INDEX "Customer_businessId_phone_idx" ON "Customer"("businessId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_locationId_categoryId_phone_key" ON "Customer"("locationId", "categoryId", "phone");

-- CreateIndex
CREATE INDEX "Supplier_businessId_locationId_createdAt_idx" ON "Supplier"("businessId", "locationId", "createdAt");

-- CreateIndex
CREATE INDEX "Supplier_businessId_locationId_phone_idx" ON "Supplier"("businessId", "locationId", "phone");

-- CreateIndex
CREATE INDEX "Supplier_businessId_name_idx" ON "Supplier"("businessId", "name");

-- CreateIndex
CREATE INDEX "Supplier_businessId_phone_idx" ON "Supplier"("businessId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_locationId_phone_key" ON "Supplier"("locationId", "phone");

-- CreateIndex
CREATE INDEX "CustomerLedger_businessId_locationId_customerId_createdAt_idx" ON "CustomerLedger"("businessId", "locationId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerLedger_customerId_createdAt_idx" ON "CustomerLedger"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierLedger_businessId_locationId_supplierId_createdAt_idx" ON "SupplierLedger"("businessId", "locationId", "supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierLedger_supplierId_createdAt_idx" ON "SupplierLedger"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_businessId_locationId_categoryId_createdAt_idx" ON "Sale"("businessId", "locationId", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_businessId_customerId_createdAt_idx" ON "Sale"("businessId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_businessId_billNo_idx" ON "Sale"("businessId", "billNo");

-- CreateIndex
CREATE INDEX "Sale_businessId_createdAt_idx" ON "Sale"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_locationId_categoryId_billNo_key" ON "Sale"("locationId", "categoryId", "billNo");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "Purchase_businessId_receivingLocationId_categoryId_createdAt_idx" ON "Purchase"("businessId", "receivingLocationId", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_businessId_supplierId_createdAt_idx" ON "Purchase"("businessId", "supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_businessId_purchaseNo_idx" ON "Purchase"("businessId", "purchaseNo");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- CreateIndex
CREATE INDEX "Payment_businessId_locationId_categoryId_createdAt_idx" ON "Payment"("businessId", "locationId", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_businessId_customerId_createdAt_idx" ON "Payment"("businessId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_businessId_supplierId_createdAt_idx" ON "Payment"("businessId", "supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_businessId_type_createdAt_idx" ON "Payment"("businessId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_businessId_locationId_categoryId_createdAt_idx" ON "Expense"("businessId", "locationId", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_businessId_category_createdAt_idx" ON "Expense"("businessId", "category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalance_businessId_locationId_key" ON "AccountBalance"("businessId", "locationId");

