// app.js - For GroupMe Bot Instructions Page (Email/Password Auth) - WITH SITE GATE, AMPLITUDE & REQUIRED NAME/PHONE

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
    if (!authPromptSection) authPromptSection = document.getElementById('auth-prompt-section');
    if (!unlockedContent) unlockedContent = document.getElementById('unlocked-content');
    if (!welcomeMessageDiv && unlockedContent) welcomeMessageDiv = unlockedContent.querySelector('.welcome-message');
    if (!logoutButton && welcomeMessageDiv) logoutButton = welcomeMessageDiv.querySelector('#logoutButton');

    if (authPromptSection) {
        authPromptSection.classList.add('hidden');
        authPromptSection.style.display = 'none';
    }
    if (unlockedContent) {
        unlockedContent.classList.remove('hidden');
        unlockedContent.style.display = 'block';
    }
    if (welcomeMessageDiv && user) {
        const p = welcomeMessageDiv.querySelector('p');
        if (p) {
            let textNodeFound = false;
            if (p.childNodes.length > 0) {
                for (let i = 0; i < p.childNodes.length; i++) {
                    if (p.childNodes[i].nodeType === Node.TEXT_NODE) {
                        p.childNodes[i].nodeValue = `Welcome, ${user.email}! You can now access the setup guide. `;
                        textNodeFound = true;
                        break;
                    }
                }
            }
            if (!textNodeFound) {
                p.innerHTML = `Welcome, ${user.email}! You can now access the setup guide. `;
                if (logoutButton) {
                    p.appendChild(logoutButton);
                }
            } else if (logoutButton && !p.contains(logoutButton)) {
                 p.appendChild(logoutButton);
            }
        }
    }
    if (window.amplitude && user) {
        window.amplitude.logEvent('Instructions Viewed', { user_id: user.id });
    }
}
function showLockedContentUI() {
    if (!authPromptSection) authPromptSection = document.getElementById('auth-prompt-section');
    if (!unlockedContent) unlockedContent = document.getElementById('unlocked-content');

    if (authPromptSection) {
        authPromptSection.classList.remove('hidden');
        authPromptSection.style.display = 'block';
    }
    if (unlockedContent) {
        unlockedContent.classList.add('hidden');
        unlockedContent.style.display = 'none';
    }
    if (signupModal) hideModal(signupModal);
    if (loginModal) hideModal(loginModal);
}

// --- Profile Creation (called after successful signup) ---
async function createUserProfile(user, name, phone_number) {
    if (!user || !supabaseClient) return;
    try {
        const profileData = {
            id: user.id,
            email: user.email,
            name: name.trim(), // Name is now required by the form
            phone_number: phone_number.trim() // Phone is now required by the form
        };

        const { error } = await supabaseClient
            .from('profiles')
            .insert(profileData);

        if (error) {
            if (error.code === '23505') {
                 console.warn('Profile already exists for user:', user.id);
            } else {
                throw error;
            }
        } else {
            console.log('Profile created for user:', user.id, 'with data:', profileData);
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
    const name = signupForm.signupName.value;
    const phone_number = signupForm.signupPhone.value;

    const submitButton = signupForm.querySelector('button[type="submit"]');

    showButtonLoadingState(submitButton, true, "Sign Up", "Signing Up...");
    signupMessage.textContent = '';
    signupMessage.className = 'form-message';

    // Data to be stored in auth.users.raw_user_meta_data
    const userMetaData = {
        name: name.trim(), // Name is required
        phone_number: phone_number.trim() // Phone is required
    };

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: userMetaData
        }
    });

    if (error) {
        signupMessage.textContent = "Signup failed: " + error.message;
        signupMessage.classList.add('error');
        if (window.amplitude) {
            window.amplitude.logEvent('Signup Failed', { error_message: error.message, email: email });
        }
    } else if (data.user) {
        await createUserProfile(data.user, name, phone_number);

        signupMessage.textContent = "Signup successful! If email confirmation is enabled, please check your email. Otherwise, you might be logged in.";
        signupMessage.classList.add('success');
        if (window.amplitude) {
            window.amplitude.logEvent('Signup Succeeded', { user_id: data.user.id, email: data.user.email });
            window.amplitude.setUserId(data.user.id);
            const identifyObj = new amplitude.Identify()
                .set('email', data.user.email)
                .set('name', name.trim())
                .set('phone_number_provided', true); // Since it's required
            window.amplitude.identify(identifyObj);
        }
        setTimeout(() => {
            hideModal(signupModal);
        }, 2500);
    } else {
        signupMessage.textContent = "Signup seems to have completed, but no user data was returned. Please try logging in or check your email.";
        signupMessage.classList.add('info');
         if (window.amplitude) {
            window.amplitude.logEvent('Signup Anomaly', { email: email });
        }
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
        if (window.amplitude) {
            window.amplitude.logEvent('Login Failed', { email: email, error_message: error.message });
        }
    } else if (data.user) {
        hideModal(loginModal);
        if (window.amplitude) {
            window.amplitude.logEvent('Login Succeeded', { user_id: data.user.id, email: data.user.email });
            window.amplitude.setUserId(data.user.id);

            // Attempt to fetch name from profiles to enrich Amplitude identity
            // This is an optimistic enrichment.
            try {
                const { data: profileData, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select('name')
                    .eq('id', data.user.id)
                    .single();

                const identifyObj = new amplitude.Identify().set('email', data.user.email);
                if (!profileError && profileData && profileData.name) {
                    identifyObj.set('name', profileData.name);
                }
                window.amplitude.identify(identifyObj);

            } catch (e) {
                console.warn("Could not fetch profile name for Amplitude on login:", e);
                // Fallback to just email if profile fetch fails
                window.amplitude.identify(new amplitude.Identify().set('email', data.user.email));
            }
        }
    }
    showButtonLoadingState(submitButton, false, "Log In");
}

async function handleLogout() {
    if (!supabaseClient) return;
    let userIdForEvent = null;
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) userIdForEvent = user.id;
    } catch(e) { /* ignore */ }

    if (window.amplitude && userIdForEvent) {
        window.amplitude.logEvent('Logout', { user_id: userIdForEvent });
    }

    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert('Logout failed: ' + error.message);
    }

    if (window.amplitude) {
        window.amplitude.setUserId(null);
        window.amplitude.regenerateDeviceId();
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
        if (window.amplitude) {
            window.amplitude.logEvent('Password Reset Requested Failed', { email: email, error_message: error.message });
        }
    } else {
        loginMessage.textContent = "Password reset instructions sent to your email.";
        loginMessage.className = 'form-message success';
        if (window.amplitude) {
            window.amplitude.logEvent('Password Reset Requested', { email: email });
        }
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

    if (sessionStorage.getItem('instructionsAccessGranted') === 'true') {
        initializeInstructionsApp();
    } else {
        const currentPath = window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1);
        if (currentPath === 'home.html') {
            window.location.href = '/'; // Or 'index.html' if server doesn't default to it
            return;
        }
        else if (currentPath !== '' && currentPath !== 'index.html') {
             window.location.href = '/'; // Or 'index.html'
             return;
        }
        // If on index.html (gate page), its own script handles its UI.
        // This app.js is mainly for home.html, so hide its content if loaded on gate page.
        if (authPromptSection) {
            authPromptSection.classList.add('hidden');
            authPromptSection.style.display = 'none';
        }
        if (unlockedContent) {
            unlockedContent.classList.add('hidden');
            unlockedContent.style.display = 'none';
        }
    }
});

function initializeInstructionsApp() {
    console.log("Instructions app initializing after gate pass (app.js)...");

    // Ensure correct initial UI state before auth check
    if (authPromptSection) {
        authPromptSection.classList.remove('hidden');
        authPromptSection.style.display = 'block'; // Show by default, auth check will hide if needed
    }
    if (unlockedContent) {
        unlockedContent.classList.add('hidden');
        unlockedContent.style.display = 'none'; // Hide by default, auth check will show if needed
    }


    if (showSignupModalBtn) showSignupModalBtn.addEventListener('click', () => {
        hideModal(loginModal); showModal(signupModal);
        if(signupMessage) signupMessage.textContent = '';
        if(signupForm) signupForm.reset();
        if (window.amplitude) window.amplitude.logEvent('Show Signup Modal');
    });
    if (showLoginModalBtn) showLoginModalBtn.addEventListener('click', () => {
        hideModal(signupModal); showModal(loginModal);
        if(loginMessage) loginMessage.textContent = '';
        if(loginForm) loginForm.reset();
        if (window.amplitude) window.amplitude.logEvent('Show Login Modal');
    });

    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            hideModal(modal);
            if (window.amplitude) window.amplitude.logEvent('Modal Closed (X Button)', { modal_id: modal.id });
        });
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                hideModal(modal);
                if (window.amplitude) window.amplitude.logEvent('Modal Closed (Background Click)', { modal_id: modal.id });
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
            if (window.amplitude) window.amplitude.logEvent('Switched to Login Modal (from Signup)');
        });
    }
    if (switchToSignupLinkFromLogin) {
        switchToSignupLinkFromLogin.addEventListener('click', (e) => {
            e.preventDefault(); hideModal(loginModal); showModal(signupModal);
            if(signupMessage) signupMessage.textContent = ''; if(signupForm) signupForm.reset();
            if (window.amplitude) window.amplitude.logEvent('Switched to Signup Modal (from Login)');
        });
    }

    // Amplitude default tracking for file downloads should handle this if enabled
    // const downloadButton = document.querySelector('a.download-button[href="code.gs"]');
    // if (downloadButton) {
    //     downloadButton.addEventListener('click', () => {
    //         // if (window.amplitude) {
    //         //     window.amplitude.logEvent('Script Download Clicked', { filename: 'code.gs' });
    //         // }
    //     });
    // }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        console.log('Auth state changed (Instructions Page - Email/Pass):', _event, session);
        if (session && session.user) {
            showUnlockedContentUI(session.user);
            if ((_event === 'SIGNED_IN' || _event === 'USER_UPDATED' || _event === 'INITIAL_SESSION') && window.amplitude) {
                 window.amplitude.setUserId(session.user.id);
                 // Attempt to fetch profile name for Amplitude identify
                 try {
                    const { data: profileData, error: profileError } = await supabaseClient
                        .from('profiles')
                        .select('name')
                        .eq('id', session.user.id)
                        .single();

                    const identifyObj = new amplitude.Identify().set('email', session.user.email);
                    if (!profileError && profileData && profileData.name) {
                        identifyObj.set('name', profileData.name);
                    }
                    window.amplitude.identify(identifyObj);

                } catch (e) {
                    console.warn("Could not fetch profile name for Amplitude on auth change:", e);
                    window.amplitude.identify(new amplitude.Identify().set('email', session.user.email)); // Fallback
                }
            }
        } else {
            showLockedContentUI();
            if (_event === 'SIGNED_OUT' && window.amplitude) {
                window.amplitude.setUserId(null);
                window.amplitude.regenerateDeviceId();
            }
        }
    });

    async function initialSessionCheck() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            console.log('Initial session valid for:', session.user.email);
            showUnlockedContentUI(session.user); // This will also trigger Amplitude event if user is logged in
            if (window.amplitude) {
                window.amplitude.setUserId(session.user.id);
                 // Attempt to fetch profile name for Amplitude identify
                 try {
                    const { data: profileData, error: profileError } = await supabaseClient
                        .from('profiles')
                        .select('name')
                        .eq('id', session.user.id)
                        .single();

                    const identifyObj = new amplitude.Identify().set('email', session.user.email);
                    if (!profileError && profileData && profileData.name) {
                        identifyObj.set('name', profileData.name);
                    }
                    window.amplitude.identify(identifyObj);
                } catch (e) {
                    console.warn("Could not fetch profile name for Amplitude on initial session check:", e);
                    window.amplitude.identify(new amplitude.Identify().set('email', session.user.email)); // Fallback
                }
            }
        } else {
            console.log('No initial valid session.');
            showLockedContentUI();
        }
    }
    initialSessionCheck();
}