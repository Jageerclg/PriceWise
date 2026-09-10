// PriceWise - Utility functions
// Phase 3: JavaScript Foundation

const Utils = (function() {
    'use strict';

    /**
     * Safely select a single DOM element
     * @param {string} selector - CSS selector
     * @param {Element} parent - Parent element to search within (optional)
     * @returns {Element|null} Selected element or null
     */
    function selectElement(selector, parent = document) {
        try {
            return parent.querySelector(selector);
        } catch (error) {
            console.warn(`Invalid selector: ${selector}`, error);
            return null;
        }
    }

    /**
     * Safely select multiple DOM elements
     * @param {string} selector - CSS selector
     * @param {Element} parent - Parent element to search within (optional)
     * @returns {NodeList} Selected elements (empty NodeList if none found)
     */
    function selectElements(selector, parent = document) {
        try {
            const elements = parent.querySelectorAll(selector);
            return elements;
        } catch (error) {
            console.warn(`Invalid selector: ${selector}`, error);
            return document.querySelectorAll(':not(*)'); // Return empty NodeList
        }
    }

    /**
     * Safely add event listener to an element
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @param {Object} options - Event listener options (optional)
     */
    function addEventListener(element, event, handler, options = {}) {
        if (!element || typeof element.addEventListener !== 'function') {
            console.warn('Cannot add event listener - invalid element');
            return;
        }
        try {
            element.addEventListener(event, handler, options);
        } catch (error) {
            console.warn(`Failed to add ${event} listener`, error);
        }
    }

    /**
     * Get current page name from URL
     * @returns {string} Page name (e.g., 'index', 'products', 'product-details')
     */
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        
        // Remove .html extension if present
        const pageName = filename.replace('.html', '');
        
        // Handle empty path (root directory)
        return pageName === '' ? 'index' : pageName;
    }

    /**
     * Get query parameter value from URL
     * @param {string} param - Parameter name
     * @returns {string|null} Parameter value or null
     */
    function getQueryParam(param) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(param);
        } catch (error) {
            console.warn('Failed to parse query parameters', error);
            return null;
        }
    }

    /**
     * Get all query parameters as object
     * @returns {Object} Query parameters object
     */
    function getAllQueryParams() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const params = {};
            for (const [key, value] of urlParams) {
                params[key] = value;
            }
            return params;
        } catch (error) {
            console.warn('Failed to parse query parameters', error);
            return {};
        }
    }

    /**
     * Format price with currency symbol
     * @param {number} price - Price value
     * @param {string} currency - Currency symbol (default: '$')
     * @returns {string} Formatted price string
     */
    function formatPrice(price, currency = '$') {
        if (typeof price !== 'number' || isNaN(price)) {
            return `${currency}0.00`;
        }
        return `${currency}${price.toFixed(2)}`;
    }

    /**
     * Parse price string to number
     * @param {string} priceString - Price string (e.g., '$99.99')
     * @returns {number|null} Parsed price or null
     */
    function parsePrice(priceString) {
        if (typeof priceString !== 'string') {
            return null;
        }
        // Remove currency symbols and convert to number
        const numericString = priceString.replace(/[^0-9.-]+/g, '');
        const parsed = parseFloat(numericString);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Safely get text content from element
     * @param {Element} element - DOM element
     * @returns {string} Text content or empty string
     */
    function getTextContent(element) {
        if (!element) {
            return '';
        }
        return element.textContent || element.innerText || '';
    }

    /**
     * Safely set text content on element
     * @param {Element} element - DOM element
     * @param {string} text - Text content
     */
    function setTextContent(element, text) {
        if (!element) {
            return;
        }
        if (typeof element.textContent !== 'undefined') {
            element.textContent = text;
        } else if (typeof element.innerText !== 'undefined') {
            element.innerText = text;
        }
    }

    /**
     * Check if element exists in DOM
     * @param {string} selector - CSS selector
     * @returns {boolean} True if element exists
     */
    function elementExists(selector) {
        return selectElement(selector) !== null;
    }

    /**
     * Debounce function execution
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        if (typeof text !== 'string') {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate unique ID
     * @returns {string} Unique identifier
     */
    function generateId() {
        return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API
    return {
        selectElement,
        selectElements,
        addEventListener,
        getCurrentPage,
        getQueryParam,
        getAllQueryParams,
        formatPrice,
        parsePrice,
        getTextContent,
        setTextContent,
        elementExists,
        debounce,
        escapeHtml,
        generateId
    };
})();

// Make Utils available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}
