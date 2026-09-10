// PriceWise - Authentication Module Tests (Phase 4)
// Tests the REAL public/js/auth.js (MongoDB-backed + localStorage session)
// with mocked browser globals and a mocked fetch API. No live DB needed.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Mock localStorage for Node.js environment
class MockLocalStorage {
    constructor() {
        this.store = {};
    }

    getItem(key) {
        return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    }

    setItem(key, value) {
        this.store[key] = value.toString();
    }

    removeItem(key) {
        delete this.store[key];
    }

    clear() {
        this.store = {};
    }
}

const USERS_KEY = 'pricewise-users';
const SESSION_KEY = 'pricewise-session';

let fetchHandler = null;

function loadAuthModule() {
    const localStorage = new MockLocalStorage();
    const windowObj = { location: { search: '' } };
    const context = {
        console,
        URLSearchParams,
        localStorage,
        window: windowObj,
        document: {
            readyState: 'loading',
            addEventListener() {},
            querySelector() { return null; }
        },
        Utils: {
            selectElement() { return null; },
            escapeHtml(value) { return String(value); }
        },
        fetch: (...args) => {
            if (typeof fetchHandler !== 'function') {
                throw new Error('fetch was called without a mock handler');
            }
            return fetchHandler(...args);
        }
    };
    context.globalThis = context;
    vm.createContext(context);
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'js', 'auth.js'),
        'utf8'
    );
    vm.runInContext(source, context);
    return { Auth: windowObj.Auth, localStorage, context };
}

function mockApiSuccess(user) {
    fetchHandler = async () => ({
        ok: true,
        json: async () => ({ success: true, user })
    });
}

function mockApiError(status, code, message) {
    fetchHandler = async () => ({
        ok: false,
        status,
        json: async () => ({ success: false, error: { code, message } })
    });
}

const demoUser = {
    id: '507f1f77bcf86cd799439011',
    fullName: 'John Doe',
    firstName: 'John',
    email: 'john@example.com'
};

test('Authentication Module - Validation', async (t) => {
    const { Auth } = loadAuthModule();

    await t.test('validateEmail - should accept valid emails', () => {
        assert.strictEqual(Auth.validateEmail('user@example.com'), true);
        assert.strictEqual(Auth.validateEmail('test.user@domain.co.uk'), true);
        assert.strictEqual(Auth.validateEmail('a@b.c'), true);
    });

    await t.test('validateEmail - should reject invalid emails', () => {
        assert.strictEqual(Auth.validateEmail('invalid'), false);
        assert.strictEqual(Auth.validateEmail('invalid@'), false);
        assert.strictEqual(Auth.validateEmail('@domain.com'), false);
        assert.strictEqual(Auth.validateEmail(''), false);
        assert.strictEqual(Auth.validateEmail(null), false);
    });

    await t.test('validatePassword - should accept valid passwords', () => {
        const result = Auth.validatePassword('password123');
        assert.strictEqual(result.isValid, true);
    });

    await t.test('validatePassword - should reject weak passwords', () => {
        const result = Auth.validatePassword('short');
        assert.strictEqual(result.isValid, false);
        assert.match(result.message, /8 characters/);
    });

    await t.test('validatePassword - should reject non-string passwords', () => {
        const result = Auth.validatePassword(123);
        assert.strictEqual(result.isValid, false);
    });

    await t.test('validateName - should accept valid names', () => {
        const result = Auth.validateName('John Doe');
        assert.strictEqual(result.isValid, true);
    });

    await t.test('validateName - should reject empty names', () => {
        const result = Auth.validateName('');
        assert.strictEqual(result.isValid, false);
    });

    await t.test('validateName - should reject single character names', () => {
        const result = Auth.validateName('A');
        assert.strictEqual(result.isValid, false);
    });
});

test('Authentication Module - Signup via API', async (t) => {
    await t.test('signup - should create account and never store users locally', async () => {
        const { Auth, localStorage } = loadAuthModule();
        let seenBody = null;
        fetchHandler = async (url, options) => {
            assert.strictEqual(url, '/api/auth/signup');
            seenBody = JSON.parse(options.body);
            return { ok: true, json: async () => ({ success: true, user: demoUser }) };
        };
        const result = await Auth.signup('John Doe', 'John@Example.com', 'password123');
        assert.strictEqual(result.success, true);
        assert.match(result.message, /success/i);
        assert.strictEqual(seenBody.email, 'john@example.com');
        assert.strictEqual(seenBody.password, 'password123');
        assert.strictEqual(localStorage.getItem(USERS_KEY), null);
    });

    await t.test('signup - should surface duplicate email from server', async () => {
        const { Auth } = loadAuthModule();
        mockApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
        const result = await Auth.signup('Bob Smith', 'taken@example.com', 'password456');
        assert.strictEqual(result.success, false);
        assert.match(result.message, /already exists/i);
    });

    await t.test('signup - should reject invalid email before any request', async () => {
        const { Auth } = loadAuthModule();
        let called = false;
        fetchHandler = async () => { called = true; throw new Error('should not be called'); };
        const result = await Auth.signup('John Doe', 'invalid-email', 'password123');
        assert.strictEqual(result.success, false);
        assert.match(result.message, /valid email/i);
        assert.strictEqual(called, false);
    });

    await t.test('signup - should reject weak password before any request', async () => {
        const { Auth } = loadAuthModule();
        let called = false;
        fetchHandler = async () => { called = true; throw new Error('should not be called'); };
        const result = await Auth.signup('John Doe', 'john@example.com', 'short');
        assert.strictEqual(result.success, false);
        assert.match(result.message, /8 characters/);
        assert.strictEqual(called, false);
    });

    await t.test('signup - should reject empty name before any request', async () => {
        const { Auth } = loadAuthModule();
        const result = await Auth.signup('', 'john@example.com', 'password123');
        assert.strictEqual(result.success, false);
        assert.match(result.message, /name/i);
    });

    await t.test('signup - should handle network failure gracefully', async () => {
        const { Auth } = loadAuthModule();
        fetchHandler = async () => { throw new Error('connection refused'); };
        const result = await Auth.signup('John Doe', 'john@example.com', 'password123');
        assert.strictEqual(result.success, false);
        assert.match(result.message, /server/i);
    });
});

test('Authentication Module - Login via API', async (t) => {
    await t.test('login - should accept valid credentials and create a safe session', async () => {
        const { Auth, localStorage } = loadAuthModule();
        mockApiSuccess(demoUser);
        const result = await Auth.login('TESTUSER@EXAMPLE.COM'.replace('TESTUSER', 'john'), 'password123');
        assert.strictEqual(result.success, true);
        const session = JSON.parse(localStorage.getItem(SESSION_KEY));
        assert.strictEqual(session.email, 'john@example.com');
        assert.strictEqual(session.userId, demoUser.id);
        assert.strictEqual(session.fullName, 'John Doe');
        assert(session.loginTime);
        assert.strictEqual('password' in session, false);
        assert.strictEqual('passwordHash' in session, false);
    });

    await t.test('login - should normalize email before sending', async () => {
        const { Auth } = loadAuthModule();
        let seenBody = null;
        fetchHandler = async (url, options) => {
            seenBody = JSON.parse(options.body);
            return { ok: true, json: async () => ({ success: true, user: demoUser }) };
        };
        await Auth.login('  John@Example.COM  ', 'password123');
        assert.strictEqual(seenBody.email, 'john@example.com');
    });

    await t.test('login - should use generic message for invalid password', async () => {
        const { Auth } = loadAuthModule();
        mockApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
        const result = await Auth.login('john@example.com', 'wrongpassword');
        assert.strictEqual(result.success, false);
        assert.match(result.message, /invalid/i);
    });

    await t.test('login - should use the same generic message for unknown email', async () => {
        const { Auth } = loadAuthModule();
        mockApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
        const result = await Auth.login('nonexistent@example.com', 'password123');
        assert.strictEqual(result.success, false);
        assert.match(result.message, /invalid/i);
    });

    await t.test('login - should reject missing credentials without a request', async () => {
        const { Auth } = loadAuthModule();
        let called = false;
        fetchHandler = async () => { called = true; throw new Error('should not be called'); };
        const result = await Auth.login('', '');
        assert.strictEqual(result.success, false);
        assert.strictEqual(called, false);
    });

    await t.test('login - should handle network failure gracefully', async () => {
        const { Auth, localStorage } = loadAuthModule();
        fetchHandler = async () => { throw new Error('connection refused'); };
        const result = await Auth.login('john@example.com', 'password123');
        assert.strictEqual(result.success, false);
        assert.strictEqual(localStorage.getItem(SESSION_KEY), null);
    });
});

test('Authentication Module - Session Management', async (t) => {
    await t.test('isLoggedIn - should return false when no session', () => {
        const { Auth } = loadAuthModule();
        assert.strictEqual(Auth.isLoggedIn(), false);
    });

    await t.test('getCurrentUser - should return null when logged out', () => {
        const { Auth } = loadAuthModule();
        assert.strictEqual(Auth.getCurrentUser(), null);
    });

    await t.test('logout - should clear session', async () => {
        const { Auth, localStorage } = loadAuthModule();
        mockApiSuccess(demoUser);
        await Auth.login('john@example.com', 'password123');
        assert.strictEqual(Auth.isLoggedIn(), true);
        Auth.logout();
        assert.strictEqual(Auth.isLoggedIn(), false);
        assert.strictEqual(localStorage.getItem(SESSION_KEY), null);
    });

    await t.test('logout - should not throw errors', () => {
        const { Auth } = loadAuthModule();
        assert.doesNotThrow(() => {
            Auth.logout();
        });
    });

    await t.test('unsafe session with password material is rejected and removed', () => {
        const { Auth, localStorage } = loadAuthModule();
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: 'x', email: 'x@example.com', password: 'secret'
        }));
        assert.strictEqual(Auth.isLoggedIn(), false);
        assert.strictEqual(Auth.getCurrentUser(), null);
        assert.strictEqual(localStorage.getItem(SESSION_KEY), null);
    });
});

test('Authentication Module - Legacy migration', async (t) => {
    await t.test('initialize removes the legacy plaintext user database', () => {
        const { Auth, localStorage } = loadAuthModule();
        localStorage.setItem(USERS_KEY, JSON.stringify([
            { id: 'user-1', email: 'old@example.com', password: 'plaintext' }
        ]));
        Auth.initialize();
        assert.strictEqual(localStorage.getItem(USERS_KEY), null);
    });

    await t.test('emailExists defers to the server (no local credential store)', () => {
        const { Auth } = loadAuthModule();
        assert.strictEqual(Auth.emailExists('anyone@example.com'), false);
    });
});

test('Authentication Module - Redirect Safety', async (t) => {
    await t.test('getRedirectFromQuery - should allow internal paths', () => {
        const { Auth, context } = loadAuthModule();
        context.window.location.search = '?redirect=products.html';
        assert.strictEqual(Auth.getRedirectFromQuery(), 'products.html');
        context.window.location.search = '?redirect=product-details.html%3Fid%3D123';
        assert.strictEqual(Auth.getRedirectFromQuery(), 'product-details.html?id=123');
    });

    await t.test('getRedirectFromQuery - should reject external URLs', () => {
        const { Auth, context } = loadAuthModule();
        for (const search of [
            '?redirect=http%3A%2F%2Fevil.com',
            '?redirect=https%3A%2F%2Fevil.com',
            '?redirect=%2F%2Fevil.com'
        ]) {
            context.window.location.search = search;
            assert.strictEqual(Auth.getRedirectFromQuery(), null);
        }
    });

    await t.test('getRedirectFromQuery - should return null when absent', () => {
        const { Auth } = loadAuthModule();
        assert.strictEqual(Auth.getRedirectFromQuery(), null);
    });
});

console.log('Auth module tests completed!');
