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
  ssl: {
    ca: fs.readFileSync(process.env.DB_SSL_CA)
  }
};

// Поиск товара и альтернатив по user query
app.get('/api/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query is required' });
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    // Поиск основного товара
    const [productRows] = await conn.execute(
      "SELECT * FROM products WHERE our_product LIKE ? OR client_query LIKE ? LIMIT 1",
      [`%${query}%`, `%${query}%`]
    );
    let product = productRows[0];
    // Если не найдено, пробуем найти альтернативу
    if (!product) {
      const [altRows] = await conn.execute(
        "SELECT * FROM products WHERE our_product LIKE ? LIMIT 1",
        [`%${query}%`]
      );
      product = altRows[0];
    }
    if (!product) {
      return res.json(null);
    }
    // Альтернативы — другие продукты где совпадает client_query
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
    res.status(500).json({ error: 'Database error', details: err });
  } finally {
    if (conn) await conn.end();
  }
});

// пример ручки для добавления в сделку через Bitrix24 API (требует access_token!)
app.post('/api/bitrix/add-to-deal', async (req, res) => {
  // TODO: реализовать через BX24.callMethod или fetch, требуются access_token и параметры сделки/продукта
  res.json({ ok: true, message: 'Demo: добавление интеграции с Bitrix24' });
});

app.listen(port, () => console.log('API server running on port', port));
