import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';
import {
    getAuthUrl,
    saveTokenFromCode,
    isAuthenticated,
    createBackupZip,
    uploadToDrive,
    getBackupLog,
    listDriveBackups,
    downloadAndRestore,
} from './services/driveBackup.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'database.sqlite');
const db = new Database(dbPath);

// Initialize database with schema
const schema = fs.readFileSync(path.join(__dirname, 'database/schema.sql'), 'utf8');
db.exec(schema);

// Serve static frontend files FIRST
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());
app.use(express.json());

// Basic Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: dbPath });
});

// Products CRUD
app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
});

app.post('/api/products', (req, res) => {
    const { id, name, price, category, image_path } = req.body;
    const stmt = db.prepare('INSERT INTO products (id, name, price, category, image_path) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, name, price, category, image_path || '');
    res.status(201).json({ id });
});

app.put('/api/products/:id', (req, res) => {
    const { name, price, category, image_path } = req.body;
    const stmt = db.prepare('UPDATE products SET name = ?, price = ?, category = ?, image_path = ? WHERE id = ?');
    stmt.run(name, price, category, image_path, req.params.id);
    res.json({ message: 'Product updated' });
});

app.delete('/api/products/:id', (req, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM recipes WHERE product_id = ?').run(req.params.id);
    res.json({ message: 'Product deleted' });
});

// Categories CRUD
app.get('/api/categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM categories').all();
    res.json(categories.map(c => c.name));
});

app.post('/api/categories', (req, res) => {
    const { name } = req.body;
    db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(name);
    res.status(201).json({ name });
});

app.delete('/api/categories/:name', (req, res) => {
    db.prepare('DELETE FROM categories WHERE name = ?').run(req.params.name);
    res.json({ message: 'Category deleted' });
});

// Ingredients CRUD
app.get('/api/ingredients', (req, res) => {
    const ingredients = db.prepare('SELECT * FROM ingredients').all();
    res.json(ingredients);
});

app.post('/api/ingredients', (req, res) => {
    const { id, name, unit, cost, stock } = req.body;
    const stmt = db.prepare('INSERT INTO ingredients (id, name, unit, cost, stock) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, name, unit, cost, stock);
    res.status(201).json({ id });
});

app.put('/api/ingredients/:id', (req, res) => {
    const { name, unit, cost, stock } = req.body;

    // Update ingredient
    db.prepare('UPDATE ingredients SET name = ?, unit = ?, cost = ?, stock = ? WHERE id = ?')
        .run(name, unit, cost, stock, req.params.id);

    // Recalculate product costs logic would go here or triggered by a background job
    // As per prompt: "disparar evento de recálculo de costos teóricos"

    res.json({ message: 'Ingredient updated' });
});

app.delete('/api/ingredients/:id', (req, res) => {
    db.prepare('DELETE FROM ingredients WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM recipes WHERE ingredient_id = ?').run(req.params.id);
    res.json({ message: 'Ingredient deleted' });
});

// Recipes CRUD
app.get('/api/recipes/:productId', (req, res) => {
    const recipe = db.prepare(`
        SELECT r.*, i.name as ingredient_name, i.unit, i.cost
        FROM recipes r
        JOIN ingredients i ON r.ingredient_id = i.id
        WHERE r.product_id = ?
    `).all(req.params.productId);
    res.json(recipe);
});

app.post('/api/recipes', (req, res) => {
    const { product_id, ingredient_id, quantity } = req.body;
    db.prepare('INSERT OR REPLACE INTO recipes (product_id, ingredient_id, quantity) VALUES (?, ?, ?)')
        .run(product_id, ingredient_id, quantity);
    res.status(201).json({ message: 'Recipe item added' });
});

app.delete('/api/recipes/:productId/:ingredientId', (req, res) => {
    db.prepare('DELETE FROM recipes WHERE product_id = ? AND ingredient_id = ?')
        .run(req.params.productId, req.params.ingredientId);
    res.json({ message: 'Recipe item deleted' });
});

// Orders API
app.post('/api/orders', (req, res) => {
    const { id, total, payment, client, table, items } = req.body;

    const insertOrder = db.prepare(`
        INSERT INTO orders (id, total, payment_method, client, table_num, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
    `);

    const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, price, note)
        VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((orderData) => {
        insertOrder.run(orderData.id, orderData.total, orderData.payment, orderData.client, orderData.table);
        for (const item of orderData.items) {
            insertItem.run(orderData.id, item.id, item.quantity, item.price, item.note || '');
        }
    });

    try {
        transaction({ id, total, payment, client, table, items });
        res.status(201).json({ message: 'Order created', id });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// ─── Google OAuth2 ────────────────────────────────────────────────────────────

// Paso 1: Redirige al usuario a la pantalla de autorización de Google
app.get('/api/auth/google', (req, res) => {
    const url = getAuthUrl();
    res.redirect(url);
});

// Paso 2: Google redirige aquí con un código; lo intercambiamos por tokens
app.get('/api/auth/google/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) {
        return res.status(400).send(`<h2>❌ Acceso denegado: ${error}</h2>`);
    }
    try {
        await saveTokenFromCode(code);
        res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h2>✅ ¡Autorización exitosa!</h2>
            <p>OmniRest ya puede subir respaldos a tu Google Drive.</p>
            <p>Puedes cerrar esta ventana y volver al sistema.</p>
            </body></html>
        `);
    } catch (err) {
        console.error('[Auth] Error al guardar token:', err);
        res.status(500).send(`<h2>❌ Error al guardar token: ${err.message}</h2>`);
    }
});

// Consultar si ya está autorizado
app.get('/api/auth/google/status', (req, res) => {
    res.json({ authenticated: isAuthenticated() });
});

// ─── Backup a Google Drive ────────────────────────────────────────────────────

app.post('/api/backup/drive', async (req, res) => {
    if (!isAuthenticated()) {
        return res.status(401).json({
            error: 'No autorizado. Primero visita /api/auth/google para conectar tu cuenta.',
        });
    }
    const tempPath = path.join(DATA_DIR, '_temp_backup.zip');
    try {
        await createBackupZip(DATA_DIR, tempPath);
        const result = await uploadToDrive(tempPath);
        res.json({ success: true, fileId: result.id, fileName: result.name });
    } catch (err) {
        console.error('[Backup] Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
});

// Historial de backups realizados
app.get('/api/backup/log', (req, res) => {
    res.json(getBackupLog());
});

// Listar respaldos disponibles en Google Drive
app.get('/api/drive/files', async (req, res) => {
    if (!isAuthenticated()) return res.status(401).json({ files: [], error: 'Not authenticated' });
    try {
        const files = await listDriveBackups();
        res.json({ files });
    } catch (err) {
        console.error('[Drive] Error al listar archivos:', err);
        res.status(500).json({ error: err.message, files: [] });
    }
});

// Restaurar un respaldo desde Google Drive
app.post('/api/restore/drive', async (req, res) => {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ error: 'fileId requerido' });
    if (!isAuthenticated()) return res.status(401).json({ error: 'No autenticado' });

    try {
        // Cerramos la BD antes de reemplazar el archivo
        db.close();
        await downloadAndRestore(fileId, dbPath);
        res.json({ success: true, message: 'Restauración exitosa. El servidor se reiniciará en 2 segundos...' });
        // Docker (restart: unless-stopped) levantará el proceso automáticamente
        setTimeout(() => process.exit(0), 2000);
    } catch (err) {
        console.error('[Restore] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Catch-all para SPA ───────────────────────────────────────────────────────

// Catch-all to serve index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Data stored at: ${dbPath}`);
});
