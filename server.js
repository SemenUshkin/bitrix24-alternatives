require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());



const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { ca: fs.readFileSync(process.env.DB_SSL_CA) }
};
mysql.createConnection(dbConfig)
  .then(conn => {
    console.log('Успешное подключение к MySQL!');
    return conn.end();
  })
  .catch(err => {
    console.error('Ошибка подключения к MySQL:', err.message);
  });

// Топ-20 товаров
app.get('/api/top-products', async (req, res) => {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute("SELECT our_product FROM products ORDER BY our_product ASC LIMIT 20");
    res.json({ products: rows.map(r => r.our_product) });
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  } finally {
    if (conn) await conn.end();
  }
});

// Поиск товара + альтернативы
app.get('/api/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query is required' });
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    const [productRows] = await conn.execute(
      "SELECT * FROM products WHERE our_product LIKE ? OR client_query LIKE ? LIMIT 1",
      [`%${query}%`, `%${query}%`]
    );
    let product = productRows[0];
    if (!product) return res.json(null);
    const [alternativesRows] = await conn.execute(
      "SELECT our_product FROM products WHERE client_query=? AND id!=?",
      [product.client_query, product.id]
    );
    res.json({
      clientQuery: product.client_query,
      ourProduct: product.our_product,
      alternatives: alternativesRows.map(r => r.our_product)
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  } finally {
    if (conn) await conn.end();
  }
});

app.listen(port, '0.0.0.0', () => console.log('API server running on port', port));
