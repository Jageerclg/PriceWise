// PriceWise - Price intelligence UI (discount, history, store comparison).
// Vanilla JS only. Renders REAL data from the backend history/compare APIs
// plus the live product itself. Never fabricates prices or history.

const PriceIntelligence = (function() {
    'use strict';

    const SUPPORTED_STORES = ['amazon', 'flipkart'];

    function isTrackable(product) {
        return !!(
            product &&
            product.sourceType === 'live' &&
            SUPPORTED_STORES.includes(product.source) &&
            typeof product.externalId === 'string' &&
            product.externalId
        );
    }

    function formatMoney(value, currency) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '';
        }
        if (typeof ProductsModule !== 'undefined' && ProductsModule.formatPrice) {
            return ProductsModule.formatPrice(numeric, currency || 'INR');
        }
        return `₹${numeric.toLocaleString('en-IN')}`;
    }

    function formatPercent(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '';
        }
        return `${numeric.toFixed(2)}%`;
    }

    function formatDate(value) {
        if (!value) {
            return '';
        }
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        return date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
    }

    function setText(id, text) {
        const el = Utils.selectElement(`#${id}`);
        if (el) {
            Utils.setTextContent(el, text);
        }
        return el;
    }

    function showSection(id, visible) {
        const el = Utils.selectElement(`#${id}`);
        if (el) {
            el.hidden = !visible;
        }
    }

    function hideAll() {
        ['discount-section', 'discount-compare-section', 'history-section', 'store-compare-section']
            .forEach((id) => showSection(id, false));
    }

    function getBestOffer(product) {
        if (!product || !Array.isArray(product.offers)) {
            return null;
        }
        let best = null;
        for (const offer of product.offers) {
            const price = offer ? Number(offer.price) : NaN;
            if (!Number.isFinite(price) || price <= 0) {
                continue;
            }
            if (!best || price < Number(best.price)) {
                best = offer;
            }
        }
        return best;
    }

    function currentDiscount(product) {
        const best = getBestOffer(product);
        const price = best ? Number(best.price) : NaN;
        const mrp = Number(product && product.mrp);
        if (!Number.isFinite(price) || !Number.isFinite(mrp) || mrp <= 0 || mrp <= price) {
            return { price: Number.isFinite(price) ? price : null, mrp: null, amount: null, percent: null, offer: best };
        }
        return {
            price,
            mrp,
            amount: mrp - price,
            percent: ((mrp - price) / mrp) * 100,
            offer: best
        };
    }

    function renderDiscountBox(product) {
        const box = Utils.selectElement('#discount-body');
        if (!box) {
            return;
        }
        box.innerHTML = '';
        const info = currentDiscount(product);
        const currency = (info.offer && info.offer.currency) || product.currency || 'INR';

        const rows = [];
        if (info.mrp !== null) {
            rows.push(['MRP', formatMoney(info.mrp, currency)]);
        } else {
            rows.push(['MRP', 'MRP unavailable']);
        }
        rows.push(['Current Price', info.price !== null ? formatMoney(info.price, currency) : 'Unavailable']);
        if (info.amount !== null) {
            rows.push(['You Save', formatMoney(info.amount, currency)]);
            rows.push(['Discount', `${formatPercent(info.percent)} OFF`]);
        }
        if (info.offer && info.offer.storeName) {
            rows.push(['Store', info.offer.storeName]);
        }
        if (info.offer && info.offer.availability) {
            rows.push(['Availability', info.offer.availability]);
        }
        rows.push(['Last updated', formatDate(product.fetchedAt) || 'recently']);

        rows.forEach(([label, value]) => {
            const row = document.createElement('div');
            row.className = 'intel-row';
            const labelEl = document.createElement('span');
            labelEl.className = 'intel-label';
            labelEl.textContent = label;
            const valueEl = document.createElement('span');
            valueEl.className = 'intel-value';
            valueEl.textContent = value;
            row.appendChild(labelEl);
            row.appendChild(valueEl);
            box.appendChild(row);
        });
        showSection('discount-section', true);
    }

    function renderDiscountCompare(history) {
        const body = Utils.selectElement('#discount-compare-body');
        if (!body) {
            return;
        }
        body.innerHTML = '';
        if (!history || !history.dataAvailable || !history.current || history.dataPointCount < 2) {
            const empty = document.createElement('p');
            empty.className = 'intel-empty';
            empty.textContent = 'Not enough historical data to compare.';
            body.appendChild(empty);
            showSection('discount-compare-section', true);
            return;
        }
        const points = history.dataPoints;
        const previous = points.length >= 2 ? points[points.length - 2] : null;
        const current = {
            price: history.current.price,
            mrp: history.current.mrp,
            capturedAt: history.current.capturedAt
        };
        if (!previous) {
            const empty = document.createElement('p');
            empty.className = 'intel-empty';
            empty.textContent = 'Not enough historical data to compare.';
            body.appendChild(empty);
            showSection('discount-compare-section', true);
            return;
        }

        const calc = (reading) => {
            if (reading.price == null || reading.mrp == null || reading.mrp <= reading.price) {
                return null;
            }
            return ((reading.mrp - reading.price) / reading.mrp) * 100;
        };
        const currentPct = calc(current);
        const previousPct = calc({ price: previous.price, mrp: previous.mrp });

        const lines = [];
        lines.push(`Current: ${formatMoney(current.price)}${currentPct !== null ? ` · ${formatPercent(currentPct)} OFF` : ''} (${formatDate(current.capturedAt)})`);
        lines.push(`Previous: ${formatMoney(previous.price)}${previousPct !== null ? ` · ${formatPercent(previousPct)} OFF` : ''} (${formatDate(previous.capturedAt)})`);
        const diff = current.price - previous.price;
        if (diff < 0) {
            lines.push(`Price decreased by ${formatMoney(-diff)}.`);
        } else if (diff > 0) {
            lines.push(`Price increased by ${formatMoney(diff)}.`);
        } else {
            lines.push('Price is unchanged since the previous check.');
        }
        if (currentPct !== null && previousPct !== null) {
            const delta = currentPct - previousPct;
            const direction = delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'unchanged';
            lines.push(`Current discount is ${Math.abs(delta).toFixed(2)} percentage points ${direction}.`);
        }
        lines.forEach((line) => {
            const p = document.createElement('p');
            p.className = 'intel-line';
            p.textContent = line;
            body.appendChild(p);
        });
        showSection('discount-compare-section', true);
    }

    function renderHistoryStats(history) {
        const stats = Utils.selectElement('#history-stats');
        if (!stats) {
            return;
        }
        stats.innerHTML = '';
        if (!history || !history.dataAvailable) {
            return;
        }
        const items = [
            ['Current', formatMoney(history.current.price)],
            ['Lowest', `${formatMoney(history.lowestPrice)} (${formatDate(history.lowestPriceDate)})`],
            ['Highest', `${formatMoney(history.highestPrice)} (${formatDate(history.highestPriceDate)})`],
            ['Average', formatMoney(Math.round(history.averagePrice))],
            ['Data points', String(history.dataPointCount)]
        ];
        items.forEach(([label, value]) => {
            const row = document.createElement('div');
            row.className = 'intel-row';
            const labelEl = document.createElement('span');
            labelEl.className = 'intel-label';
            labelEl.textContent = label;
            const valueEl = document.createElement('span');
            valueEl.className = 'intel-value';
            valueEl.textContent = value;
            row.appendChild(labelEl);
            row.appendChild(valueEl);
            stats.appendChild(row);
        });
    }

    function renderChart(history) {
        const container = Utils.selectElement('#price-chart');
        if (!container) {
            return;
        }
        container.innerHTML = '';
        if (!history || !history.dataAvailable || history.dataPoints.length < 1) {
            return;
        }
        const points = history.dataPoints;
        const width = 560;
        const height = 220;
        const padding = 36;
        const prices = points.map((p) => p.price);
        let min = Math.min(...prices);
        let max = Math.max(...prices);
        if (min === max) {
            min = Math.max(0, min - 1);
            max = max + 1;
        }
        const x = (i) => points.length === 1
            ? padding + (width - padding * 2) / 2
            : padding + (i * (width - padding * 2)) / (points.length - 1);
        const y = (price) => height - padding - ((price - min) / (max - min)) * (height - padding * 2);

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Price history line chart');
        svg.classList.add('intel-chart');

        const axisColor = '#adb5bd';
        const baseLine = document.createElementNS(svgNS, 'line');
        baseLine.setAttribute('x1', padding);
        baseLine.setAttribute('y1', height - padding);
        baseLine.setAttribute('x2', width - padding);
        baseLine.setAttribute('y2', height - padding);
        baseLine.setAttribute('stroke', axisColor);
        svg.appendChild(baseLine);

        const polyline = document.createElementNS(svgNS, 'polyline');
        polyline.setAttribute('points', points.map((p, i) => `${x(i)},${y(p.price)}`).join(' '));
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', '#0d6efd');
        polyline.setAttribute('stroke-width', '2');
        svg.appendChild(polyline);

        const minIndex = prices.indexOf(Math.min(...prices));
        const maxIndex = prices.indexOf(Math.max(...prices));
        points.forEach((p, i) => {
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', x(i));
            circle.setAttribute('cy', y(p.price));
            circle.setAttribute('r', i === minIndex || i === maxIndex ? '5' : '3');
            circle.setAttribute('fill', i === minIndex ? '#198754' : i === maxIndex ? '#dc3545' : '#0d6efd');
            const title = document.createElementNS(svgNS, 'title');
            title.textContent = `${formatMoney(p.price)} on ${formatDate(p.capturedAt)}`;
            circle.appendChild(title);
            svg.appendChild(circle);
        });

        const label = (text, lx, ly, anchor) => {
            const node = document.createElementNS(svgNS, 'text');
            node.setAttribute('x', lx);
            node.setAttribute('y', ly);
            node.setAttribute('text-anchor', anchor || 'middle');
            node.setAttribute('font-size', '11');
            node.setAttribute('fill', '#6c757d');
            node.textContent = text;
            svg.appendChild(node);
        };
        label(formatMoney(max), 4, y(max) + 4, 'start');
        label(formatMoney(min), 4, y(min) + 4, 'start');
        if (points.length > 0) {
            label(formatDate(points[0].capturedAt), padding, height - padding + 16, 'start');
            label(formatDate(points[points.length - 1].capturedAt), width - padding, height - padding + 16, 'end');
        }
        container.appendChild(svg);
    }

    function renderHistory(history) {
        const empty = Utils.selectElement('#history-empty');
        if (!history || !history.dataAvailable) {
            showSection('history-section', true);
            renderHistoryStats(null);
            const container = Utils.selectElement('#price-chart');
            if (container) {
                container.innerHTML = '';
            }
            if (empty) {
                empty.hidden = false;
                Utils.setTextContent(empty, 'Price history is being collected. Check back as more data becomes available.');
            }
            return;
        }
        if (empty) {
            empty.hidden = true;
        }
        renderHistoryStats(history);
        renderChart(history);
        showSection('history-section', true);
    }

    function renderStoreComparison(comparison) {
        const body = Utils.selectElement('#store-compare-body');
        if (!body) {
            return;
        }
        body.innerHTML = '';
        if (!comparison || !comparison.entries || comparison.entries.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'intel-empty';
            empty.textContent = (comparison && comparison.message) || 'Not enough historical data to compare.';
            body.appendChild(empty);
            showSection('store-compare-section', true);
            return;
        }
        comparison.entries.forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'intel-store-row' + (comparison.best && entry.store === comparison.best.store && entry.price === comparison.best.price ? ' intel-best' : '');
            const name = document.createElement('div');
            name.className = 'intel-store-name';
            name.textContent = entry.store === 'amazon' ? 'Amazon India' : entry.store === 'flipkart' ? 'Flipkart' : entry.store;
            const price = document.createElement('div');
            price.className = 'intel-store-price';
            price.textContent = formatMoney(entry.price);
            row.appendChild(name);
            row.appendChild(price);
            const meta = [];
            if (entry.mrp && entry.mrp > entry.price) {
                meta.push(`MRP ${formatMoney(entry.mrp)}`);
            }
            if (entry.discountPercent !== null && entry.discountPercent !== undefined && Number.isFinite(Number(entry.discountPercent))) {
                meta.push(`${Number(entry.discountPercent).toFixed(2)}% OFF`);
            }
            if (entry.availability) {
                meta.push(entry.availability);
            }
            if (entry.capturedAt) {
                meta.push(`checked ${formatDate(entry.capturedAt)}`);
            }
            const metaEl = document.createElement('div');
            metaEl.className = 'intel-store-meta';
            metaEl.textContent = meta.join(' · ');
            row.appendChild(metaEl);
            if (entry.url) {
                const link = document.createElement('a');
                link.className = 'offer-link';
                link.href = entry.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = 'View Offer';
                row.appendChild(link);
            }
            body.appendChild(row);
        });
        if (comparison.best && comparison.matched) {
            const best = document.createElement('p');
            best.className = 'intel-best-line';
            const storeName = comparison.best.store === 'amazon' ? 'Amazon India' : comparison.best.store === 'flipkart' ? 'Flipkart' : comparison.best.store;
            best.textContent = `Best price: ${storeName} at ${formatMoney(comparison.best.price)}` +
                (comparison.priceDifference > 0 ? ` (saves ${formatMoney(comparison.priceDifference)})` : '');
            body.appendChild(best);
        } else if (comparison.message) {
            const note = document.createElement('p');
            note.className = 'intel-empty';
            note.textContent = comparison.message;
            body.appendChild(note);
        }
        showSection('store-compare-section', true);
    }

    async function fetchJson(url) {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        let payload = null;
        try {
            payload = await response.json();
        } catch (error) {
            payload = null;
        }
        return { ok: response.ok, payload };
    }

    async function loadSections(product) {
        const identity = `${product.source}/${product.externalId}`;
        try {
            const historyRes = await fetchJson(
                `/api/products/history/${encodeURIComponent(product.source)}/${encodeURIComponent(product.externalId)}?days=30`
            );
            const history = historyRes.ok && historyRes.payload && historyRes.payload.success
                ? historyRes.payload.history
                : null;
            renderDiscountCompare(history);
            renderHistory(history);
        } catch (error) {
            console.warn(`PriceIntelligence: history load failed for ${identity}`, error);
            renderDiscountCompare(null);
            renderHistory(null);
        }
        try {
            const compareRes = await fetchJson(
                `/api/products/compare?store=${encodeURIComponent(product.source)}&externalProductId=${encodeURIComponent(product.externalId)}`
            );
            const comparison = compareRes.ok && compareRes.payload && compareRes.payload.success
                ? compareRes.payload.comparison
                : null;
            renderStoreComparison(comparison);
        } catch (error) {
            console.warn(`PriceIntelligence: store comparison failed for ${identity}`, error);
            renderStoreComparison(null);
        }
    }

    function bindRefresh(product) {
        const button = Utils.selectElement('#refresh-prices');
        if (!button || button.dataset.bound === 'true') {
            return;
        }
        button.dataset.bound = 'true';
        button.addEventListener('click', async () => {
            const status = Utils.selectElement('#refresh-status');
            button.disabled = true;
            if (status) {
                Utils.setTextContent(status, 'Refreshing live prices…');
            }
            try {
                if (typeof ProductDataService === 'undefined' || !ProductDataService.importProductFromUrl) {
                    throw new Error('Import service unavailable.');
                }
                const result = await ProductDataService.importProductFromUrl(product.url);
                if (!result || !result.ok || !result.product) {
                    const message = result && result.error && result.error.message
                        ? result.error.message
                        : 'Live product data is temporarily unavailable. Please try again later.';
                    throw new Error(message);
                }
                const fresh = result.product;
                if (typeof ProductsModule !== 'undefined') {
                    ProductsModule.setCurrentProduct(fresh);
                    const container = Utils.selectElement('.product-details-section');
                    // renderProductDetails re-invokes init() for the refreshed
                    // product, so sections update without an extra call here.
                    ProductsModule.renderProductDetails(fresh, container);
                }
                if (status) {
                    Utils.setTextContent(status, 'Prices refreshed.');
                }
            } catch (error) {
                if (status) {
                    Utils.setTextContent(status, error && error.message ? error.message : 'Refresh failed. Please try again later.');
                }
            } finally {
                button.disabled = false;
            }
        });
    }

    function init(product) {
        if (!isTrackable(product)) {
            hideAll();
            return;
        }
        renderDiscountBox(product);
        bindRefresh(product);
        loadSections(product);
    }

    return {
        init,
        isTrackable,
        currentDiscount,
        renderDiscountBox,
        renderDiscountCompare,
        renderHistory,
        renderStoreComparison,
        renderChart
    };
})();

if (typeof window !== 'undefined') {
    window.PriceIntelligence = PriceIntelligence;
}
