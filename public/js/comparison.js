// PriceWise - Comparison module
// Phase 7: Product Comparison & Price Analysis

const ComparisonModule = (function() {
    'use strict';

    const state = {
        product: null,
        offers: [],
        bestPrice: null,
        bestStore: null,
        isComparing: false
    };

    /**
     * Find best valid price from offers
     * @param {Array} offers - Store offers
     * @returns {Object|null} Best offer or null
     */
    function findBestPrice(offers) {
        if (!Array.isArray(offers) || offers.length === 0) {
            return null;
        }

        const validOffers = offers.filter(offer => offer && isValidPrice(offer.price));
        if (validOffers.length === 0) {
            return null;
        }

        return validOffers.reduce((best, current) => {
            if (!best || Number(current.price) < Number(best.price)) {
                return current;
            }
            return best;
        }, validOffers[0]);
    }

    /**
     * Validate price value
     * @param {number|string} price - Price to validate
     * @returns {boolean} True if price is valid
     */
    function isValidPrice(price) {
        if (typeof price === 'string') {
            const parsed = Utils.parsePrice(price);
            return parsed !== null && parsed > 0;
        }
        return typeof price === 'number' && !isNaN(price) && price > 0;
    }

    /**
     * Compare store offers for a product
     * @param {Object} product - Product to compare
     * @param {Array} offers - Store offers
     * @returns {Object} Comparison result
     */
    function compareOffers(product, offers) {
        const normalizedOffers = Array.isArray(offers) ? handleMissingPrices(offers) : [];
        const bestOffer = findBestPrice(normalizedOffers);

        state.product = product || null;
        state.offers = normalizedOffers;
        state.bestPrice = bestOffer ? bestOffer.price : null;
        state.bestStore = bestOffer ? bestOffer.storeName || 'Store' : null;
        state.isComparing = Boolean(product) && normalizedOffers.length > 0;

        return {
            product: product || null,
            offers: normalizedOffers,
            bestPrice: bestOffer ? bestOffer.price : null,
            bestStore: state.bestStore,
            bestOffer: bestOffer || null
        };
    }

    /**
     * Handle currency conversion/comparison
     * @param {Array} offers - Offers with different currencies
     * @returns {Array} Normalized offers
     */
    function handleCurrencies(offers) {
        if (!Array.isArray(offers)) {
            return [];
        }
        return offers.map(offer => ({
            ...offer,
            currency: offer && offer.currency ? offer.currency : 'INR',
            availability: offer && offer.availability ? offer.availability : 'Price unavailable'
        }));
    }

    /**
     * Check if offers are comparable
     * @param {Array} offers - Offers to check
     * @returns {boolean} True if offers can be compared
     */
    function areOffersComparable(offers) {
        if (!Array.isArray(offers) || offers.length === 0) {
            return false;
        }

        return offers.some(offer => offer && isValidPrice(offer.price));
    }

    /**
     * Handle missing or invalid prices
     * @param {Array} offers - Offers to process
     * @returns {Array} Processed offers with placeholder data
     */
    function handleMissingPrices(offers) {
        if (!Array.isArray(offers)) {
            return [];
        }

        return offers.map(offer => {
            if (!offer || !isValidPrice(offer.price)) {
                return {
                    ...offer,
                    price: null,
                    availability: 'Unavailable',
                    note: 'Price unavailable'
                };
            }
            return offer;
        });
    }

    /**
     * Initialize comparison functionality
     */
    function initializeComparison() {
        const productId = Utils.getQueryParam('id');
        const selectedProduct = Utils.selectElement('#selected-product');
        const bestPriceBanner = Utils.selectElement('#best-price-banner');
        const comparisonTable = Utils.selectElement('#comparison-table');
        const noComparison = Utils.selectElement('#no-comparison');

        if (!productId) {
            showNoComparisonState(noComparison || selectedProduct || bestPriceBanner || comparisonTable);
            return;
        }

        if (!ProductsModule || typeof ProductsModule.loadProducts !== 'function') {
            console.warn('ComparisonModule: ProductsModule is not available');
            return;
        }

        ProductsModule.loadProducts()
            .then(() => {
                const product = ProductsModule.findProductById(productId);
                if (!product) {
                    showNoComparisonState(noComparison || selectedProduct || bestPriceBanner || comparisonTable);
                    return;
                }

                const offers = Array.isArray(product.offers) ? product.offers : [];
                const result = compareOffers(product, offers);

                updateSelectedProduct(product);
                updateBestPriceBanner(result.bestOffer, bestPriceBanner);
                renderComparisonTable(result.offers, comparisonTable);
                setProduct(product);
                setOffers(result.offers);
            })
            .catch((error) => {
                console.error('ComparisonModule: failed to load comparison data', error);
                showNoComparisonState(noComparison || selectedProduct || bestPriceBanner || comparisonTable);
            });
    }

    function updateSelectedProduct(product) {
        if (!product) {
            return;
        }

        const productImage = Utils.selectElement('#comparison-product-image');
        const productName = Utils.selectElement('#comparison-product-name');
        const productCategory = Utils.selectElement('#comparison-product-category');
        const viewDetailsLink = Utils.selectElement('.view-details-link');
        const detailsButton = Utils.selectElement('.details-button');

        if (productImage) {
            const safeImagePath = product.image && typeof product.image === 'string' && product.image.trim()
                ? product.image.trim()
                : 'images/placeholders/product-placeholder.svg';
            productImage.src = safeImagePath;
            productImage.alt = product.name || 'Product image';
            productImage.onerror = function() {
                if (productImage.dataset.fallbackApplied === 'true') {
                    return;
                }
                productImage.dataset.fallbackApplied = 'true';
                productImage.src = 'images/placeholders/product-placeholder.svg';
                productImage.onerror = null;
            };
        }

        if (productName) {
            Utils.setTextContent(productName, product.name || 'Product');
        }

        if (productCategory) {
            Utils.setTextContent(productCategory, product.category || 'General');
        }

        if (viewDetailsLink) {
            viewDetailsLink.href = `product-details.html?id=${encodeURIComponent(product.id)}`;
            viewDetailsLink.setAttribute('aria-label', `View details for ${product.name}`);
        }

        if (detailsButton) {
            detailsButton.href = `product-details.html?id=${encodeURIComponent(product.id)}`;
        }
    }

    /**
     * Render comparison table
     * @param {Array} offers - Offers to display
     * @param {Element} container - Table container
     */
    function renderComparisonTable(offers, container) {
        if (!container) {
            console.warn('Cannot render comparison table - container not found');
            return;
        }

        const tbody = container.querySelector('tbody');
        const tableWrapper = container.closest('.comparison-table-wrapper');
        const noComparison = Utils.selectElement('#no-comparison');

        if (!tbody) {
            return;
        }

        tbody.innerHTML = '';

        if (!Array.isArray(offers) || offers.length === 0 || !areOffersComparable(offers)) {
            if (tableWrapper) {
                tableWrapper.hidden = true;
            }
            if (noComparison) {
                noComparison.hidden = false;
            }
            return;
        }

        const bestOffer = findBestPrice(offers);

        if (tableWrapper) {
            tableWrapper.hidden = false;
        }
        if (noComparison) {
            noComparison.hidden = true;
        }

        const sortedOffers = [...offers].sort((a, b) => {
            const priceA = isValidPrice(a && a.price) ? Number(a.price) : Number.MAX_SAFE_INTEGER;
            const priceB = isValidPrice(b && b.price) ? Number(b.price) : Number.MAX_SAFE_INTEGER;
            return priceA - priceB;
        });

        sortedOffers.forEach((offer) => {
            if (!offer) {
                return;
            }

            const row = document.createElement('tr');
            row.className = `offer-row ${bestOffer && offer.storeId === bestOffer.storeId ? 'best-price-row' : ''}`;

            const storeCell = document.createElement('td');
            storeCell.className = 'store-cell';
            const storeInfo = document.createElement('div');
            storeInfo.className = 'store-info';

            const storeName = document.createElement('span');
            storeName.className = 'store-name';
            storeName.textContent = offer.storeName || 'Unknown Store';

            storeInfo.appendChild(storeName);
            if (bestOffer && offer.storeId === bestOffer.storeId) {
                const indicator = document.createElement('span');
                indicator.className = 'best-price-indicator';
                indicator.textContent = 'Best Price';
                storeInfo.appendChild(indicator);
            }
            storeCell.appendChild(storeInfo);

            const priceCell = document.createElement('td');
            priceCell.className = 'price-cell';
            priceCell.textContent = isValidPrice(offer.price)
                ? ProductsModule && typeof ProductsModule.formatPrice === 'function'
                    ? ProductsModule.formatPrice(Number(offer.price), offer.currency || 'INR')
                    : Utils.formatPrice(Number(offer.price), offer.currency || '₹')
                : 'N/A';

            const currencyCell = document.createElement('td');
            currencyCell.className = 'currency-cell';
            currencyCell.textContent = offer.currency || 'INR';

            const availabilityCell = document.createElement('td');
            availabilityCell.className = 'availability-cell';
            availabilityCell.textContent = offer.availability || 'Unavailable';

            const updatedCell = document.createElement('td');
            updatedCell.className = 'updated-cell';
            updatedCell.textContent = offer.lastUpdated ? new Date(offer.lastUpdated).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'N/A';

            const actionCell = document.createElement('td');
            actionCell.className = 'action-cell';
            const offerLink = document.createElement('a');
            offerLink.href = offer.url || '#';
            offerLink.className = 'offer-link';
            offerLink.textContent = 'View Offer';
            offerLink.target = offer.url ? '_blank' : '_self';
            offerLink.rel = 'noopener noreferrer';
            actionCell.appendChild(offerLink);

            row.appendChild(storeCell);
            row.appendChild(priceCell);
            row.appendChild(currencyCell);
            row.appendChild(availabilityCell);
            row.appendChild(updatedCell);
            row.appendChild(actionCell);
            tbody.appendChild(row);
        });
    }

    /**
     * Update best price banner
     * @param {Object} bestOffer - Best offer
     * @param {Element} container - Banner container
     */
    function updateBestPriceBanner(bestOffer, container) {
        const banner = container || Utils.selectElement('#best-price-banner');
        const priceEl = Utils.selectElement('#best-price-value');
        const storeEl = Utils.selectElement('#best-price-store');

        if (!banner || !priceEl || !storeEl) {
            return;
        }

        if (!bestOffer || !isValidPrice(bestOffer.price)) {
            banner.hidden = true;
            return;
        }

        banner.hidden = false;
        priceEl.textContent = ProductsModule && typeof ProductsModule.formatPrice === 'function'
            ? ProductsModule.formatPrice(Number(bestOffer.price), bestOffer.currency || 'INR')
            : Utils.formatPrice(Number(bestOffer.price), bestOffer.currency || '₹');
        storeEl.textContent = `at ${bestOffer.storeName || 'store'}`;
    }

    /**
     * Show no comparison state
     * @param {Element} container - Container element
     */
    function showNoComparisonState(container) {
        const target = container || Utils.selectElement('#no-comparison');
        const tableWrapper = Utils.selectElement('.comparison-table-wrapper');
        const banner = Utils.selectElement('#best-price-banner');

        if (tableWrapper) {
            tableWrapper.hidden = true;
        }
        if (banner) {
            banner.hidden = true;
        }
        if (target) {
            target.hidden = false;
        }
    }

    /**
     * Set current product for comparison
     * @param {Object} product - Product object
     */
    function setProduct(product) {
        state.product = product;
    }

    /**
     * Set offers for comparison
     * @param {Array} offers - Offers array
     */
    function setOffers(offers) {
        state.offers = offers;
    }

    /**
     * Get comparison state
     * @returns {Object} Current comparison state
     */
    function getComparisonState() {
        return { ...state };
    }

    /**
     * Reset comparison state
     */
    function resetComparison() {
        state.product = null;
        state.offers = [];
        state.bestPrice = null;
        state.bestStore = null;
        state.isComparing = false;
    }

    /**
     * Check if comparison is active
     * @returns {boolean} True if comparison is active
     */
    function isComparisonActive() {
        return state.isComparing;
    }

    return {
        initializeComparison,
        compareOffers,
        findBestPrice,
        isValidPrice,
        handleCurrencies,
        areOffersComparable,
        handleMissingPrices,
        renderComparisonTable,
        updateBestPriceBanner,
        showNoComparisonState,
        setProduct,
        setOffers,
        getComparisonState,
        resetComparison,
        isComparisonActive
    };
})();

if (typeof window !== 'undefined') {
    window.ComparisonModule = ComparisonModule;
}
