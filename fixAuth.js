const fs = require('fs');
const path = require('path');

const productFiles = [
  'src/app/api/products/[id]/route.ts',
  'src/app/api/products/route.ts',
  'src/app/api/products/import/route.ts',
  'src/app/api/products/global-highlight-price/route.ts',
  'src/app/api/products/export/route.ts',
  'src/app/api/products/bulk/route.ts'
];

productFiles.forEach(f => {
  let p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/import\s*\{\s*requireAuth\s*\}\s*from\s*"@\/lib\/authGuard";/, 'import { requireAdminOrManagerAuth } from "@/lib/authGuard";');
    content = content.replace(/requireAuth\("admin"\)/g, 'requireAdminOrManagerAuth("catalog_products")');
    fs.writeFileSync(p, content);
    console.log('Updated', f);
  }
});

const catFiles = [
  'src/app/api/categories/route.ts',
  'src/app/api/categories/[id]/route.ts'
];
catFiles.forEach(f => {
  let p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/import\s*\{\s*requireAuth\s*\}\s*from\s*"@\/lib\/authGuard";/, 'import { requireAdminOrManagerAuth } from "@/lib/authGuard";');
    content = content.replace(/requireAuth\("admin"\)/g, 'requireAdminOrManagerAuth("catalog_categories")');
    fs.writeFileSync(p, content);
    console.log('Updated', f);
  }
});

const colFiles = [
  'src/app/api/collections/route.ts',
  'src/app/api/collections/[id]/route.ts'
];
colFiles.forEach(f => {
  let p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/import\s*\{\s*requireAuth\s*\}\s*from\s*"@\/lib\/authGuard";/, 'import { requireAdminOrManagerAuth } from "@/lib/authGuard";');
    content = content.replace(/requireAuth\("admin"\)/g, 'requireAdminOrManagerAuth("catalog_collections")');
    fs.writeFileSync(p, content);
    console.log('Updated', f);
  }
});

const orderFiles = [
  'src/app/api/orders/[id]/route.ts'
];
orderFiles.forEach(f => {
  let p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/import\s*\{\s*requireAuth\s*\}\s*from\s*"@\/lib\/authGuard";/, 'import { requireAdminOrManagerAuth } from "@/lib/authGuard";');
    content = content.replace(/requireAuth\("admin"\)/g, 'requireAdminOrManagerAuth()');
    fs.writeFileSync(p, content);
    console.log('Updated', f);
  }
});
