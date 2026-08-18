const express = require('express');
const productsRouter = require('./routes/products');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.use('/api/products', productsRouter);

app.listen(port, () => {
  console.log(`PriceWise API ready on http://localhost:${port}`);
});

module.exports = app;
