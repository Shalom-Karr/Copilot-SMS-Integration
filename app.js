// app.js - For GroupMe Bot Instructions Page (Email/Password Auth)

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://zazjozinljwdgbyppffy.supabase.co'; // YOUR INSTRUCTION PAGE SUPABASE URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphempvemlubGp3ZGdieXBwZmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1Nzg5MTQsImV4cCI6MjA2MjE1NDkxNH0.PNGhZLxt6D8Lk76CUU0Bviul-T3nV0xHvQaJobX8f-k'; // YOUR INSTRUCTION PAGE SUPABASE ANON KEY

if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_SUPABASE_URL') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')) {
    console.error("CRITICAL ERROR: Supabase URL or Anon Key is not configured or uses placeholders. Please update app.js.");
    alert("Application Error: Backend services are not configured.");
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
const authPromptSection = document.getElementById('auth-prompt-section');
const unlockedContent = document.getElementById('unlocked-content');

const showSignupModalBtn = document.getElementById('showSignupModalBtn');
const showLoginModalBtn = document.getElementById('showLoginModalBtn');

const signupModal = document.getElementById('signupModal');
const loginModal = document.getElementById('loginModal');

const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');

const signupMessage = document.getElementById('signupMessage');
const loginMessage = document.getElementById('loginMessage');

const switchToLoginLinkFromSignup = document.getElementById('switchToLoginLinkFromSignup');
const switchToSignupLinkFromLogin = document.getElementById('switchToSignupLinkFromLogin');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

const logoutButton = document.getElementById('logoutButton');
const welcomeMessageDiv = document.querySelector('.welcome-message'); // To show email

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
        if (p) p.childNodes[0].nodeValue = `Welcome, ${user.email}! You can now access the setup guide. `; // Update text node
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
            // It's possible the profile already exists if there was a partial signup or manual entry
            if (error.code === '23505') { // Unique violation (profile already exists)
                 console.warn('Profile already exists for user:', user.id);
            } else {
                throw error;
            }
        } else {
            console.log('Profile created for user:', user.id);
        }
    } catch (error) {
        console.error('Error creating profile:', error.message);
        // This is not critical for viewing instructions, so don't block UI
        if (loginMessage) { // Or a general message area
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
        await createUserProfile(data.user); // Create profile after successful signup
        signupMessage.textContent = "Signup successful! If email confirmation is enabled, please check your email. Otherwise, you might be logged in.";
        signupMessage.classList.add('success');
        // Supabase onAuthStateChange will handle UI update if user session starts
        // or if email confirmation is required, user needs to confirm.
        // We can hide modal after a delay for message visibility.
        setTimeout(() => {
            hideModal(signupModal);
            if (data.session) { // If session is immediately available (e.g., email confirm OFF)
                showUnlockedContentUI(data.user);
            } else {
                // User needs to confirm email, show prompt section again or a specific message.
                // For now, just hide modal; onAuthStateChange will keep locked UI.
            }
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
        // loginMessage.textContent = "Login successful!"; // Not needed, onAuthStateChange handles UI
        // loginMessage.classList.add('success');
        // Supabase onAuthStateChange will handle UI update
        hideModal(loginModal);
    }
    showButtonLoadingState(submitButton, false, "Log In");
}

async function handleLogout() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert('Logout failed: ' + error.message); // Simple alert for logout error
    }
    // onAuthStateChange will handle UI update
}

async function handleForgotPassword(event) {
    event.preventDefault();
    if (!loginForm || !loginMessage || !supabaseClient) return; // Assume email from login form or prompt
    const email = loginForm.loginEmail.value || prompt("Please enter your email address to reset password:");

    if (!email) {
        loginMessage.textContent = "Please enter an email for password reset.";
        loginMessage.className = 'form-message error';
        return;
    }
    loginMessage.textContent = "Sending reset instructions...";
    loginMessage.className = 'form-message info';

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin, // Or a specific password reset page
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
    if (!supabaseClient) {
        showLockedContentUI();
        const container = document.querySelector('.container');
        if (container && authPromptSection) {
            authPromptSection.innerHTML = `<div style="color: red; font-weight: bold; text-align: center; padding: 20px;">Error: Application cannot connect to backend services. Please try again later.</div>`;
        }
        return;
    }

    // Modal Triggers
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

    // Modal Close Buttons
    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', () => {
            hideModal(button.closest('.modal'));
        });
    });
    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                hideModal(modal);
            }
        });
    });


    // Form Submissions
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', handleForgotPassword);


    // Switch links between modals
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


    // Auth State Change Listener
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        console.log('Auth state changed (Instructions Page - Email/Pass):', _event, session);
        if (session && session.user) {
            showUnlockedContentUI(session.user);
            // Ensure profile exists (could be called here too, or just after signup)
            // await ensureUserProfileExists(session.user); // This is already called in handleSignup
        } else {
            showLockedContentUI();
        }
    });

    // Initial check for session
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
});