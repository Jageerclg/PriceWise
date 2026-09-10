// PriceWise - Authentication Module
// Phase 4: MongoDB-backed authentication + localStorage client session
// =====================================================================
// MongoDB (via the Express auth API) is the source of truth for accounts.
// localStorage holds ONLY the client-side session (safe display fields).
// Passwords are NEVER stored in localStorage.

const Auth = (function() {
    'use strict';

    // Legacy local user database key. MUST NOT be used as an authentication
    // authority anymore — it is removed on initialization (see initialize).
    const LEGACY_USERS_KEY = 'pricewise-users';
    const SESSION_STORAGE_KEY = 'pricewise-session';

    const SIGNUP_ENDPOINT = '/api/auth/signup';
    const LOGIN_ENDPOINT = '/api/auth/login';

    /**
     * Initialize authentication system and set up navigation
     */
    function initialize() {
        removeLegacyUserDatabase();
        rejectUnsafeSession();
        updateNavigationUI();
        console.log('Auth module initialized');
    }

    /**
     * One-time migration: delete the old plaintext-password user database.
     * Legacy demo accounts must register again against MongoDB.
     */
    function removeLegacyUserDatabase() {
        try {
            localStorage.removeItem(LEGACY_USERS_KEY);
        } catch (error) {
            console.warn('Error removing legacy user database:', error);
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid email format
     */
    function validateEmail(email) {
        if (typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} {isValid: boolean, message: string}
     */
    function validatePassword(password) {
        if (typeof password !== 'string') {
            return { isValid: false, message: 'Password must be a string.' };
        }
        if (password.length < 8) {
            return { isValid: false, message: 'Password must be at least 8 characters.' };
        }
        return { isValid: true, message: '' };
    }

    /**
     * Validate full name
     * @param {string} name - Name to validate
     * @returns {Object} {isValid: boolean, message: string}
     */
    function validateName(name) {
        if (typeof name !== 'string') {
            return { isValid: false, message: 'Name must be a string.' };
        }
        const trimmed = name.trim();
        if (trimmed.length === 0) {
            return { isValid: false, message: 'Please enter your name.' };
        }
        if (trimmed.length < 2) {
            return { isValid: false, message: 'Name must be at least 2 characters.' };
        }
        return { isValid: true, message: '' };
    }

    /**
     * Read the client session only if it has a safe shape.
     * Sessions containing password material are rejected and removed.
     * @returns {Object|null} Session object or null
     */
    function readSafeSession() {
        try {
            const sessionJson = localStorage.getItem(SESSION_STORAGE_KEY);
            if (!sessionJson) {
                return null;
            }
            const session = JSON.parse(sessionJson);
            if (!session || typeof session !== 'object') {
                return null;
            }
            if (!session.userId || !session.email) {
                return null;
            }
            if ('password' in session || 'passwordHash' in session) {
                try {
                    localStorage.removeItem(SESSION_STORAGE_KEY);
                } catch (removeError) {
                    console.warn('Error removing unsafe session:', removeError);
                }
                return null;
            }
            return session;
        } catch (error) {
            console.warn('Error reading session from storage:', error);
            return null;
        }
    }

    /**
     * Reject and remove any stored session that carries password material.
     */
    function rejectUnsafeSession() {
        readSafeSession();
    }

    /**
     * Check whether an email is already registered.
     * The server is the authority; this client helper always defers to it.
     * @param {string} email - Email to check
     * @returns {boolean} Always false — duplicate detection happens on signup (HTTP 409).
     */
    function emailExists(email) {
        return false;
    }

    /**
     * POST JSON to the auth API and return the parsed payload.
     */
    async function postAuthJson(endpoint, body) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        let payload = null;
        try {
            payload = await response.json();
        } catch (error) {
            payload = null;
        }
        return { response, payload };
    }

    /**
     * Create a new user account via the MongoDB-backed auth API.
     * Client validation is for UX only; the server is authoritative.
     * @param {string} fullName - User's full name
     * @param {string} email - User's email
     * @param {string} password - User's password (sent once, never stored locally)
     * @returns {Promise<Object>} {success: boolean, message: string, user?: Object}
     */
    async function signup(fullName, email, password) {
        // Validate inputs locally for immediate feedback
        const nameValidation = validateName(fullName);
        if (!nameValidation.isValid) {
            return { success: false, message: nameValidation.message };
        }

        if (!email || typeof email !== 'string') {
            return { success: false, message: 'Please enter a valid email address.' };
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!validateEmail(normalizedEmail)) {
            return { success: false, message: 'Please enter a valid email address.' };
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return { success: false, message: passwordValidation.message };
        }

        try {
            const { response, payload } = await postAuthJson(SIGNUP_ENDPOINT, {
                fullName: fullName.trim(),
                email: normalizedEmail,
                password: password
            });

            if (response.ok && payload && payload.success && payload.user) {
                console.log('User created successfully:', payload.user.email);
                return { success: true, message: 'Account created successfully!', user: payload.user };
            }

            const message =
                payload && payload.error && payload.error.message
                    ? payload.error.message
                    : 'Failed to create account. Please try again.';
            return { success: false, message: message };
        } catch (error) {
            console.warn('Signup request failed:', error);
            return { success: false, message: 'Unable to reach the server. Please try again.' };
        }
    }

    /**
     * Login via the MongoDB-backed auth API.
     * On success only safe session fields are stored locally.
     * @param {string} email - User's email
     * @param {string} password - User's password (sent once, never stored locally)
     * @returns {Promise<Object>} {success: boolean, message: string}
     */
    async function login(email, password) {
        if (!email || !password) {
            return { success: false, message: 'Invalid email or password.' };
        }

        const normalizedEmail = email.trim().toLowerCase();

        try {
            const { response, payload } = await postAuthJson(LOGIN_ENDPOINT, {
                email: normalizedEmail,
                password: password
            });

            if (response.ok && payload && payload.success && payload.user) {
                // Create client session with safe fields only
                const session = {
                    userId: payload.user.id,
                    email: payload.user.email,
                    fullName: payload.user.fullName,
                    firstName: payload.user.firstName,
                    loginTime: new Date().toISOString()
                };

                try {
                    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
                    console.log('User logged in:', session.email);
                    return { success: true, message: 'Login successful!' };
                } catch (error) {
                    console.error('Error saving session:', error);
                    return { success: false, message: 'Login failed. Please try again.' };
                }
            }

            return { success: false, message: 'Invalid email or password.' };
        } catch (error) {
            console.warn('Login request failed:', error);
            return { success: false, message: 'Unable to reach the server. Please try again.' };
        }
    }

    /**
     * Check if user is currently logged in
     * @returns {boolean} True if user has an active safe session
     */
    function isLoggedIn() {
        return readSafeSession() !== null;
    }

    /**
     * Get current logged-in user information
     * @returns {Object|null} Current user object or null if not logged in
     */
    function getCurrentUser() {
        return readSafeSession();
    }

    /**
     * Logout current user
     * @returns {boolean} True if logout successful
     */
    function logout() {
        try {
            localStorage.removeItem(SESSION_STORAGE_KEY);
            updateNavigationUI();
            console.log('User logged out');
            return true;
        } catch (error) {
            console.error('Error during logout:', error);
            return false;
        }
    }

    /**
     * Require authentication - redirect to login if not logged in
     * @param {string} redirectPath - Path to redirect to after login (optional)
     */
    function requireAuth(redirectPath = null) {
        if (!isLoggedIn()) {
            let loginUrl = 'login.html';
            if (redirectPath) {
                // Validate redirect path to prevent open redirects
                if (isValidRedirectPath(redirectPath)) {
                    loginUrl += '?redirect=' + encodeURIComponent(redirectPath);
                }
            }
            window.location.href = loginUrl;
        }
    }

    /**
     * Validate redirect path to prevent open redirects
     * @param {string} path - Path to validate
     * @returns {boolean} True if path is safe
     */
    function isValidRedirectPath(path) {
        if (typeof path !== 'string') return false;
        // Only allow internal paths (no protocol, no //, no external domains)
        if (path.includes('://') || path.includes('//') || path.startsWith('http')) {
            return false;
        }
        return true;
    }

    /**
     * Get redirect URL from query parameters
     * @returns {string|null} Redirect URL or null
     */
    function getRedirectFromQuery() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const redirect = urlParams.get('redirect');
            if (redirect && isValidRedirectPath(redirect)) {
                return redirect;
            }
        } catch (error) {
            console.warn('Error getting redirect URL:', error);
        }
        return null;
    }

    /**
     * Update navigation UI based on auth state
     */
    function updateNavigationUI() {
        const navList = Utils.selectElement('.nav-list');
        if (!navList) {
            console.warn('Navigation list not found');
            return;
        }

        // Remove existing auth items if present
        const existingAuthItems = navList.querySelectorAll('[data-auth-item]');
        existingAuthItems.forEach(item => item.remove());

        if (isLoggedIn()) {
            // Show logged-in state
            const user = getCurrentUser();
            if (user) {
                const firstName = user.firstName || user.fullName;

                // Create welcome item
                const welcomeItem = document.createElement('li');
                welcomeItem.setAttribute('data-auth-item', 'true');
                welcomeItem.className = 'auth-nav-item auth-welcome';
                welcomeItem.innerHTML = `<span class="auth-user-greeting">Welcome, ${Utils.escapeHtml(firstName)}</span>`;

                // Create logout item
                const logoutItem = document.createElement('li');
                logoutItem.setAttribute('data-auth-item', 'true');
                logoutItem.className = 'auth-nav-item';
                const logoutLink = document.createElement('a');
                logoutLink.href = '#';
                logoutLink.className = 'nav-link auth-logout-link';
                logoutLink.textContent = 'Logout';
                logoutLink.onclick = (e) => {
                    e.preventDefault();
                    handleLogout();
                };

                logoutItem.appendChild(logoutLink);

                // Append to navigation
                navList.appendChild(welcomeItem);
                navList.appendChild(logoutItem);
            }
        } else {
            // Show logged-out state
            const loginItem = document.createElement('li');
            loginItem.setAttribute('data-auth-item', 'true');
            loginItem.className = 'auth-nav-item';
            const loginLink = document.createElement('a');
            loginLink.href = 'login.html';
            loginLink.className = 'nav-link';
            loginLink.textContent = 'Login';
            loginItem.appendChild(loginLink);

            const signupItem = document.createElement('li');
            signupItem.setAttribute('data-auth-item', 'true');
            signupItem.className = 'auth-nav-item';
            const signupLink = document.createElement('a');
            signupLink.href = 'signup.html';
            signupLink.className = 'nav-link';
            signupLink.textContent = 'Sign Up';
            signupItem.appendChild(signupLink);

            navList.appendChild(loginItem);
            navList.appendChild(signupItem);
        }
    }

    /**
     * Handle logout action
     */
    function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            logout();
            window.location.href = 'index.html';
        }
    }

    // Public API
    return {
        initialize,
        signup,
        login,
        logout,
        isLoggedIn,
        getCurrentUser,
        requireAuth,
        updateNavigationUI,
        getRedirectFromQuery,
        validateEmail,
        validatePassword,
        validateName,
        emailExists
    };
})();

// Initialize auth module when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Auth.initialize);
} else {
    Auth.initialize();
}

// Make Auth available globally
if (typeof window !== 'undefined') {
    window.Auth = Auth;
}
