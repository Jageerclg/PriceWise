// PriceWise - Product data service abstraction
// Phase 8: External product URL import architecture

const ProductDataService = (function() {
    'use strict';

    const STORAGE_KEY = 'pricewise-imported-product';
    const API_ENDPOINT = '/api/products/import';

    class ProductProvider {
        constructor(name = 'provider') {
            this.name = name;
        }

        async fetchProductByUrl(request) {
            return {
                ok: false,
                product: null,
                source: 'mock',
                message: 'No provider configured.',
                error: {
                    code: 'PROVIDER_NOT_CONFIGURED',
                    message: 'No authorized provider is configured for this store.'
                }
            };
        }
    }

    class MockProductProvider extends ProductProvider {
        constructor() {
            super('mock');
        }

        async fetchProductByUrl(request) {
            const rawUrl = request && request.url ? request.url : '';
            const productId = request && request.productId ? request.productId : 'demo-product';
            const storeName = request && request.store ? request.store : 'Demo Store';
            const price = request && request.price ? Number(request.price) : 29999;

            const mockProduct = {
                id: `external-${String(storeName).toLowerCase().replace(/\s+/g, '-')}-${productId}`,
                source: 'mock',
                sourceType: 'mock',
                externalId: productId,
                url: rawUrl,
                name: `Demo ${storeName} Product`,
                description: 'This is demo/mock product data returned by the PriceWise external product import flow. A real authorized backend or API can replace this adapter when credentials are available.',
                image: 'images/placeholders/product-placeholder.svg',
                brand: String(storeName),
                category: 'electronics',
                rating: 4.6,
                reviewCount: 1284,
                availability: 'Demo data',
                currency: 'INR',
                offers: [
                    {
                        storeId: `store-${String(storeName).toLowerCase().replace(/\s+/g, '-')}`,
                        storeName: storeName,
                        price: price,
                        currency: 'INR',
                        availability: 'Demo data',
                        url: rawUrl,
                        lastUpdated: new Date().toISOString()
                    }
                ],
                fetchedAt: new Date().toISOString()
            };

            return {
                ok: true,
                product: mockProduct,
                source: 'mock',
                sourceType: 'mock',
                message: 'Mock product lookup completed successfully.'
            };
        }
    }

    class ApiProductProvider extends ProductProvider {
        constructor() {
            super('api');
        }

        async fetchProductByUrl(request) {
            const url = request && request.url ? request.url : '';
            if (!url) {
                return {
                    ok: false,
                    product: null,
                    source: 'api',
                    message: 'No URL provided for external product import.',
                    error: {
                        code: 'EMPTY_URL',
                        message: 'Please enter a product URL.'
                    }
                };
            }

            try {
                const response = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url })
                });

                const payload = await response.json();
                if (!response.ok || !payload || !payload.success || !payload.product) {
                    return {
                        ok: false,
                        product: null,
                        source: 'api',
                        message: payload && payload.error && payload.error.message ? payload.error.message : 'Unable to retrieve this product.',
                        error: payload && payload.error ? payload.error : {
                            code: 'API_ERROR',
                            message: 'Unable to retrieve this product.'
                        }
                    };
                }

                return {
                    ok: true,
                    product: payload.product,
                    source: 'api',
                    sourceType: 'api',
                    message: 'Product imported successfully.'
                };
            } catch (error) {
                return {
                    ok: false,
                    product: null,
                    source: 'api',
                    message: 'Unable to retrieve this product.',
                    error: {
                        code: 'NETWORK_ERROR',
                        message: error && error.message ? error.message : 'Network or API error.'
                    }
                };
            }
        }
    }

    const providers = {
        mock: new MockProductProvider(),
        api: new ApiProductProvider()
    };

    function getDefaultProvider() {
        return providers.mock;
    }

    function normalizeProduct(rawProduct, request) {
        if (!rawProduct || typeof rawProduct !== 'object') {
            return null;
        }

        const normalized = {
            id: rawProduct.id || rawProduct.externalId || `external-${Date.now()}`,
            name: rawProduct.name || 'Imported Product',
            description: rawProduct.description || 'Product details are temporarily unavailable.',
            image: rawProduct.image || 'images/placeholders/product-placeholder.svg',
            brand: rawProduct.brand || rawProduct.externalStore || '',
            category: rawProduct.category || 'electronics',
            source: rawProduct.source || 'external',
            sourceType: rawProduct.sourceType || 'mock',
            externalId: rawProduct.externalId || (request && request.productId) || '',
            url: rawProduct.url || rawProduct.originalUrl || (request && request.url) || '',
            originalUrl: rawProduct.originalUrl || rawProduct.url || (request && request.url) || '',
            externalStore: rawProduct.externalStore || rawProduct.source || (request && request.store) || 'Unknown Store',
            rating: typeof rawProduct.rating === 'number' ? rawProduct.rating : null,
            reviewCount: typeof rawProduct.reviewCount === 'number' ? rawProduct.reviewCount : null,
            availability: rawProduct.availability || 'Unknown',
            currency: rawProduct.currency || 'INR',
            fetchedAt: rawProduct.fetchedAt || new Date().toISOString(),
            offers: Array.isArray(rawProduct.offers) ? rawProduct.offers.map((offer) => ({
                storeId: offer && offer.storeId ? offer.storeId : rawProduct.externalId || 'external-store',
                storeName: offer && offer.storeName ? offer.storeName : rawProduct.externalStore || rawProduct.source || 'Store',
                price: Number(offer && offer.price) || 0,
                currency: offer && offer.currency ? offer.currency : rawProduct.currency || 'INR',
                availability: offer && offer.availability ? offer.availability : rawProduct.availability || 'Unknown',
                url: offer && offer.url ? offer.url : rawProduct.url || rawProduct.originalUrl || '#',
                lastUpdated: offer && offer.lastUpdated ? offer.lastUpdated : rawProduct.fetchedAt || new Date().toISOString()
            })) : []
        };

        if (normalized.offers.length === 0 && (request && request.url)) {
            normalized.offers = [{
                storeId: normalized.externalId || 'external-store',
                storeName: normalized.externalStore,
                price: Number(rawProduct.price) || 0,
                currency: normalized.currency,
                availability: normalized.availability,
                url: normalized.url || request.url,
                lastUpdated: normalized.fetchedAt
            }];
        }

        return normalized;
    }

    async function fetchExternalProduct(url) {
        const request = {
            url: typeof url === 'string' ? url.trim() : '',
            productId: ''
        };

        if (!request.url) {
            return {
                ok: false,
                error: {
                    code: 'EMPTY_URL',
                    message: 'Please enter a product URL.'
                },
                product: null
            };
        }

        try {
            const providerResult = await providers.api.fetchProductByUrl(request);
            if (providerResult && providerResult.ok && providerResult.product) {
                return {
                    ok: true,
                    product: normalizeProduct(providerResult.product, request),
                    source: providerResult.source || 'api',
                    message: providerResult.message || 'Product imported successfully.'
                };
            }

            return {
                ok: false,
                product: null,
                error: providerResult && providerResult.error ? providerResult.error : {
                    code: 'IMPORT_FAILED',
                    message: 'Unable to retrieve this product.'
                }
            };
        } catch (error) {
            return {
                ok: false,
                product: null,
                error: {
                    code: 'API_ERROR',
                    message: error && error.message ? error.message : 'Unable to retrieve this product.'
                }
            };
        }
    }

    async function importProductFromUrl(url) {
        const request = {
            url: typeof url === 'string' ? url.trim() : '',
            productId: ''
        };

        if (!request.url) {
            return {
                ok: false,
                error: {
                    code: 'EMPTY_URL',
                    message: 'Please enter a product URL.'
                },
                product: null
            };
        }

        const providerResult = await getDefaultProvider().fetchProductByUrl(request);

        if (!providerResult || !providerResult.ok || !providerResult.product) {
            return {
                ok: false,
                product: null,
                error: providerResult && providerResult.error ? providerResult.error : {
                    code: 'IMPORT_FAILED',
                    message: 'Unable to retrieve this product.'
                }
            };
        }

        const normalizedProduct = normalizeProduct(providerResult.product, request);
        const productRecord = {
            ...normalizedProduct,
            id: normalizedProduct.id || `external-${Date.now()}`
        };

        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(productRecord));
        } catch (error) {
            console.warn('ProductDataService: Could not save imported product to localStorage', error);
        }

        return {
            ok: true,
            product: productRecord,
            source: providerResult.source || 'mock',
            sourceType: providerResult.sourceType || 'mock',
            message: providerResult.message || 'Product imported successfully.'
        };
    }

    async function getProductByUrl(request) {
        return importProductFromUrl(request && request.url ? request.url : request);
    }

    function getLocalProduct(id) {
        if (!id || !window || !window.ProductsModule || typeof window.ProductsModule.getProducts !== 'function') {
            return null;
        }

        const products = window.ProductsModule.getProducts();
        return Array.isArray(products) ? products.find(product => product.id === id) || null : null;
    }

    function getImportedProduct(id) {
        const stored = getStoredImportedProduct();
        if (!stored) {
            return null;
        }

        if (id && stored.id !== id) {
            return null;
        }

        return stored;
    }

    function getProductById(id) {
        if (!id) {
            return null;
        }

        const localProduct = getLocalProduct(id);
        if (localProduct) {
            return localProduct;
        }

        return getImportedProduct(id);
    }

    function getStoredImportedProduct() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('ProductDataService: Could not read imported product from localStorage', error);
            return null;
        }
    }

    function clearImportedProduct() {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn('ProductDataService: Could not clear imported product from localStorage', error);
        }
    }

    return {
        ProductProvider,
        MockProductProvider,
        ApiProductProvider,
        getDefaultProvider,
        normalizeProduct,
        fetchExternalProduct,
        importProductFromUrl,
        getProductByUrl,
        getLocalProduct,
        getImportedProduct,
        getProductById,
        getStoredImportedProduct,
        clearImportedProduct,
        clearStoredImportedProduct: clearImportedProduct
    };
})();

if (typeof window !== 'undefined') {
    window.ProductDataService = ProductDataService;
}
