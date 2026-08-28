# PriceWise

PriceWise is a static e-commerce comparison front end with modular product, filter, sort, and detail/comparison views. This project now includes a backend-ready architecture for real external product data integration.

## Architecture

- Frontend: Vanilla JavaScript, HTML, CSS
- Public data: `public/data/*.json`
- Runtime modules: `public/js/*.js`
- API-ready backend: `server/`

## Product import model

The external product flow is intentionally backend-ready and clearly marked as mock/demo until a legitimate provider is configured.

### Supported URL flows

- Amazon India product URLs
- Flipkart product URLs

### Development behavior

- Supported URLs are validated client-side before import
- Import requests can route to a real API later through `ProductDataService`
- Mock data is clearly labeled with `sourceType: "mock"`
- No Amazon or Flipkart scraping is performed in frontend JavaScript

## Local demo product links

PriceWise also supports local catalog links in the format:

`https://pricewise.local/product/<product-slug>`

Pasting one of these URLs into either search bar opens the matching local product details page. They are only identifiers for the bundled demo catalog; they do not query an external provider. Search priority is empty input, a PriceWise local link, a supported Amazon/Flipkart URL (mock/provider flow), then normal local text search. Unknown or malformed local links show a friendly validation message.

The ten verified demo links are:

- `https://pricewise.local/product/galaxy-s24-ultra`
- `https://pricewise.local/product/iphone-15-pro-max`
- `https://pricewise.local/product/oneplus-12`
- `https://pricewise.local/product/sony-wh-1000xm5`
- `https://pricewise.local/product/macbook-air-m3`
- `https://pricewise.local/product/dell-xps-13`
- `https://pricewise.local/product/asus-rog-strix-g16`
- `https://pricewise.local/product/ipad-air`
- `https://pricewise.local/product/galaxy-buds2-pro`
- `https://pricewise.local/product/logitech-mx-master-3s`

Product records live in `public/data/products.json`; supplied images are in `public/images/products/`. Products without a supplied JPG/PNG deliberately use `public/images/placeholders/product-placeholder.svg`. To add an eleventh product, add a unique `id` and URL-safe `slug`, the product fields and one or more numeric offers to the JSON, then use the generated `https://pricewise.local/product/<slug>` link. The product details page includes **Copy Product Link**; it reports gracefully if the browser blocks clipboard access.

## API contract

POST `/api/products/import`

Request:

```json
{
  "url": "https://www.amazon.in/dp/B09X3P5QK5"
}
```

Success:

```json
{
  "success": true,
  "product": {
    "id": "external-amazon-B09X3P5QK5",
    "source": "amazon",
    "sourceType": "mock",
    "externalId": "B09X3P5QK5",
    "url": "https://www.amazon.in/dp/B09X3P5QK5",
    "name": "Demo Amazon Product",
    "description": "This is development/mock data.",
    "image": "images/placeholders/product-placeholder.svg",
    "brand": "Amazon",
    "category": "electronics",
    "rating": 4.6,
    "reviewCount": 1284,
    "availability": "Demo data",
    "currency": "INR",
    "offers": [
      {
        "storeId": "amazon",
        "storeName": "Amazon",
        "price": 29999,
        "currency": "INR",
        "url": "https://www.amazon.in/dp/B09X3P5QK5",
        "availability": "Demo data",
        "lastUpdated": "2026-08-17T00:00:00.000Z"
      }
    ],
    "fetchedAt": "2026-08-17T00:00:00.000Z"
  }
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_NOT_CONFIGURED",
    "message": "No authorized provider is configured for this store."
  }
}
```

## Required credentials for production

Add real credentials in a secure environment, not in browser JavaScript.

- `AMAZON_API_KEY`
- `AMAZON_API_SECRET`
- `FLIPKART_API_KEY`
- `API_BASE_URL`

Use `.env` locally and keep it excluded from version control.

## Run locally

```bash
npm install express
node server/server.js
```

Then open the frontend in a browser or serve the public folder with a static file server.
