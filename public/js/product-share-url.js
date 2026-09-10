// PriceWise local product-link helpers. These links only address catalog entries.
const ProductShareURL = (function() {
    'use strict';
    const DEMO_HOSTS = new Set(['pricewise.local', 'www.pricewise.local']);
    function getProductSlug(product) { return product && typeof product.slug === 'string' ? product.slug.trim().toLowerCase() : ''; }
    function build(product) { const slug = getProductSlug(product); return slug ? `https://pricewise.local/product/${encodeURIComponent(slug)}` : ''; }
    function parse(value, products) {
        if (typeof value !== 'string' || !value.trim()) return { matched: false };
        let url;
        try { url = new URL(value.trim()); } catch (_) { return { matched: false }; }
        if (!['http:', 'https:'].includes(url.protocol) || !DEMO_HOSTS.has(url.hostname.toLowerCase())) return { matched: false };
        const parts = url.pathname.split('/').filter(Boolean);
        const slug = parts.length === 2 && parts[0] === 'product' ? decodeURIComponent(parts[1]).toLowerCase() : '';
        if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { matched: true, valid: false, error: 'This PriceWise product link is malformed.' };
        const product = Array.isArray(products) ? products.find(item => getProductSlug(item) === slug) : null;
        return product ? { matched: true, valid: true, product, slug } : { matched: true, valid: false, error: 'This PriceWise product link does not match a local product.' };
    }
    async function copy(product) {
        const link = build(product);
        if (!link) throw new Error('A product link could not be generated.');
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard access is unavailable.');
        await navigator.clipboard.writeText(link);
        return link;
    }
    return { build, parse, copy };
})();
if (typeof window !== 'undefined') window.ProductShareURL = ProductShareURL;
