// PriceWise - Filters module
// Phase 5: Search and Filters Implementation

const FiltersModule = (function() {
    'use strict';

    // Filter state
    const state = {
        searchTerm: '',
        selectedCategory: '',
        minPrice: null,
        maxPrice: null,
        selectedStore: '',
        isFiltering: false
    };

    // Callback to trigger filtering
    let onFiltersChanged = null;

    /**
     * Load and populate category filter options
     */
    async function loadCategoryOptions() {
        try {
            const response = await fetch('data/categories.json');
            if (!response.ok) {
                console.warn('FiltersModule: Failed to load categories');
                return;
            }

            const data = await response.json();
            const categorySelect = Utils.selectElement('#category-filter');
            
            if (!categorySelect || !Array.isArray(data.categories)) {
                return;
            }

            // Clear existing options except "All Categories"
            const allCategoriesOption = categorySelect.querySelector('option[value=""]');
            categorySelect.innerHTML = '';
            
            if (allCategoriesOption) {
                categorySelect.appendChild(allCategoriesOption.cloneNode(true));
            }

            // Add category options from JSON
            data.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });

            console.log('FiltersModule: Loaded category options');
        } catch (error) {
            console.warn('FiltersModule: Error loading categories', error);
        }
    }

    /**
     * Load and populate store filter options
     */
    async function loadStoreOptions() {
        try {
            const response = await fetch('data/stores.json');
            if (!response.ok) {
                console.warn('FiltersModule: Failed to load stores');
                return;
            }

            const data = await response.json();
            const storeSelect = Utils.selectElement('#store-filter');
            
            if (!storeSelect || !Array.isArray(data.stores)) {
                return;
            }

            // Clear existing options except "All Stores"
            const allStoresOption = storeSelect.querySelector('option[value=""]');
            storeSelect.innerHTML = '';
            
            if (allStoresOption) {
                storeSelect.appendChild(allStoresOption.cloneNode(true));
            }

            // Add store options from JSON
            data.stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = store.name;
                storeSelect.appendChild(option);
            });

            console.log('FiltersModule: Loaded store options');
        } catch (error) {
            console.warn('FiltersModule: Error loading stores', error);
        }
    }

    /**
     * Initialize filter functionality
     * @param {Function} onChangedCallback - Callback when filters change
     */
    function initializeFilters(onChangedCallback) {
        console.log('FiltersModule: Initializing filters');
        
        onFiltersChanged = onChangedCallback;

        try {
            // Load dynamic data
            loadCategoryOptions();
            loadStoreOptions();

            // Get filter elements
            const searchInput = Utils.selectElement('#search-input');
            const categoryFilter = Utils.selectElement('#category-filter');
            const minPriceFilter = Utils.selectElement('#min-price-filter');
            const maxPriceFilter = Utils.selectElement('#max-price-filter');
            const storeFilter = Utils.selectElement('#store-filter');
            const resetButton = Utils.selectElement('#reset-filters');

            // Search input event listener
            if (searchInput) {
                Utils.addEventListener(searchInput, 'change', () => {
                    state.searchTerm = searchInput.value.trim();
                    if (onFiltersChanged) {
                        onFiltersChanged();
                    }
                });
            }

            // Category filter event listener
            if (categoryFilter) {
                Utils.addEventListener(categoryFilter, 'change', () => {
                    state.selectedCategory = categoryFilter.value;
                    if (onFiltersChanged) {
                        onFiltersChanged();
                    }
                });
            }

            // Minimum price filter event listener
            if (minPriceFilter) {
                Utils.addEventListener(minPriceFilter, 'change', () => {
                    const value = minPriceFilter.value.trim();
                    state.minPrice = value === '' ? null : parseFloat(value);
                    
                    // Validate and reset if invalid
                    if (state.minPrice !== null && isNaN(state.minPrice)) {
                        state.minPrice = null;
                        minPriceFilter.value = '';
                    }
                    
                    if (onFiltersChanged) {
                        onFiltersChanged();
                    }
                });
            }

            // Maximum price filter event listener
            if (maxPriceFilter) {
                Utils.addEventListener(maxPriceFilter, 'change', () => {
                    const value = maxPriceFilter.value.trim();
                    state.maxPrice = value === '' ? null : parseFloat(value);
                    
                    // Validate and reset if invalid
                    if (state.maxPrice !== null && isNaN(state.maxPrice)) {
                        state.maxPrice = null;
                        maxPriceFilter.value = '';
                    }
                    
                    if (onFiltersChanged) {
                        onFiltersChanged();
                    }
                });
            }

            // Store filter event listener
            if (storeFilter) {
                Utils.addEventListener(storeFilter, 'change', () => {
                    state.selectedStore = storeFilter.value;
                    if (onFiltersChanged) {
                        onFiltersChanged();
                    }
                });
            }

            // Reset filters button
            if (resetButton) {
                Utils.addEventListener(resetButton, 'click', (e) => {
                    e.preventDefault();
                    resetFiltersUI();
                    // Also reset sorting
                    SortingModule.resetSorting();
                    if (onFiltersChanged) {
                        onFiltersChanged();
                    }
                });
            }

            console.log('FiltersModule: Filters initialized');
        } catch (error) {
            console.warn('FiltersModule: Initialization warning:', error);
        }
    }

    /**
     * Reset filter UI controls
     */
    function resetFiltersUI() {
        const searchInput = Utils.selectElement('#search-input');
        const categoryFilter = Utils.selectElement('#category-filter');
        const minPriceFilter = Utils.selectElement('#min-price-filter');
        const maxPriceFilter = Utils.selectElement('#max-price-filter');
        const storeFilter = Utils.selectElement('#store-filter');

        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = '';
        if (minPriceFilter) minPriceFilter.value = '';
        if (maxPriceFilter) maxPriceFilter.value = '';
        if (storeFilter) storeFilter.value = '';
    }

    /**
     * Apply search filter
     * @param {string} term - Search term
     * @param {Array} products - Products to filter
     * @returns {Array} Filtered products
     */
    function applySearchFilter(term, products) {
        if (!term || typeof term !== 'string') {
            return products;
        }

        const searchTerm = term.toLowerCase().trim();
        return products.filter(product => {
            const name = (product.name || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            
            return name.includes(searchTerm) || 
                   brand.includes(searchTerm) ||
                   description.includes(searchTerm) || 
                   category.includes(searchTerm);
        });
    }

    /**
     * Apply category filter
     * @param {string} category - Category to filter by
     * @param {Array} products - Products to filter
     * @returns {Array} Filtered products
     */
    function applyCategoryFilter(category, products) {
        if (!category || typeof category !== 'string') {
            return products;
        }

        return products.filter(product => 
            product.category && product.category.toLowerCase() === category.toLowerCase()
        );
    }

    /**
     * Apply minimum price filter
     * @param {number} minPrice - Minimum price
     * @param {Array} products - Products to filter
     * @returns {Array} Filtered products
     */
    function applyMinPriceFilter(minPrice, products) {
        if (minPrice === null || typeof minPrice !== 'number') {
            return products;
        }

        return products.filter(product => {
            if (!product.offers || product.offers.length === 0) {
                return false;
            }

            // Check if product has at least one offer with price >= minPrice
            return product.offers.some(offer => 
                offer && typeof offer.price === 'number' && offer.price >= minPrice
            );
        });
    }

    /**
     * Apply maximum price filter
     * @param {number} maxPrice - Maximum price
     * @param {Array} products - Products to filter
     * @returns {Array} Filtered products
     */
    function applyMaxPriceFilter(maxPrice, products) {
        if (maxPrice === null || typeof maxPrice !== 'number') {
            return products;
        }

        return products.filter(product => {
            if (!product.offers || product.offers.length === 0) {
                return false;
            }

            // Check if product has at least one offer with price <= maxPrice
            return product.offers.some(offer => 
                offer && typeof offer.price === 'number' && offer.price <= maxPrice
            );
        });
    }

    /**
     * Apply store filter
     * @param {string} storeId - Store ID to filter by
     * @param {Array} products - Products to filter
     * @returns {Array} Filtered products
     */
    function applyStoreFilter(storeId, products) {
        if (!storeId || typeof storeId !== 'string') {
            return products;
        }

        return products.filter(product => {
            if (!product.offers || product.offers.length === 0) {
                return false;
            }

            // Check if product has offer from this store
            return product.offers.some(offer => 
                offer && offer.storeId === storeId
            );
        });
    }

    /**
     * Apply all filters
     * @param {Array} products - Products to filter
     * @returns {Array} Filtered products
     */
    function applyAllFilters(products) {
        let filtered = [...products];
        
        if (state.searchTerm) {
            filtered = applySearchFilter(state.searchTerm, filtered);
        }
        
        if (state.selectedCategory) {
            filtered = applyCategoryFilter(state.selectedCategory, filtered);
        }
        
        if (state.minPrice !== null) {
            filtered = applyMinPriceFilter(state.minPrice, filtered);
        }
        
        if (state.maxPrice !== null) {
            filtered = applyMaxPriceFilter(state.maxPrice, filtered);
        }
        
        if (state.selectedStore) {
            filtered = applyStoreFilter(state.selectedStore, filtered);
        }
        
        return filtered;
    }

    /**
     * Reset all filters
     */
    function resetFilters() {
        state.searchTerm = '';
        state.selectedCategory = '';
        state.minPrice = null;
        state.maxPrice = null;
        state.selectedStore = '';
        state.isFiltering = false;
        resetFiltersUI();
    }

    /**
     * Load filter state from URL query parameters
     */
    function loadFromQueryParams() {
        const search = Utils.getQueryParam('search');
        const category = Utils.getQueryParam('category');
        const minPrice = Utils.getQueryParam('minPrice');
        const maxPrice = Utils.getQueryParam('maxPrice');
        const store = Utils.getQueryParam('store');

        if (search) {
            state.searchTerm = search;
            const searchInput = Utils.selectElement('#search-input');
            if (searchInput) searchInput.value = search;
        }

        if (category) {
            state.selectedCategory = category;
            const categoryFilter = Utils.selectElement('#category-filter');
            if (categoryFilter) categoryFilter.value = category;
        }

        if (minPrice) {
            const priceValue = parseFloat(minPrice);
            if (!isNaN(priceValue)) {
                state.minPrice = priceValue;
                const minPriceFilter = Utils.selectElement('#min-price-filter');
                if (minPriceFilter) minPriceFilter.value = minPrice;
            }
        }

        if (maxPrice) {
            const priceValue = parseFloat(maxPrice);
            if (!isNaN(priceValue)) {
                state.maxPrice = priceValue;
                const maxPriceFilter = Utils.selectElement('#max-price-filter');
                if (maxPriceFilter) maxPriceFilter.value = maxPrice;
            }
        }

        if (store) {
            state.selectedStore = store;
            const storeFilter = Utils.selectElement('#store-filter');
            if (storeFilter) storeFilter.value = store;
        }
    }

    /**
     * Build URL query parameters from current filter state
     * @returns {string} Query string (without leading ?)
     */
    function buildQueryParams() {
        const params = [];

        if (state.searchTerm) {
            params.push(`search=${encodeURIComponent(state.searchTerm)}`);
        }

        if (state.selectedCategory) {
            params.push(`category=${encodeURIComponent(state.selectedCategory)}`);
        }

        if (state.minPrice !== null) {
            params.push(`minPrice=${encodeURIComponent(state.minPrice)}`);
        }

        if (state.maxPrice !== null) {
            params.push(`maxPrice=${encodeURIComponent(state.maxPrice)}`);
        }

        if (state.selectedStore) {
            params.push(`store=${encodeURIComponent(state.selectedStore)}`);
        }

        return params.join('&');
    }

    /**
     * Update URL with current filter state
     */
    function updateURL() {
        const queryParams = buildQueryParams();
        const newURL = queryParams 
            ? `products.html?${queryParams}` 
            : 'products.html';
        
        window.history.replaceState({}, '', newURL);
    }

    /**
     * Set search term
     * @param {string} term - Search term
     */
    function setSearchTerm(term) {
        state.searchTerm = term;
    }

    /**
     * Set selected category
     * @param {string} category - Category
     */
    function setSelectedCategory(category) {
        state.selectedCategory = category;
    }

    /**
     * Set minimum price
     * @param {number|null} minPrice - Minimum price
     */
    function setMinPrice(minPrice) {
        state.minPrice = minPrice;
    }

    /**
     * Set maximum price
     * @param {number|null} maxPrice - Maximum price
     */
    function setMaxPrice(maxPrice) {
        state.maxPrice = maxPrice;
    }

    /**
     * Set selected store
     * @param {string} store - Store
     */
    function setSelectedStore(store) {
        state.selectedStore = store;
    }

    /**
     * Get current filter state
     * @returns {Object} Filter state
     */
    function getFilterState() {
        return { ...state };
    }

    /**
     * Check if any filters are active
     * @returns {boolean} True if filters are active
     */
    function hasActiveFilters() {
        return state.searchTerm !== '' ||
               state.selectedCategory !== '' ||
               state.minPrice !== null ||
               state.maxPrice !== null ||
               state.selectedStore !== '';
    }

    // Public API
    return {
        initializeFilters,
        applySearchFilter,
        applyCategoryFilter,
        applyMinPriceFilter,
        applyMaxPriceFilter,
        applyStoreFilter,
        applyAllFilters,
        resetFilters,
        setSearchTerm,
        setSelectedCategory,
        setMinPrice,
        setMaxPrice,
        setSelectedStore,
        getFilterState,
        hasActiveFilters,
        loadFromQueryParams,
        buildQueryParams,
        updateURL,
        loadCategoryOptions,
        loadStoreOptions
    };
})();

// Make FiltersModule available globally
if (typeof window !== 'undefined') {
    window.FiltersModule = FiltersModule;
}
