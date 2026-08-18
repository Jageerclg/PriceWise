// PriceWise - URL import and validation module
// Phase 8: External product URL architecture

const ProductURLModule = (function() {
    'use strict';

    const SUPPORTED_STORES = {
        amazon: {
            name: 'Amazon',
            domains: ['amazon.in'],
            patterns: [
                /amazon\.in\/.*?(?:dp|gp\/product)\/(?:[A-Z0-9]{10,})/i,
                /amazon\.in\/.*?(?:dp|gp\/product)\/(?:[A-Z0-9]{10,})/i
            ]
        },
        flipkart: {
            name: 'Flipkart',
            domains: ['flipkart.com'],
            patterns: [
                /flipkart\.com\/.+\/p\/(?:[A-Za-z0-9]+)/i,
                /flipkart\.com\/.+\/p\/(?:itm[A-Za-z0-9]+)/i
            ]
        }
    };

    const state = {
        isProcessing: false,
        lastResult: null,
        lastError: null
    };

    function isHttpUrl(value) {
        if (typeof value !== 'string') {
            return false;
        }

        const trimmed = value.trim();
        if (!trimmed || trimmed.length < 8) {
            return false;
        }

        try {
            const url = new URL(trimmed);
            return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
        } catch (error) {
            return false;
        }
    }

    function normalizeUrl(value) {
        if (typeof value !== 'string') {
            return '';
        }

        const trimmed = value.trim();
        if (!trimmed) {
            return '';
        }

        try {
            const url = new URL(trimmed);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return '';
            }

            url.hash = '';
            url.search = url.search.replace(/[?&](utm_source|utm_medium|utm_campaign|utm_content|utm_term|ref=|tag=)[^&]*&?/gi, '');
            url.search = url.search.replace(/[?&]$/g, '');
            return url.toString();
        } catch (error) {
            return '';
        }
    }

    function canonicalizeHost(hostname) {
        return String(hostname || '').replace(/^www\./i, '').toLowerCase();
    }

    function detectStoreFromUrl(urlValue) {
        const normalizedUrl = normalizeUrl(urlValue);
        if (!normalizedUrl || !isHttpUrl(normalizedUrl)) {
            return null;
        }

        try {
            const url = new URL(normalizedUrl);
            const hostname = canonicalizeHost(url.hostname);

            for (const storeKey of Object.keys(SUPPORTED_STORES)) {
                const store = SUPPORTED_STORES[storeKey];
                if (store.domains.includes(hostname)) {
                    return {
                        key: storeKey,
                        name: store.name,
                        hostname,
                        normalizedUrl
                    };
                }
            }

            return null;
        } catch (error) {
            console.warn('ProductURLModule: detectStoreFromUrl failed', error);
            return null;
        }
    }

    function extractProductId(urlValue, storeKey) {
        const normalizedUrl = normalizeUrl(urlValue);
        if (!normalizedUrl) {
            return null;
        }

        try {
            const url = new URL(normalizedUrl);
            const hostname = canonicalizeHost(url.hostname);

            if (storeKey === 'amazon') {
                const match = normalizedUrl.match(/(?:dp|gp\/product)\/(?:[A-Z0-9]{10,})/i) ||
                    normalizedUrl.match(/(?:dp|gp\/product)\/([A-Z0-9]{10,})/i);
                if (match) {
                    return match[1] || match[0].split('/').pop();
                }
                return null;
            }

            if (storeKey === 'flipkart') {
                const match = normalizedUrl.match(/\/p\/(?:itm[A-Za-z0-9]+|[A-Za-z0-9]+)/i) ||
                    normalizedUrl.match(/\/p\/([A-Za-z0-9]+)/i);
                if (match) {
                    return match[1] || match[0].split('/').pop();
                }
                return null;
            }

            return null;
        } catch (error) {
            console.warn('ProductURLModule: extractProductId failed', error);
            return null;
        }
    }

    function validateProductUrl(value) {
        if (typeof value !== 'string') {
            return {
                isValid: false,
                reason: 'URL input must be a string.',
                supported: false
            };
        }

        const trimmed = value.trim();
        if (!trimmed) {
            return {
                isValid: false,
                reason: 'Please enter a product URL.',
                supported: false
            };
        }

        if (trimmed.toLowerCase().startsWith('javascript:')) {
            return {
                isValid: false,
                reason: 'JavaScript URLs are not allowed.',
                supported: false
            };
        }

        if (!isHttpUrl(trimmed)) {
            return {
                isValid: false,
                reason: 'Please enter a valid HTTP or HTTPS URL.',
                supported: false
            };
        }

        const store = detectStoreFromUrl(trimmed);
        if (!store) {
            return {
                isValid: true,
                reason: 'This URL is a valid web URL but it is not from a supported store.',
                supported: false,
                normalizedUrl: normalizeUrl(trimmed)
            };
        }

        const productId = extractProductId(trimmed, store.key);
        if (!productId) {
            return {
                isValid: false,
                supported: true,
                store: store.name,
                storeKey: store.key,
                normalizedUrl: store.normalizedUrl,
                reason: 'We could not extract a product identifier from this supported URL.'
            };
        }

        return {
            isValid: true,
            supported: true,
            store: store.name,
            storeKey: store.key,
            normalizedUrl: store.normalizedUrl,
            productId,
            reason: 'Product URL detected.'
        };
    }

    function buildProductRequest(urlValue) {
        const validation = validateProductUrl(urlValue);
        if (!validation.isValid) {
            return {
                ok: false,
                error: validation.reason,
                supported: false
            };
        }

        if (!validation.supported) {
            return {
                ok: false,
                error: 'We currently support Amazon India and Flipkart product URLs only.',
                supported: false,
                validation
            };
        }

        return {
            ok: true,
            supported: true,
            url: validation.normalizedUrl,
            store: validation.store,
            storeKey: validation.storeKey,
            productId: validation.productId || '',
            validation
        };
    }

    async function importProductFromUrl(urlValue) {
        const request = buildProductRequest(urlValue);
        if (!request.ok) {
            state.lastError = request.error;
            state.lastResult = null;
            return {
                ok: false,
                error: request.error,
                product: null,
                request
            };
        }

        state.isProcessing = true;
        state.lastError = null;

        try {
            const providerResult = await ProductDataService.getProductByUrl(request);
            state.isProcessing = false;
            state.lastResult = providerResult;

            if (!providerResult || !providerResult.ok || !providerResult.product) {
                const errorMessage = providerResult && providerResult.error ? providerResult.error : 'We couldn\'t retrieve product information from this URL.';
                state.lastError = errorMessage;
                return {
                    ok: false,
                    error: errorMessage,
                    product: null,
                    request
                };
            }

            return {
                ok: true,
                product: providerResult.product,
                source: providerResult.source || 'mock',
                request,
                message: providerResult.message || 'Product imported successfully.'
            };
        } catch (error) {
            state.isProcessing = false;
            state.lastError = error && error.message ? error.message : 'Unexpected product import failure.';
            return {
                ok: false,
                error: state.lastError,
                product: null,
                request
            };
        }
    }

    function setStatusMessage(message, type = 'info') {
        const statusElement = Utils.selectElement('#search-status');
        if (!statusElement) {
            return;
        }

        statusElement.hidden = false;
        statusElement.className = `search-status search-status-${type}`;
        statusElement.textContent = message;
    }

    function clearStatusMessage() {
        const statusElement = Utils.selectElement('#search-status');
        if (!statusElement) {
            return;
        }

        statusElement.hidden = true;
        statusElement.textContent = '';
    }

    function initializeSearchForms() {
        const forms = document.querySelectorAll('.search-form');

        forms.forEach(form => {
            if (form.dataset.urlImportBound === 'true') {
                return;
            }

            form.dataset.urlImportBound = 'true';
            Utils.addEventListener(form, 'submit', async (event) => {
                const input = form.querySelector('input[type="text"], input[type="search"]');
                const searchTerm = input ? input.value.trim() : '';

                if (!searchTerm) {
                    setStatusMessage('Please enter a product name or product URL.', 'error');
                    return;
                }

                const validation = validateProductUrl(searchTerm);
                if (validation.isValid && validation.supported) {
                    event.preventDefault();
                    setStatusMessage('Looking up product...', 'loading');

                    const importResult = await importProductFromUrl(searchTerm);
                    if (!importResult || !importResult.ok || !importResult.product) {
                        setStatusMessage(importResult && importResult.error ? importResult.error : 'We couldn\'t retrieve product information from this URL.', 'error');
                        return;
                    }

                    const productId = importResult.product.id || `external-${Date.now()}`;
                    const targetUrl = `product-details.html?external=${encodeURIComponent(productId)}`;
                    setStatusMessage('Product loaded. Redirecting...', 'success');

                    try {
                        window.location.assign(targetUrl);
                    } catch (error) {
                        console.warn('ProductURLModule: redirect failed', error);
                        window.location.href = targetUrl;
                    }
                    return;
                }

                if (validation.isValid && !validation.supported) {
                    event.preventDefault();
                    setStatusMessage('This URL is from an unsupported store. We currently support Amazon India and Flipkart only.', 'error');
                    return;
                }

                if (!validation.isValid && (searchTerm.includes('://') || searchTerm.includes('.'))) {
                    event.preventDefault();
                    setStatusMessage('This does not look like a valid product URL. Please check the link and try again.', 'error');
                    return;
                }
            });
        });
    }

    function getImportedProductById(productId) {
        if (!productId) {
            return null;
        }

        if (typeof ProductDataService !== 'undefined' && ProductDataService.getStoredImportedProduct) {
            const storedProduct = ProductDataService.getStoredImportedProduct();
            if (storedProduct && storedProduct.id === productId) {
                return storedProduct;
            }
        }

        return null;
    }

    return {
        SUPPORTED_STORES,
        isHttpUrl,
        normalizeUrl,
        detectStoreFromUrl,
        extractProductId,
        validateProductUrl,
        buildProductRequest,
        importProductFromUrl,
        initializeSearchForms,
        setStatusMessage,
        clearStatusMessage,
        getImportedProductById,
        state
    };
})();

if (typeof window !== 'undefined') {
    window.ProductURLModule = ProductURLModule;
}
