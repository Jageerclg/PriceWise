// PriceWise - Main application entry point
// Phase 4: Product Catalog and Sample Data

const PriceWiseApp = (function() {
    'use strict';

    // Application state
    const state = {
        currentPage: null,
        isInitialized: false
    };

    /**
     * Initialize page-specific functionality
     */
    async function initializePage() {
        // Determine current page
        state.currentPage = Utils.getCurrentPage();
        console.log(`PriceWise initializing page: ${state.currentPage}`);

        // Initialize page-specific modules
        switch (state.currentPage) {
            case 'index':
                await initializeHomePage();
                break;
            case 'products':
                await initializeProductsPage();
                break;
            case 'product-details':
                await initializeProductDetailsPage();
                break;
            case 'comparison':
                initializeComparisonPage();
                break;
            case 'about':
                initializeAboutPage();
                break;
            case '404':
                initializeErrorPage();
                break;
            default:
                console.log('Unknown page, running generic initialization');
                initializeGenericPage();
        }

        if (typeof ProductURLModule !== 'undefined' && ProductURLModule.initializeSearchForms) {
            ProductURLModule.initializeSearchForms();
        }

        state.isInitialized = true;
        console.log('PriceWise initialization complete');
    }

    /**
     * Initialize home page functionality
     */
    async function initializeHomePage() {
        console.log('Initializing home page');
        
        try {
            // Load products and render featured products
            const featuredContainer = Utils.selectElement('#featured-products');
            
            if (featuredContainer) {
                // Show loading state
                ProductsModule.showLoadingState(featuredContainer);
                
                try {
                    await ProductsModule.loadProducts();
                    ProductsModule.renderFeaturedProducts(featuredContainer, 3);
                } catch (error) {
                    console.error('Failed to load featured products:', error);
                    ProductsModule.showErrorState(featuredContainer, 'Failed to load featured products');
                }
            }
        } catch (error) {
            console.warn('Home page initialization warning:', error);
        }
    }

    /**
     * Initialize products page functionality with filtering and sorting
     */
    async function initializeProductsPage() {
        console.log('Initializing products page with filters and sorting');
        
        try {
            const productResults = Utils.selectElement('#product-results');
            const noResults = Utils.selectElement('#no-results');
            
            if (productResults) {
                // Show loading state
                ProductsModule.showLoadingState(productResults);
                
                try {
                    // Load products
                    await ProductsModule.loadProducts();
                    
                    // Load filter state from URL parameters
                    FiltersModule.loadFromQueryParams();
                    
                    // Load sort state from URL parameters
                    SortingModule.loadFromQueryParams();
                    
                    // Initialize filters with callback for when filters change
                    FiltersModule.initializeFilters(() => {
                        applyFiltersAndRender(productResults, noResults);
                        updateURL();
                    });
                    
                    // Initialize sorting with callback for when sort changes
                    SortingModule.initializeSorting(() => {
                        applyFiltersAndRender(productResults, noResults);
                        updateURL();
                    });
                    
                    // Apply initial filters and render
                    applyFiltersAndRender(productResults, noResults);
                    
                } catch (error) {
                    console.error('Failed to load products:', error);
                    ProductsModule.showErrorState(productResults, 'Failed to load products');
                }
            }
        } catch (error) {
            console.warn('Products page initialization warning:', error);
        }
    }

    /**
     * Apply all filters, apply sorting, and render products
     */
    function applyFiltersAndRender(productResults, noResults) {
        if (!productResults) return;

        try {
            const allProducts = ProductsModule.getProducts();
            
            // Step 1: Apply filters
            const filteredProducts = FiltersModule.applyAllFilters(allProducts);
            
            // Step 2: Apply sorting to filtered results
            const sortedProducts = SortingModule.applySorting(filteredProducts);
            
            // Step 3: Update results count (based on filtered, before sorting)
            updateResultsCount(filteredProducts.length, allProducts.length);
            
            // Step 4: Render or show no results
            if (sortedProducts.length === 0) {
                // Show no results
                if (noResults) {
                    noResults.hidden = false;
                }
                productResults.innerHTML = '';
            } else {
                // Hide no results
                if (noResults) {
                    noResults.hidden = true;
                }
                
                // Render sorted products
                ProductsModule.renderProducts(sortedProducts, productResults);
            }
        } catch (error) {
            console.error('Error applying filters and sorting:', error);
            ProductsModule.showErrorState(productResults, 'Error applying filters and sorting');
        }
    }

    /**
     * Update results count display
     */
    function updateResultsCount(filtered, total) {
        const resultCountElement = Utils.selectElement('#results-count');
        if (resultCountElement) {
            if (filtered === total) {
                resultCountElement.textContent = `Showing all ${total} products`;
            } else {
                resultCountElement.textContent = `Showing ${filtered} of ${total} products`;
            }
        }
    }

    /**
     * Update URL with current filter and sort state
     */
    function updateURL() {
        try {
            // Build filter parameters
            const filterParams = [];
            
            // Add search parameter
            const searchInput = Utils.selectElement('#search-input');
            if (searchInput && searchInput.value.trim()) {
                filterParams.push(`search=${encodeURIComponent(searchInput.value.trim())}`);
            }
            
            // Add category parameter
            const categoryFilter = Utils.selectElement('#category-filter');
            if (categoryFilter && categoryFilter.value) {
                filterParams.push(`category=${encodeURIComponent(categoryFilter.value)}`);
            }
            
            // Add min price parameter
            const minPriceFilter = Utils.selectElement('#min-price-filter');
            if (minPriceFilter && minPriceFilter.value.trim()) {
                filterParams.push(`minPrice=${encodeURIComponent(minPriceFilter.value.trim())}`);
            }
            
            // Add max price parameter
            const maxPriceFilter = Utils.selectElement('#max-price-filter');
            if (maxPriceFilter && maxPriceFilter.value.trim()) {
                filterParams.push(`maxPrice=${encodeURIComponent(maxPriceFilter.value.trim())}`);
            }
            
            // Add store parameter
            const storeFilter = Utils.selectElement('#store-filter');
            if (storeFilter && storeFilter.value) {
                filterParams.push(`store=${encodeURIComponent(storeFilter.value)}`);
            }
            
            // Add sort parameter
            const sortSelect = Utils.selectElement('#sort-select');
            if (sortSelect && sortSelect.value) {
                filterParams.push(`sort=${encodeURIComponent(sortSelect.value)}`);
            }
            
            // Build and update URL
            const queryString = filterParams.length > 0 ? `?${filterParams.join('&')}` : '';
            const newURL = `products.html${queryString}`;
            
            window.history.replaceState({}, '', newURL);
        } catch (error) {
            console.warn('Error updating URL:', error);
        }
    }

    /**
     * Initialize product details page functionality
     */
    async function initializeProductDetailsPage() {
        console.log('Initializing product details page');
        
        try {
            const productId = Utils.getQueryParam('id');
            const externalId = Utils.getQueryParam('external');
            const importedProduct = externalId && typeof ProductDataService !== 'undefined' && ProductDataService.getStoredImportedProduct
                ? ProductDataService.getStoredImportedProduct()
                : null;

            if (externalId && importedProduct && importedProduct.id === externalId) {
                const container = Utils.selectElement('.product-details-section');
                ProductsModule.setCurrentProduct(importedProduct);
                ProductsModule.renderProductDetails(importedProduct, container);

                const compareButton = Utils.selectElement('.compare-button');
                if (compareButton) {
                    compareButton.href = `comparison.html?id=${encodeURIComponent(importedProduct.id)}`;
                    compareButton.setAttribute('aria-label', `Compare prices for ${importedProduct.name}`);
                }
                return;
            }
            
            if (!productId) {
                console.warn('No product ID provided in URL');
                const container = Utils.selectElement('.product-details-section');
                if (container) {
                    ProductsModule.showUnavailableState(container);
                }
                return;
            }

            try {
                await ProductsModule.loadProducts();
                const product = ProductsModule.findProductById(productId);
                
                if (product) {
                    ProductsModule.setCurrentProduct(product);
                    const container = Utils.selectElement('.product-details-section');
                    ProductsModule.renderProductDetails(product, container);

                    const compareButton = Utils.selectElement('.compare-button');
                    if (compareButton) {
                        compareButton.href = `comparison.html?id=${encodeURIComponent(product.id)}`;
                        compareButton.setAttribute('aria-label', `Compare prices for ${product.name}`);
                    }
                } else {
                    console.warn(`Product not found: ${productId}`);
                    const container = Utils.selectElement('.product-details-section');
                    if (container) {
                        ProductsModule.showUnavailableState(container);
                    }
                }
            } catch (error) {
                console.error('Failed to load product details:', error);
                const container = Utils.selectElement('.product-details-section');
                if (container) {
                    ProductsModule.showErrorState(container, 'Failed to load product details');
                }
            }
        } catch (error) {
            console.warn('Product details page initialization warning:', error);
        }
    }

    /**
     * Initialize comparison page functionality
     */
    function initializeComparisonPage() {
        console.log('Initializing comparison page');

        try {
            const productId = Utils.getQueryParam('id');
            const importedProduct = productId && typeof ProductDataService !== 'undefined' && ProductDataService.getStoredImportedProduct
                ? ProductDataService.getStoredImportedProduct()
                : null;

            if (productId && importedProduct && importedProduct.id === productId) {
                const comparisonTable = Utils.selectElement('#comparison-table');
                const banner = Utils.selectElement('#best-price-banner');
                const selectedProduct = Utils.selectElement('#selected-product');
                const noComparison = Utils.selectElement('#no-comparison');

                if (selectedProduct) {
                    const productImage = Utils.selectElement('#comparison-product-image');
                    const productName = Utils.selectElement('#comparison-product-name');
                    const productCategory = Utils.selectElement('#comparison-product-category');
                    const viewDetailsLink = Utils.selectElement('.view-details-link');

                    if (productImage) {
                        const importedImage = importedProduct && importedProduct.image ? importedProduct.image : 'images/placeholders/product-placeholder.svg';
                        productImage.src = importedImage;
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
                        Utils.setTextContent(productName, importedProduct.name || 'Imported Product');
                    }
                    if (productCategory) {
                        Utils.setTextContent(productCategory, importedProduct.category || 'General');
                    }
                    if (viewDetailsLink) {
                        viewDetailsLink.href = `product-details.html?external=${encodeURIComponent(importedProduct.id)}`;
                    }
                }

                if (banner) {
                    const bestOffer = importedProduct.offers && importedProduct.offers.length ? importedProduct.offers[0] : null;
                    const priceEl = Utils.selectElement('#best-price-value');
                    const storeEl = Utils.selectElement('#best-price-store');
                    if (bestOffer) {
                        banner.hidden = false;
                        if (priceEl) priceEl.textContent = ProductsModule && ProductsModule.formatPrice ? ProductsModule.formatPrice(Number(bestOffer.price), bestOffer.currency || 'INR') : `₹${Number(bestOffer.price).toLocaleString('en-IN')}`;
                        if (storeEl) storeEl.textContent = `at ${bestOffer.storeName || 'Store'}`;
                    }
                }

                if (comparisonTable) {
                    const tbody = comparisonTable.querySelector('tbody');
                    if (tbody && Array.isArray(importedProduct.offers)) {
                        tbody.innerHTML = '';
                        importedProduct.offers.forEach((offer) => {
                            const row = document.createElement('tr');
                            row.className = 'offer-row';
                            if (offer && offer.price === importedProduct.offers[0].price) {
                                row.className += ' best-price-row';
                            }
                            row.innerHTML = `
                                <td class="store-cell">
                                    <div class="store-info">
                                        <span class="store-name">${Utils.escapeHtml(offer.storeName || 'Store')}</span>
                                        ${offer && offer.price === importedProduct.offers[0].price ? '<span class="best-price-indicator">Best Price</span>' : ''}
                                    </div>
                                </td>
                                <td class="price-cell">${ProductsModule && ProductsModule.formatPrice ? ProductsModule.formatPrice(Number(offer.price), offer.currency || 'INR') : `₹${Number(offer.price).toLocaleString('en-IN')}`}</td>
                                <td class="currency-cell">${Utils.escapeHtml(offer.currency || 'INR')}</td>
                                <td class="availability-cell">${Utils.escapeHtml(offer.availability || 'Unavailable')}</td>
                                <td class="updated-cell">${new Date(offer.lastUpdated || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                                <td class="action-cell"><a href="${Utils.escapeHtml(offer.url || '#')}" class="offer-link" target="_blank" rel="noopener noreferrer">View Offer</a></td>
                            `;
                            tbody.appendChild(row);
                        });
                    }
                }

                if (noComparison) {
                    noComparison.hidden = true;
                }
                return;
            }

            if (typeof ComparisonModule !== 'undefined' && ComparisonModule.initializeComparison) {
                ComparisonModule.initializeComparison();
            } else {
                console.warn('ComparisonModule is not available');
            }
        } catch (error) {
            console.warn('Comparison page initialization warning:', error);
        }
    }

    /**
     * Initialize about page functionality
     */
    function initializeAboutPage() {
        console.log('Initializing about page');
        
        // About page is mostly static content
        try {
            const aboutSection = Utils.selectElement('.about-section');
            if (aboutSection) {
                console.log('About page elements detected');
            }
        } catch (error) {
            console.warn('About page initialization warning:', error);
        }
    }

    /**
     * Initialize error page functionality
     */
    function initializeErrorPage() {
        console.log('Initializing error page');
        
        // 404 page is mostly static content
        try {
            const errorSection = Utils.selectElement('.error-section');
            if (errorSection) {
                console.log('Error page elements detected');
            }
        } catch (error) {
            console.warn('Error page initialization warning:', error);
        }
    }

    /**
     * Initialize generic page functionality
     */
    function initializeGenericPage() {
        console.log('Initializing generic page');
        
        // Generic initialization for unknown pages
        try {
            const header = Utils.selectElement('.site-header');
            const footer = Utils.selectElement('.site-footer');
            
            if (header || footer) {
                console.log('Generic page elements detected');
            }
        } catch (error) {
            console.warn('Generic page initialization warning:', error);
        }
    }

    /**
     * Start the application
     */
    function start() {
        if (state.isInitialized) {
            console.warn('PriceWise already initialized');
            return;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializePage);
        } else {
            // DOM already loaded
            initializePage();
        }
    }

    // Public API
    return {
        start,
        getCurrentPage: () => state.currentPage,
        isInitialized: () => state.isInitialized
    };
})();

// Auto-start the application when script loads
PriceWiseApp.start();

// Make app available globally for debugging
if (typeof window !== 'undefined') {
    window.PriceWiseApp = PriceWiseApp;
}
