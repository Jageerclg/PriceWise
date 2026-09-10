// PriceWise - Sorting module
// Phase 6: Sorting Implementation

const SortingModule = (function() {
    'use strict';

    // Sorting state
    const state = {
        sortOption: '', // '', 'price_asc', 'price_desc', 'name_asc', 'name_desc'
        isSorting: false
    };

    // Callback to trigger re-rendering when sort changes
    let onSortChanged = null;

    /**
     * Get the lowest valid price from a product's offers
     * @param {Object} product - Product object
     * @returns {number|null} Lowest price or null if no valid price found
     */
    function getProductLowestPrice(product) {
        if (!product || !product.offers || !Array.isArray(product.offers)) {
            return null;
        }

        let lowestPrice = null;

        for (const offer of product.offers) {
            // Validate offer structure
            if (!offer || typeof offer !== 'object') {
                continue;
            }

            const price = offer.price;

            // Validate price is numeric
            if (typeof price !== 'number' || isNaN(price) || price < 0) {
                continue;
            }

            // Update lowest price if this is lower
            if (lowestPrice === null || price < lowestPrice) {
                lowestPrice = price;
            }
        }

        return lowestPrice;
    }

    /**
     * Sort products by price ascending (low to high)
     * @param {Array} products - Products to sort
     * @returns {Array} Sorted products
     */
    function sortByPriceAsc(products) {
        // Create a copy to avoid mutating original array
        const sorted = [...products];

        sorted.sort((a, b) => {
            const priceA = getProductLowestPrice(a);
            const priceB = getProductLowestPrice(b);

            // Handle products with no valid price - put them at the end
            if (priceA === null && priceB === null) return 0;
            if (priceA === null) return 1;
            if (priceB === null) return -1;

            // Compare numeric prices
            return priceA - priceB;
        });

        return sorted;
    }

    /**
     * Sort products by price descending (high to low)
     * @param {Array} products - Products to sort
     * @returns {Array} Sorted products
     */
    function sortByPriceDesc(products) {
        // Create a copy to avoid mutating original array
        const sorted = [...products];

        sorted.sort((a, b) => {
            const priceA = getProductLowestPrice(a);
            const priceB = getProductLowestPrice(b);

            // Handle products with no valid price - put them at the end
            if (priceA === null && priceB === null) return 0;
            if (priceA === null) return 1;
            if (priceB === null) return -1;

            // Compare numeric prices (descending)
            return priceB - priceA;
        });

        return sorted;
    }

    /**
     * Sort products by name ascending (A to Z)
     * @param {Array} products - Products to sort
     * @returns {Array} Sorted products
     */
    function sortByNameAsc(products) {
        // Create a copy to avoid mutating original array
        const sorted = [...products];

        sorted.sort((a, b) => {
            const nameA = (a.name || '').trim();
            const nameB = (b.name || '').trim();

            // Use localeCompare for case-insensitive, language-aware comparison
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });

        return sorted;
    }

    /**
     * Sort products by name descending (Z to A)
     * @param {Array} products - Products to sort
     * @returns {Array} Sorted products
     */
    function sortByNameDesc(products) {
        // Create a copy to avoid mutating original array
        const sorted = [...products];

        sorted.sort((a, b) => {
            const nameA = (a.name || '').trim();
            const nameB = (b.name || '').trim();

            // Use localeCompare for case-insensitive, language-aware comparison (reverse)
            return nameB.localeCompare(nameA, undefined, { sensitivity: 'base' });
        });

        return sorted;
    }

    /**
     * Apply sorting based on current sort option
     * @param {Array} products - Products to sort
     * @returns {Array} Sorted products
     */
    function applySorting(products) {
        // If no sort option or empty option, return original order
        if (!state.sortOption || state.sortOption === '') {
            return [...products];
        }

        switch (state.sortOption) {
            case 'price_asc':
                return sortByPriceAsc(products);
            case 'price_desc':
                return sortByPriceDesc(products);
            case 'name_asc':
                return sortByNameAsc(products);
            case 'name_desc':
                return sortByNameDesc(products);
            default:
                return [...products];
        }
    }

    /**
     * Initialize sorting functionality with callback
     * @param {Function} onChangedCallback - Callback when sort changes
     */
    function initializeSorting(onChangedCallback) {
        console.log('SortingModule: Initializing sorting');

        onSortChanged = onChangedCallback;

        try {
            const sortSelect = Utils.selectElement('#sort-select');

            if (sortSelect) {
                // Attach change event listener
                Utils.addEventListener(sortSelect, 'change', () => {
                    setSortOption(sortSelect.value);
                    if (onSortChanged) {
                        onSortChanged();
                    }
                });

                console.log('SortingModule: Sort event listener attached');
            } else {
                console.warn('SortingModule: Sort select element not found');
            }
        } catch (error) {
            console.warn('SortingModule: Initialization warning:', error);
        }
    }

    /**
     * Set sort option
     * @param {string} option - Sort option
     */
    function setSortOption(option) {
        const validOptions = ['', 'price_asc', 'price_desc', 'name_asc', 'name_desc'];
        if (validOptions.includes(option)) {
            state.sortOption = option;
            state.isSorting = option !== '';
        } else {
            console.warn(`Invalid sort option: ${option}`);
        }
    }

    /**
     * Get current sort option
     * @returns {string} Current sort option
     */
    function getSortOption() {
        return state.sortOption;
    }

    /**
     * Load sort option from URL query parameters
     */
    function loadFromQueryParams() {
        const sort = Utils.getQueryParam('sort');
        if (sort) {
            setSortOption(sort);
            const sortSelect = Utils.selectElement('#sort-select');
            if (sortSelect) {
                sortSelect.value = sort;
            }
        }
    }

    /**
     * Build query parameter string including sort
     * @param {Object} currentParams - Existing query parameters
     * @returns {string} Updated query string
     */
    function buildQueryParam(currentParams = {}) {
        if (state.sortOption && state.sortOption !== '') {
            return { ...currentParams, sort: state.sortOption };
        }
        return currentParams;
    }

    /**
     * Reset sorting to default
     */
    function resetSorting() {
        state.sortOption = '';
        state.isSorting = false;

        // Reset UI control
        const sortSelect = Utils.selectElement('#sort-select');
        if (sortSelect) {
            sortSelect.value = '';
        }

        console.log('SortingModule: Sorting reset to default');
    }

    /**
     * Get sort label for display
     * @param {string} option - Sort option
     * @returns {string} Human-readable sort label
     */
    function getSortLabel(option) {
        const labels = {
            '': 'Default',
            'price_asc': 'Price: Low to High',
            'price_desc': 'Price: High to Low',
            'name_asc': 'Name: A to Z',
            'name_desc': 'Name: Z to A'
        };
        return labels[option] || 'Default';
    }

    /**
     * Check if sorting is active
     * @returns {boolean} True if sorting is active
     */
    function isSortingActive() {
        return state.sortOption !== '';
    }

    // Public API
    return {
        initializeSorting,
        applySorting,
        setSortOption,
        getSortOption,
        loadFromQueryParams,
        buildQueryParam,
        resetSorting,
        getSortLabel,
        isSortingActive,
        sortByPriceAsc,
        sortByPriceDesc,
        sortByNameAsc,
        sortByNameDesc,
        getProductLowestPrice
    };
})();

// Make SortingModule available globally
if (typeof window !== 'undefined') {
    window.SortingModule = SortingModule;
}
