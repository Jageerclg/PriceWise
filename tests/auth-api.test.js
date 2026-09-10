// PriceWise - Auth API tests (Phase 4)
// Service tests use a fake User model (real bcryptjs, low cost for speed).
// Route tests use the real Express router with a stubbed service.
// No live Atlas connection is required; nothing touches production data.

process.env.BCRYPT_ROUNDS = '4';

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const bcrypt = require('bcryptjs');

const { AuthService, toSafeUser, normalizeEmail } = require('../server/services/auth-service.js');

// Fake Mongoose-like user model: findOne() supports both
// `await findOne(q)` and `await findOne(q).select(...)`.
function createFakeUsers(initialDocs = []) {
    const docs = initialDocs.map((doc, index) => ({
        _id: `fake-id-${index + 1}`,
        ...doc
    }));
    const calls = { findOne: [], create: [] };
    return {
        docs,
        calls,
        findOne(query) {
            calls.findOne.push(query);
            const doc = docs.find((d) => d.email === query.email) || null;
            return {
                select: async () => (doc ? { ...doc } : null),
                then: (resolve, reject) => Promise.resolve(doc ? { ...doc } : null).then(resolve, reject)
            };
        },
        async create(data) {
            calls.create.push(data);
            const doc = { _id: `fake-id-${docs.length + 1}`, ...data };
            docs.push(doc);
            return { ...doc };
        }
    };
}

async function hashFor(password) {
    return bcrypt.hash(password, 4);
}

test('AuthService - signup', async (t) => {
    await t.test('signup success stores a hash and returns a safe user', async () => {
        const fakeUsers = createFakeUsers();
        const service = new AuthService({ userModel: fakeUsers });
        const result = await service.signup('John Doe', 'John@Example.com', 'password123');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.user.email, 'john@example.com');
        assert.strictEqual(result.user.fullName, 'John Doe');
        assert.strictEqual(result.user.firstName, 'John');
        assert(result.user.id);
        assert.strictEqual('password' in result.user, false);
        assert.strictEqual('passwordHash' in result.user, false);

        const stored = fakeUsers.docs[0];
        assert.strictEqual(stored.email, 'john@example.com');
        assert.strictEqual('password' in stored, false);
        assert(typeof stored.passwordHash === 'string');
        assert.notStrictEqual(stored.passwordHash, 'password123');
        assert.match(stored.passwordHash, /^\$2[aby]\$/);
        assert.strictEqual(await bcrypt.compare('password123', stored.passwordHash), true);
    });

    await t.test('signup validation rejects bad input without touching the database', async () => {
        const fakeUsers = createFakeUsers();
        const service = new AuthService({ userModel: fakeUsers });
        for (const args of [
            ['', 'a@example.com', 'password123'],
            ['John Doe', 'not-an-email', 'password123'],
            ['John Doe', 'a@example.com', 'short']
        ]) {
            const result = await service.signup(...args);
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error.code, 'VALIDATION_ERROR');
        }
        assert.strictEqual(fakeUsers.calls.create.length, 0);
    });

    await t.test('signup duplicate email returns EMAIL_EXISTS', async () => {
        const fakeUsers = createFakeUsers([
            { fullName: 'Taken User', firstName: 'Taken', email: 'taken@example.com', passwordHash: 'hash' }
        ]);
        const service = new AuthService({ userModel: fakeUsers });
        const result = await service.signup('New User', 'TAKEN@example.com', 'password123');
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.error.code, 'EMAIL_EXISTS');
        assert.match(result.error.message, /already exists/i);
    });

    await t.test('signup maps MongoDB duplicate-key error 11000 to EMAIL_EXISTS', async () => {
        const fakeUsers = createFakeUsers();
        fakeUsers.create = async () => {
            const error = new Error('E11000 duplicate key error');
            error.code = 11000;
            throw error;
        };
        const service = new AuthService({ userModel: fakeUsers });
        const result = await service.signup('Race User', 'race@example.com', 'password123');
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.error.code, 'EMAIL_EXISTS');
    });
});

test('AuthService - login', async (t) => {
    async function serviceWithUser() {
        const fakeUsers = createFakeUsers();
        const service = new AuthService({ userModel: fakeUsers });
        await service.signup('Test User', 'testuser@example.com', 'password123');
        return { service, fakeUsers };
    }

    await t.test('login success returns a safe user without hash material', async () => {
        const { service } = await serviceWithUser();
        const result = await service.login('TESTUSER@EXAMPLE.COM', 'password123');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.user.email, 'testuser@example.com');
        assert.strictEqual('password' in result.user, false);
        assert.strictEqual('passwordHash' in result.user, false);
        assert.strictEqual(JSON.stringify(result).includes('password123'), false);
    });

    await t.test('wrong password and unknown email share one generic message', async () => {
        const { service } = await serviceWithUser();
        const wrongPassword = await service.login('testuser@example.com', 'wrongpassword');
        const unknownEmail = await service.login('nobody@example.com', 'password123');
        assert.strictEqual(wrongPassword.success, false);
        assert.strictEqual(unknownEmail.success, false);
        assert.strictEqual(wrongPassword.error.code, 'INVALID_CREDENTIALS');
        assert.strictEqual(unknownEmail.error.message, wrongPassword.error.message);
        assert.strictEqual(unknownEmail.error.message, 'Invalid email or password.');
    });

    await t.test('login rejects invalid request data', async () => {
        const { service } = await serviceWithUser();
        for (const args of [['', 'password123'], ['a@example.com', ''], ['not-an-email', 'password123']]) {
            const result = await service.login(...args);
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error.code, 'INVALID_CREDENTIALS');
        }
    });
});

test('AuthService - helpers', async (t) => {
    await t.test('normalizeEmail trims and lowercases', () => {
        assert.strictEqual(normalizeEmail('  User@Example.COM  '), 'user@example.com');
    });

    await t.test('toSafeUser never exposes hash material', () => {
        const safe = toSafeUser({
            _id: 'abc123',
            fullName: 'Jane Doe',
            firstName: 'Jane',
            email: 'jane@example.com',
            passwordHash: 'secret-hash',
            password: 'secret'
        });
        assert.deepStrictEqual(safe, {
            id: 'abc123',
            fullName: 'Jane Doe',
            firstName: 'Jane',
            email: 'jane@example.com'
        });
    });
});

test('Auth routes - HTTP contract', async (t) => {
    // Stub the service module in the require cache BEFORE loading the router.
    const servicePath = require.resolve('../server/services/auth-service.js');
    const realServiceEntry = require.cache[servicePath];
    const behaviors = { signup: null, login: null };
    function FakeAuthService() {
        return behaviors;
    }
    require.cache[servicePath] = {
        id: servicePath,
        filename: servicePath,
        loaded: true,
        exports: { AuthService: FakeAuthService }
    };
    delete require.cache[require.resolve('../server/routes/auth.js')];
    const authRouter = require('../server/routes/auth.js');
    if (realServiceEntry) {
        require.cache[servicePath] = realServiceEntry;
    } else {
        delete require.cache[servicePath];
    }

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(() => new Promise((resolve) => server.close(resolve)));

    async function post(pathname, body) {
        const response = await fetch(`${base}${pathname}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const text = await response.text();
        return { status: response.status, text, payload: text ? JSON.parse(text) : null };
    }

    await t.test('POST /signup returns 201 with a safe user', async () => {
        behaviors.signup = async () => ({
            success: true,
            user: { id: 'u1', fullName: 'A B', firstName: 'A', email: 'a@example.com' }
        });
        const { status, text, payload } = await post('/api/auth/signup', {
            fullName: 'A B', email: 'a@example.com', password: 'password123'
        });
        assert.strictEqual(status, 201);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.user.email, 'a@example.com');
        assert(!text.includes('passwordHash') && !text.includes('password123'));
    });

    await t.test('POST /signup duplicate returns 409', async () => {
        behaviors.signup = async () => ({
            success: false,
            error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' }
        });
        const { status, payload } = await post('/api/auth/signup', {
            fullName: 'A B', email: 'a@example.com', password: 'password123'
        });
        assert.strictEqual(status, 409);
        assert.match(payload.error.message, /already exists/i);
    });

    await t.test('POST /signup validation failure returns 400', async () => {
        behaviors.signup = async () => ({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Please enter a valid email address.' }
        });
        const { status } = await post('/api/auth/signup', {
            fullName: 'A B', email: 'bad', password: 'password123'
        });
        assert.strictEqual(status, 400);
    });

    await t.test('POST /login returns 200 with a safe user', async () => {
        behaviors.login = async () => ({
            success: true,
            user: { id: 'u1', fullName: 'A B', firstName: 'A', email: 'a@example.com' }
        });
        const { status, text, payload } = await post('/api/auth/login', {
            email: 'a@example.com', password: 'password123'
        });
        assert.strictEqual(status, 200);
        assert.strictEqual(payload.success, true);
        assert(!text.includes('passwordHash'));
    });

    await t.test('POST /login invalid credentials returns 401 with generic message', async () => {
        behaviors.login = async () => ({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
        });
        const { status, payload } = await post('/api/auth/login', {
            email: 'a@example.com', password: 'wrong'
        });
        assert.strictEqual(status, 401);
        assert.strictEqual(payload.error.message, 'Invalid email or password.');
    });
});

test('User model - real Mongoose validation without a database', async (t) => {
    // Regression test: model middleware must run under the installed Mongoose
    // major (callback-style `next` was removed in Mongoose 9 and broke signup
    // with "next is not a function"). document.validate() needs no connection.
    await t.test('pre-validate hook derives firstName and does not throw', async () => {
        const User = require('../server/models/User.js');
        const doc = new User({
            fullName: 'Test User',
            email: 'model-check@example.com',
            passwordHash: '$2b$04$abcdefghijklmnopqrstuu-placeholder'
        });
        await doc.validate();
        assert.strictEqual(doc.firstName, 'Test');
        assert.strictEqual(doc.email, 'model-check@example.com');
    });

    await t.test('schema rejects invalid documents', async () => {
        const User = require('../server/models/User.js');
        const doc = new User({ fullName: 'X', email: 'bad', passwordHash: 'h' });
        await assert.rejects(doc.validate());
    });
});

test('DB connection - startup safety without live Atlas', async (t) => {
    await t.test('connectDB fails clearly when MONGODB_URI is missing', async () => {
        const previous = process.env.MONGODB_URI;
        delete process.env.MONGODB_URI;
        const { connectDB } = require('../server/db/connection.js');
        await assert.rejects(connectDB, /MONGODB_URI is not set/);
        if (previous !== undefined) {
            process.env.MONGODB_URI = previous;
        }
    });

    await t.test('getConnectionState reports disconnected without connecting', () => {
        const { getConnectionState } = require('../server/db/connection.js');
        const state = getConnectionState();
        assert.strictEqual(state.connected, false);
        assert.strictEqual(typeof state.state, 'number');
    });
});

console.log('Auth API tests completed!');
