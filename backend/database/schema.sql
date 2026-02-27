-- Tablas Core
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, 
    username TEXT, 
    role TEXT, 
    pin_hash TEXT
);

CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY, 
    name TEXT, 
    unit TEXT, 
    cost REAL, 
    stock REAL
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, 
    name TEXT, 
    price REAL, 
    category TEXT,
    image_path TEXT
);

CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS recipes (
    product_id TEXT, 
    ingredient_id TEXT, 
    quantity REAL,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(ingredient_id) REFERENCES ingredients(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, 
    total REAL, 
    payment_method TEXT, 
    client TEXT,
    table_num TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT,
    product_id TEXT,
    quantity INTEGER,
    price REAL,
    note TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- Tabla de Configuración de Sistema (Tokens de Drive, Config de Impresora)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY, 
    value TEXT
);
