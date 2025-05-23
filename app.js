// app.js - For GroupMe Bot Instructions Page (Email/Password Auth) - WITH SITE GATE

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://zazjozinljwdgbyppffy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphempvemlubGp3ZGdieXBwZmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1Nzg5MTQsImV4cCI6MjA2MjE1NDkxNH0.PNGhZLxt6D8Lk76CUU0Bviul-T3nV0xHvQaJobX8f-k';

if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_SUPABASE_URL') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')) {
    console.error("CRITICAL ERROR: Supabase URL or Anon Key is not configured or uses placeholders. Please update app.js.");
    alert("Application Error: Backend services are not configured.");
    document.addEventListener('DOMContentLoaded', () => {
        const bodyContent = document.querySelector('.container');
        if (bodyContent) bodyContent.innerHTML = '<p style="color:red; text-align:center; padding:20px;">Application configuration error.</p>';
    });
}

const { createClient } = supabase;
let supabaseClient;
try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Failed to create Supabase client:", e);
    alert("Critical Error: Supabase client creation failed.");
    supabaseClient = null;
}

// --- DOM Elements ---
let authPromptSection, unlockedContent, showSignupModalBtn, showLoginModalBtn,
    signupModal, loginModal, signupForm, loginForm, signupMessage, loginMessage,
    switchToLoginLinkFromSignup, switchToSignupLinkFromLogin, forgotPasswordLink,
    logoutButton, welcomeMessageDiv;

function assignInstructionPageDOMElements() {
    authPromptSection = document.getElementById('auth-prompt-section');
    unlockedContent = document.getElementById('unlocked-content');
    showSignupModalBtn = document.getElementById('showSignupModalBtn');
    showLoginModalBtn = document.getElementById('showLoginModalBtn');
    signupModal = document.getElementById('signupModal');
    loginModal = document.getElementById('loginModal');
    signupForm = document.getElementById('signupForm');
    loginForm = document.getElementById('loginForm');
    signupMessage = document.getElementById('signupMessage');
    loginMessage = document.getElementById('loginMessage');
    switchToLoginLinkFromSignup = document.getElementById('switchToLoginLinkFromSignup');
    switchToSignupLinkFromLogin = document.getElementById('switchToSignupLinkFromLogin');
    forgotPasswordLink = document.getElementById('forgotPasswordLink');
    logoutButton = document.getElementById('logoutButton');
    welcomeMessageDiv = document.querySelector('.welcome-message');
}


// --- Utility Functions ---
function showModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
        requestAnimationFrame(() => modalElement.classList.add('modal-visible'));
    }
}
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('modal-visible');
        setTimeout(() => {
            if (!modalElement.classList.contains('modal-visible')) {
                modalElement.style.display = 'none';
            }
        }, 300);
    }
}
function showButtonLoadingState(button, isLoading, defaultText = "Submit", loadingText = "Processing...") {
    if (!button) return;
    const btnTextEl = button.querySelector('.button-text');
    const btnSpinnerEl = button.querySelector('.button-spinner');
    button.disabled = isLoading;
    if (isLoading) {
        button.classList.add('loading');
        if (btnTextEl) btnTextEl.style.opacity = '0';
        if (btnSpinnerEl) btnSpinnerEl.style.display = 'inline-block';
    } else {
        button.classList.remove('loading');
        if (btnTextEl) btnTextEl.style.opacity = '1';
        if (btnSpinnerEl) btnSpinnerEl.style.display = 'none';
    }
}

// --- UI State Management ---
function showUnlockedContentUI(user) {
    if (authPromptSection) authPromptSection.classList.add('hidden');
    if (unlockedContent) unlockedContent.classList.remove('hidden');
    if (welcomeMessageDiv && user) {
        const p = welcomeMessageDiv.querySelector('p');
        if (p && p.childNodes.length > 0 && p.childNodes[0].nodeType === Node.TEXT_NODE) {
             p.childNodes[0].nodeValue = `Welcome, ${user.email}! You can now access the setup guide. `;
        } else if (p) { 
            p.textContent = `Welcome, ${user.email}! You can now access the setup guide. `;
            if(logoutButton) p.appendChild(logoutButton); 
        }
    }
}
function showLockedContentUI() {
    if (authPromptSection) authPromptSection.classList.remove('hidden');
    if (unlockedContent) unlockedContent.classList.add('hidden');
    hideModal(signupModal);
    hideModal(loginModal);
}

// --- Profile Creation (called after successful signup) ---
async function createUserProfile(user) {
    if (!user || !supabaseClient) return;
    try {
        const { error } = await supabaseClient
            .from('profiles') 
            .insert({
                id: user.id,
                email: user.email
            });
        if (error) {
            if (error.code === '23505') { 
                 console.warn('Profile already exists for user:', user.id);
            } else {
                throw error;
            }
        } else {
            console.log('Profile created for user:', user.id);
        }
    } catch (error) {
        console.error('Error creating profile:', error.message);
        if (loginMessage) { 
            loginMessage.textContent = `Profile setup issue: ${error.message}. You can still view instructions.`;
            loginMessage.className = 'form-message error';
        }
    }
}


// --- Auth Event Handlers ---
async function handleSignup(event) {
    event.preventDefault();
    if (!signupForm || !signupMessage || !supabaseClient) return;
    const email = signupForm.signupEmail.value;
    const password = signupForm.signupPassword.value;
    const submitButton = signupForm.querySelector('button[type="submit"]');

    showButtonLoadingState(submitButton, true, "Sign Up", "Signing Up...");
    signupMessage.textContent = '';
    signupMessage.className = 'form-message';

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
        signupMessage.textContent = "Signup failed: " + error.message;
        signupMessage.classList.add('error');
    } else if (data.user) {
        await createUserProfile(data.user); 
        signupMessage.textContent = "Signup successful! If email confirmation is enabled, please check your email. Otherwise, you might be logged in.";
        signupMessage.classList.add('success');
        setTimeout(() => {
            hideModal(signupModal);
        }, 2500);
    } else {
        signupMessage.textContent = "Signup seems to have completed, but no user data was returned. Please try logging in or check your email.";
        signupMessage.classList.add('info');
    }
    showButtonLoadingState(submitButton, false, "Sign Up");
}

async function handleLogin(event) {
    event.preventDefault();
    if (!loginForm || !loginMessage || !supabaseClient) return;
    const email = loginForm.loginEmail.value;
    const password = loginForm.loginPassword.value;
    const submitButton = loginForm.querySelector('button[type="submit"]');

    showButtonLoadingState(submitButton, true, "Log In", "Logging In...");
    loginMessage.textContent = '';
    loginMessage.className = 'form-message';

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        loginMessage.textContent = "Login failed: " + error.message;
        loginMessage.classList.add('error');
    } else if (data.user) {
        hideModal(loginModal);
    }
    showButtonLoadingState(submitButton, false, "Log In");
}

async function handleLogout() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert('Logout failed: ' + error.message);
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    if (!loginForm || !loginMessage || !supabaseClient) return; 
    const email = loginForm.loginEmail.value || prompt("Please enter your email address to reset password:");

    if (!email) {
        loginMessage.textContent = "Please enter an email for password reset.";
        loginMessage.className = 'form-message error';
        return;
    }
    loginMessage.textContent = "Sending reset instructions...";
    loginMessage.className = 'form-message info';

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname, 
    });

    if (error) {
        loginMessage.textContent = `Error sending reset email: ${error.message}`;
        loginMessage.className = 'form-message error';
    } else {
        loginMessage.textContent = "Password reset instructions sent to your email.";
        loginMessage.className = 'form-message success';
    }
}


// --- Event Listeners and Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    assignInstructionPageDOMElements(); 

    if (!supabaseClient) {
        showLockedContentUI(); 
        if (authPromptSection) {
             authPromptSection.innerHTML = `<div style="color: red; font-weight: bold; text-align: center; padding: 20px;">Error: Application cannot connect to backend services. Please try again later.</div>`;
        }
        if (unlockedContent) unlockedContent.classList.add('hidden');
        return;
    }

    // --- Site Access Gate Check ---
    if (sessionStorage.getItem('instructionsAccessGranted') === 'true') {
        initializeInstructionsApp();
    } else {
        if (!window.location.pathname.endsWith('gate.html')) { // Check against generic gate.html
            window.location.href = 'gate.html'; // Redirect to generic gate.html
            return; 
        }
        // If on gate.html, its own script handles it. Hide content on index.html.
        if (authPromptSection) authPromptSection.classList.add('hidden');
        if (unlockedContent) unlockedContent.classList.add('hidden');
    }
});

function initializeInstructionsApp() {
    console.log("Instructions app initializing after gate pass...");

    if (authPromptSection) authPromptSection.classList.remove('hidden'); 
    // unlockedContent starts hidden, showUnlockedContentUI will manage it based on login

    if (showSignupModalBtn) showSignupModalBtn.addEventListener('click', () => {
        hideModal(loginModal); showModal(signupModal);
        if(signupMessage) signupMessage.textContent = '';
        if(signupForm) signupForm.reset();
    });
    if (showLoginModalBtn) showLoginModalBtn.addEventListener('click', () => {
        hideModal(signupModal); showModal(loginModal);
        if(loginMessage) loginMessage.textContent = '';
        if(loginForm) loginForm.reset();
    });

    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', () => {
            hideModal(button.closest('.modal'));
        });
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                hideModal(modal);
            }
        });
    });

    if (signupForm) signupForm.addEventListener('submit', handleSignup);
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', handleForgotPassword);

    if (switchToLoginLinkFromSignup) {
        switchToLoginLinkFromSignup.addEventListener('click', (e) => {
            e.preventDefault(); hideModal(signupModal); showModal(loginModal);
            if(loginMessage) loginMessage.textContent = ''; if(loginForm) loginForm.reset();
        });
    }
    if (switchToSignupLinkFromLogin) {
        switchToSignupLinkFromLogin.addEventListener('click', (e) => {
            e.preventDefault(); hideModal(loginModal); showModal(signupModal);
            if(signupMessage) signupMessage.textContent = ''; if(signupForm) signupForm.reset();
        });
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        console.log('Auth state changed (Instructions Page - Email/Pass):', _event, session);
        if (session && session.user) {
            showUnlockedContentUI(session.user);
        } else {
            showLockedContentUI();
        }
    });

    async function initialSessionCheck() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            console.log('Initial session valid for:', session.user.email);
            showUnlockedContentUI(session.user);
        } else {
            console.log('No initial valid session.');
            showLockedContentUI();
        }
    }
    initialSessionCheck();
}