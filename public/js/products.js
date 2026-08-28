// PriceWise - Products module
// Phase 4: Product Catalog and Sample Data

const ProductsModule = (function() {
    'use strict';

    // Product state
    const state = {
        products: [],
        filteredProducts: [],
        currentProduct: null,
        isLoading: false,
        loadError: null
    };

    const DATA_URL = 'data/products.json';
    const FALLBACK_IMAGE = 'images/placeholders/product-placeholder.svg';

    function getSafeImagePath(imagePath) {
        if (typeof imagePath !== 'string' || !imagePath.trim()) {
            return FALLBACK_IMAGE;
        }

        const trimmed = imagePath.trim();
        if (trimmed.startsWith('data:') || trimmed.startsWith('javascript:') || trimmed.startsWith('blob:')) {
            return FALLBACK_IMAGE;
        }

        return trimmed;
    }

    function applyImageFallback(img, fallbackPath = FALLBACK_IMAGE) {
        if (!img) {
            return;
        }

        img.addEventListener('error', function handleImageError() {
            if (img.dataset.fallbackApplied === 'true') {
                return;
            }

            img.dataset.fallbackApplied = 'true';
            img.src = fallbackPath;
            img.onerror = null;
        }, { once: true });
    }

    /**
     * Load products from JSON data
     * @returns {Promise<Array>} Products array
     */
    async function loadProducts() {
        console.log('ProductsModule: Loading products from', DATA_URL);
        state.isLoading = true;
        state.loadError = null;

        try {
            const response = await fetch(DATA_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Validate data structure
            if (!data || !Array.isArray(data.products)) {
                throw new Error('Invalid data structure: expected products array');
            }

            state.products = data.products;
            state.filteredProducts = [...data.products];
            state.isLoading = false;
            
            console.log(`ProductsModule: Loaded ${state.products.length} products`);
            return state.products;
            
        } catch (error) {
            console.error('ProductsModule: Failed to load products', error);
            state.loadError = error.message;
            state.isLoading = false;
            state.products = [];
            state.filteredProducts = [];
            throw error;
        }
    }

    /**
     * Get all products
     * @returns {Array} Products array
     */
    function getProducts() {
        return state.products;
    }

    /**
     * Get filtered products
     * @returns {Array} Filtered products array
     */
    function getFilteredProducts() {
        return state.filteredProducts;
    }

    /**
     * Find product by ID
     * @param {string} productId - Product ID
     * @returns {Object|null} Product object or null
     */
    function findProductById(productId) {
        if (!productId || typeof productId !== 'string') {
            return null;
        }
        return state.products.find(product => product.id === productId) || null;
    }

    /**
     * Format price for INR currency
     * @param {number} price - Price value
     * @param {string} currency - Currency code (default: INR)
     * @returns {string} Formatted price string
     */
    function formatPrice(price, currency = 'INR') {
        if (typeof price !== 'number' || isNaN(price)) {
            return '₹0';
        }
        
        // Format for INR
        if (currency === 'INR') {
            return '₹' + price.toLocaleString('en-IN');
        }
        
        // Default formatting for other currencies
        return Utils.formatPrice(price, currency === 'INR' ? '₹' : currency);
    }

    /**
     * Generate star rating HTML
     * @param {number} rating - Rating value (0-5)
     * @returns {string} Star rating HTML
     */
    function generateStarRating(rating) {
        if (typeof rating !== 'number' || rating < 0 || rating > 5) {
            return '☆☆☆☆☆';
        }
        
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let stars = '★'.repeat(fullStars);
        if (hasHalfStar) {
            stars += '½';
        }
        stars += '☆'.repeat(emptyStars);
        
        return stars;
    }

    /**
     * Get best price from product offers
     * @param {Object} product - Product object
     * @returns {Object|null} Best offer or null
     */
    function getBestPrice(product) {
        if (!product || !Array.isArray(product.offers) || product.offers.length === 0) {
            return null;
        }
        
        // Filter offers with valid prices
        const validOffers = product.offers.filter(offer => 
            offer && typeof offer.price === 'number' && offer.price > 0
        );
        
        if (validOffers.length === 0) {
            return null;
        }
        
        // Find offer with minimum price
        return validOffers.reduce((best, current) => 
            current.price < best.price ? current : best
        );
    }

    /**
     * Create product card HTML element
     * @param {Object} product - Product data
     * @returns {Element} Product card element
     */
    function createProductCard(product) {
        if (!product) {
            console.warn('ProductsModule: Cannot create card - invalid product');
            return document.createElement('article');
        }

        const card = document.createElement('article');
        card.className = 'product-card';
        
        // Get best price for display
        const bestOffer = getBestPrice(product);
        const displayPrice = bestOffer ? formatPrice(bestOffer.price, bestOffer.currency) : 'Price not available';
        const currency = bestOffer ? bestOffer.currency : '';

        // Product image
        const imageContainer = document.createElement('div');
        imageContainer.className = 'product-image';
        
        const image = document.createElement('img');
        const safeImagePath = getSafeImagePath(product.image || FALLBACK_IMAGE);
        image.src = safeImagePath;
        image.alt = product.name ? `${product.name} - ${product.category || 'product'}` : 'Product image';
        image.className = safeImagePath.includes('placeholder') ? 'placeholder-image' : '';
        applyImageFallback(image, FALLBACK_IMAGE);
        imageContainer.appendChild(image);
        
        // Product name
        const name = document.createElement('h3');
        name.className = 'product-name';
        name.textContent = product.name || 'Unnamed Product';
        
        // Product category
        const category = document.createElement('p');
        category.className = 'product-category';
        category.textContent = product.category || 'General';

        const brand = document.createElement('p');
        brand.className = 'product-brand';
        brand.textContent = product.brand ? `Brand: ${product.brand}` : '';
        
        // Product description (truncated)
        const description = document.createElement('p');
        description.className = 'product-description';
        const descText = product.description || '';
        description.textContent = descText.length > 100 ? descText.substring(0, 100) + '...' : descText;
        description.style.color = 'var(--color-secondary-text)';
        description.style.fontSize = 'var(--font-size-sm)';
        description.style.marginBottom = 'var(--spacing-sm)';
        
        // Rating (if available)
        let ratingElement = null;
        if (product.rating && typeof product.rating === 'number') {
            ratingElement = document.createElement('div');
            ratingElement.className = 'product-rating';
            ratingElement.style.display = 'flex';
            ratingElement.style.alignItems = 'center';
            ratingElement.style.gap = 'var(--spacing-xs)';
            ratingElement.style.marginBottom = 'var(--spacing-sm)';
            
            const ratingValue = document.createElement('span');
            ratingValue.textContent = product.rating.toFixed(1);
            ratingValue.style.fontWeight = 'var(--font-weight-semibold)';
            
            const ratingStars = document.createElement('span');
            ratingStars.textContent = generateStarRating(product.rating);
            ratingStars.style.color = '#ffc107';
            
            ratingElement.appendChild(ratingValue);
            ratingElement.appendChild(ratingStars);
            if (typeof product.reviewCount === 'number') {
                const reviews = document.createElement('span');
                reviews.textContent = `(${product.reviewCount.toLocaleString('en-IN')} reviews)`;
                ratingElement.appendChild(reviews);
            }
        }
        
        // Price
        const price = document.createElement('p');
        price.className = 'product-price';
        price.textContent = bestOffer ? displayPrice : 'Price not available';

        const priceMeta = document.createElement('p');
        priceMeta.className = 'product-price-meta';
        const mrp = Number(product.mrp);
        const discount = Number(product.discountPercent);
        priceMeta.textContent = Number.isFinite(mrp) && mrp > 0
            ? `MRP ${formatPrice(mrp, product.currency || 'INR')}${discount > 0 ? ` · ${discount}% OFF` : ''}`
            : '';

        const bestStore = document.createElement('p');
        bestStore.className = 'product-best-store';
        bestStore.textContent = bestOffer ? `Best price at ${bestOffer.storeName || 'a demo store'}` : '';
        
        // View Details link
        const link = document.createElement('a');
        link.href = `product-details.html?id=${encodeURIComponent(product.id)}`;
        link.className = 'product-link';
        link.textContent = 'View Details';
        link.setAttribute('aria-label', `View details for ${product.name}`);

        const compareLink = document.createElement('a');
        compareLink.href = `comparison.html?id=${encodeURIComponent(product.id)}`;
        compareLink.className = 'compare-button';
        compareLink.textContent = 'Compare Prices';
        
        // Assemble card
        card.appendChild(imageContainer);
        card.appendChild(category);
        if (brand.textContent) card.appendChild(brand);
        card.appendChild(name);
        card.appendChild(description);
        
        if (ratingElement) {
            card.appendChild(ratingElement);
        }
        
        card.appendChild(price);
        if (priceMeta.textContent) card.appendChild(priceMeta);
        if (bestStore.textContent) card.appendChild(bestStore);
        card.appendChild(link);
        card.appendChild(compareLink);
        
        return card;
    }

    /**
     * Render products to container
     * @param {Array} products - Products to render
     * @param {Element} container - Container element
     */
    function renderProducts(products, container) {
        if (!container) {
            console.warn('Cannot render products - container not found');
            return;
        }

        // Clear existing content
        container.innerHTML = '';
        
        if (!Array.isArray(products) || products.length === 0) {
            showNoResultsState(container);
            return;
        }

        // Render each product
        products.forEach(product => {
            const card = createProductCard(product);
            container.appendChild(card);
        });
    }

    /**
     * Render featured products (subset of products)
     * @param {Element} container - Container element
     * @param {number} count - Number of featured products to show
     */
    function renderFeaturedProducts(container, count = 3) {
        if (!container) {
            console.warn('Cannot render featured products - container not found');
            return;
        }

        // Clear existing content
        container.innerHTML = '';
        
        if (state.products.length === 0) {
            // Show loading or empty state
            if (state.isLoading) {
                showLoadingState(container);
            } else {
                showNoResultsState(container);
            }
            return;
        }

        // Get first N products as featured
        const featuredProducts = state.products.slice(0, count);
        renderProducts(featuredProducts, container);
    }

    /**
     * Render product details
     * @param {Object} product - Product data
     * @param {Element} container - Container element
     */
    function renderProductDetails(product, container) {
        if (!container) {
            console.warn('Cannot render product details - container not found');
            return;
        }

        if (!product) {
            showUnavailableState(container);
            return;
        }

        // Update product image
        const productImage = Utils.selectElement('#product-image');
        if (productImage) {
            const safeImagePath = getSafeImagePath(product.image || FALLBACK_IMAGE);
            productImage.src = safeImagePath;
            productImage.alt = product.name || 'Product image';
            applyImageFallback(productImage, FALLBACK_IMAGE);
        }

        // Update product name
        const productName = Utils.selectElement('#product-name');
        if (productName) {
            Utils.setTextContent(productName, product.name || 'Unnamed Product');
        }

        // Update product category
        const productCategory = Utils.selectElement('#product-category');
        if (productCategory) {
            Utils.setTextContent(productCategory, [product.brand, product.category].filter(Boolean).join(' · ') || 'General');
        }

        const productSource = Utils.selectElement('#product-source');
        if (productSource) {
            Utils.setTextContent(productSource, `Source: ${product.sourceType === 'mock' ? 'Mock provider data' : 'Local demo catalog'}`);
        }

        // Update rating
        const ratingContainer = Utils.selectElement('#product-rating');
        const ratingValue = Utils.selectElement('#rating-value');
        const ratingStars = Utils.selectElement('.rating-stars');
        
        if (product.rating && typeof product.rating === 'number') {
            if (ratingContainer) {
                ratingContainer.hidden = false;
            }
            if (ratingValue) {
                Utils.setTextContent(ratingValue, product.rating.toFixed(1));
            }
            if (ratingStars) {
                Utils.setTextContent(ratingStars, generateStarRating(product.rating));
            }
        } else {
            if (ratingContainer) {
                ratingContainer.hidden = true;
            }
        }

        // Update description
        const productDescription = Utils.selectElement('#product-description');
        if (productDescription) {
            Utils.setTextContent(productDescription, product.description || 'No description available.');
        }

        const summary = Utils.selectElement('#product-price-summary');
        if (summary) {
            const bestOffer = getBestPrice(product);
            summary.textContent = bestOffer
                ? `Best price ${formatPrice(bestOffer.price, bestOffer.currency || product.currency || 'INR')} at ${bestOffer.storeName || 'a demo store'}${product.mrp ? ` · MRP ${formatPrice(Number(product.mrp), product.currency || 'INR')}` : ''}${product.discountPercent ? ` · ${product.discountPercent}% OFF` : ''}`
                : 'No valid demo offers are available.';
        }
        const reviews = Utils.selectElement('#product-review-count');
        if (reviews) reviews.textContent = typeof product.reviewCount === 'number' ? `${product.reviewCount.toLocaleString('en-IN')} reviews` : '';

        // Render offers
        renderOffers(product);
    }

    /**
     * Render product offers
     * @param {Object} product - Product data
     */
    function renderOffers(product) {
        const offersList = Utils.selectElement('#offers-list');
        const noOffers = Utils.selectElement('#no-offers');
        
        if (!offersList) {
            console.warn('Cannot render offers - offers list container not found');
            return;
        }

        // Clear existing offers
        offersList.innerHTML = '';
        
        if (!Array.isArray(product.offers) || product.offers.length === 0) {
            if (noOffers) {
                noOffers.hidden = false;
            }
            return;
        }

        // Hide no offers message
        if (noOffers) {
            noOffers.hidden = true;
        }

        // Find best price
        const bestOffer = getBestPrice(product);
        const bestPrice = bestOffer ? bestOffer.price : null;

        // Render each offer
        product.offers.forEach(offer => {
            if (!offer) return;
            
            const isBestPrice = bestOffer && offer.storeId === bestOffer.storeId;
            
            const offerCard = document.createElement('article');
            offerCard.className = `offer-card ${isBestPrice ? 'best-price' : ''}`;
            
            // Store info
            const offerStore = document.createElement('div');
            offerStore.className = 'offer-store';
            
            const storeName = document.createElement('h3');
            storeName.className = 'store-name';
            storeName.textContent = offer.storeName || 'Unknown Store';
            
            const storeLogo = document.createElement('p');
            storeLogo.className = 'store-logo';
            storeLogo.textContent = offer.storeName || 'Store';
            
            offerStore.appendChild(storeName);
            offerStore.appendChild(storeLogo);
            
            // Offer details
            const offerDetails = document.createElement('div');
            offerDetails.className = 'offer-details';
            
            const offerPrice = document.createElement('p');
            offerPrice.className = 'offer-price';
            offerPrice.textContent = formatPrice(offer.price, offer.currency);
            
            const offerCurrency = document.createElement('p');
            offerCurrency.className = 'offer-currency';
            offerCurrency.textContent = offer.currency || 'USD';
            
            const offerAvailability = document.createElement('p');
            offerAvailability.className = 'offer-availability';
            offerAvailability.textContent = offer.availability || 'Unknown';
            
            const offerUpdated = document.createElement('p');
            offerUpdated.className = 'offer-updated';
            const updatedDate = offer.lastUpdated ? new Date(offer.lastUpdated).toLocaleDateString() : 'Unknown';
            offerUpdated.textContent = `Last updated: ${updatedDate}`;
            
            offerDetails.appendChild(offerPrice);
            offerDetails.appendChild(offerCurrency);
            offerDetails.appendChild(offerAvailability);
            offerDetails.appendChild(offerUpdated);
            
            // Offer action
            const offerAction = document.createElement('div');
            offerAction.className = 'offer-action';
            
            if (isBestPrice) {
                const bestPriceBadge = document.createElement('span');
                bestPriceBadge.className = 'best-price-badge';
                bestPriceBadge.textContent = 'Best Price';
                offerAction.appendChild(bestPriceBadge);
            }
            
            const offerLink = document.createElement('a');
            offerLink.href = offer.url || '#';
            offerLink.className = 'offer-link';
            offerLink.textContent = 'View Offer';
            offerLink.target = '_blank';
            offerLink.rel = 'noopener noreferrer';
            offerLink.setAttribute('aria-label', `View offer from ${offer.storeName}`);
            
            offerAction.appendChild(offerLink);
            
            // Assemble offer card
            offerCard.appendChild(offerStore);
            offerCard.appendChild(offerDetails);
            offerCard.appendChild(offerAction);
            
            offersList.appendChild(offerCard);
        });
    }

    /**
     * Set current product
     * @param {Object} product - Product object
     */
    function setCurrentProduct(product) {
        state.currentProduct = product;
    }

    /**
     * Get current product
     * @returns {Object|null} Current product
     */
    function getCurrentProduct() {
        return state.currentProduct;
    }

    /**
     * Update filtered products
     * @param {Array} products - Filtered products array
     */
    function setFilteredProducts(products) {
        state.filteredProducts = products;
    }

    /**
     * Show loading state
     * @param {Element} container - Container element
     */
    function showLoadingState(container) {
        if (!container) return;
        
        container.innerHTML = '';
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-state';
        loadingDiv.innerHTML = `
            <h2>Loading Products...</h2>
            <p>Please wait while we fetch the latest product information.</p>
        `;
        
        container.appendChild(loadingDiv);
    }

    /**
     * Hide loading state
     * @param {Element} container - Container element
     */
    function hideLoadingState(container) {
        const loadingState = Utils.selectElement('.loading-state', container);
        if (loadingState) {
            loadingState.remove();
        }
    }

    /**
     * Show no results state
     * @param {Element} container - Container element
     */
    function showNoResultsState(container) {
        if (!container) return;
        
        container.innerHTML = '';
        
        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'no-results';
        noResultsDiv.innerHTML = `
            <h2>No Products Found</h2>
            <p>Try adjusting your filters or search terms to find what you're looking for.</p>
        `;
        
        container.appendChild(noResultsDiv);
    }

    /**
     * Hide no results state
     * @param {Element} container - Container element
     */
    function hideNoResultsState(container) {
        const noResults = Utils.selectElement('.no-results', container);
        if (noResults) {
            noResults.remove();
        }
    }

    /**
     * Show error state
     * @param {Element} container - Container element
     * @param {string} message - Error message
     */
    function showErrorState(container, message = 'Failed to load products') {
        if (!container) return;
        
        container.innerHTML = '';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-state';
        errorDiv.innerHTML = `
            <h2>Error Loading Products</h2>
            <p>${message}</p>
            <p>Please try refreshing the page or contact support if the problem persists.</p>
        `;
        
        container.appendChild(errorDiv);
    }

    /**
     * Show unavailable state (for product details)
     * @param {Element} container - Container element
     */
    function showUnavailableState(container) {
        if (!container) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-state';
        errorDiv.innerHTML = `
            <h2>Product Not Found</h2>
            <p>The product you're looking for is not available or has been removed.</p>
            <a href="products.html" class="primary-button">Browse All Products</a>
        `;
        
        // Replace product details content
        const productDetails = Utils.selectElement('.product-details');
        if (productDetails) {
            productDetails.innerHTML = '';
            productDetails.appendChild(errorDiv);
        }
        
        // Hide offers section
        const offersSection = Utils.selectElement('.offers-section');
        if (offersSection) {
            offersSection.hidden = true;
        }
    }

    /**
     * Check if products are loaded
     * @returns {boolean} True if products are loaded
     */
    function isLoaded() {
        return state.products.length > 0;
    }

    /**
     * Check if currently loading
     * @returns {boolean} True if loading
     */
    function isLoading() {
        return state.isLoading;
    }

    /**
     * Get load error
     * @returns {string|null} Error message or null
     */
    function getLoadError() {
        return state.loadError;
    }

    // Public API
    return {
        loadProducts,
        getProducts,
        getFilteredProducts,
        findProductById,
        createProductCard,
        renderProducts,
        renderFeaturedProducts,
        renderProductDetails,
        setCurrentProduct,
        getCurrentProduct,
        setFilteredProducts,
        showLoadingState,
        hideLoadingState,
        showNoResultsState,
        hideNoResultsState,
        showErrorState,
        showUnavailableState,
        isLoaded,
        isLoading,
        getLoadError,
        formatPrice,
        getBestPrice
    };
})();

// Make ProductsModule available globally
if (typeof window !== 'undefined') {
    window.ProductsModule = ProductsModule;
}
