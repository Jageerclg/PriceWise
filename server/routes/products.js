const express = require('express');
const { ProductService } = require('../services/product-service');

const router = express.Router();
const productService = new ProductService();

router.post('/import', async (req, res) => {
  const { url } = req.body || {};
  const result = await productService.importProductFromUrl(url);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error
    });
  }

  return res.json({
    success: true,
    product: result.product
  });
});

module.exports = router;
