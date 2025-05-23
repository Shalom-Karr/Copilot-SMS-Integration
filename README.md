# GroupMe Copilot Image Bot - Setup Instructions Page

This project is a static web page designed to provide setup instructions for the "GroupMe Copilot Image Bot". Access to the instructions is gated: users must sign up or log in using email and password authentication, powered by Supabase. The page also integrates Cloudflare Turnstile for bot protection on authentication forms.

## Features

*   **User Authentication:**
    *   Email/Password Signup
    *   Email/Password Login
    *   Logout
    *   Forgot Password (sends reset link via Supabase)
*   **Content Gating:** Setup instructions are hidden until a user is authenticated.
*   **Supabase Integration:** Uses Supabase for authentication and (a simple) user profile storage.
*   **Cloudflare Turnstile:** Protects signup and login forms from bots.
*   **Script Download:** Provides a download link for the `Code.gs` Google Apps Script file.
*   **Responsive Design:** Basic responsive styling for usability on different devices.
*   **Step-by-Step Guide:** The core content of the page, detailing how to set up the GroupMe bot.

## Tech Stack

*   **Frontend:**
    *   HTML
    *   CSS
    *   Vanilla JavaScript (`app.js`)
*   **Backend-as-a-Service (BaaS):**
    *   **Supabase:** For Authentication (Auth) and Database (for basic profiles).
*   **Security:**
    *   **Cloudflare Turnstile:** CAPTCHA alternative.

## Files

*   `index.html`: The main HTML structure of the page, including modals and content sections.
*   `style.css`: CSS for styling the page.
*   `app.js`: JavaScript for handling Supabase authentication, UI updates, modal interactions, and form submissions.
*   `Code.gs` (Referenced): This is the Google Apps Script file users need to download. It's not part of this web page's direct execution but is a crucial deliverable. **You must provide this file in the same directory as `index.html` for the download link to work.**

## Prerequisites for This Instruction Page Project

1.  **Supabase Account & Project:**
    *   Sign up at [supabase.com](https://supabase.com/).
    *   Create a new project.
2.  **Cloudflare Account & Turnstile Site:**
    *   Sign up at [cloudflare.com](https://cloudflare.com/).
    *   Create a new Turnstile site to get a Site Key.
3.  **Web Server/Hosting:** To serve the HTML, CSS, and JS files (e.g., Live Server for local development, Netlify, Vercel, GitHub Pages for deployment).
4.  **`Code.gs` file:** The actual Google Apps Script file that the instructions guide users to set up. This file should be placed in the root directory so it can be downloaded.

## Setup and Configuration

1.  **Clone or Download this Repository/Files.**

2.  **Configure Supabase:**
    *   In your Supabase project dashboard:
        *   Go to **Project Settings** > **API**.
        *   Find your **Project URL** and **anon Public Key**.
    *   Open `app.js`:
        *   Update `SUPABASE_URL` with your Project URL.
        *   Update `SUPABASE_ANON_KEY` with your anon Public Key.
    *   In your Supabase project dashboard:
        *   Go to **Authentication** > **Providers**.
        *   Ensure **Email** provider is enabled. You can configure settings like "Enable email confirmations" if desired.
        *   (Optional but recommended) Go to **Authentication** > **URL Configuration** and set your **Site URL**. This is used for email confirmation links, password reset links, etc. For local development, it might be `http://localhost:PORT` or `http://127.0.0.1:PORT`. For production, it's your live site URL.
        *   (Optional but recommended) Go to **Authentication** > **Email Templates** to customize the content of confirmation, password reset, and other emails.
    *   **Create `profiles` Table in Supabase:**
        The `app.js` script attempts to create a profile for new users. You need a `profiles` table.
        *   Go to **Table Editor** in your Supabase dashboard.
        *   Click **+ New table**.
        *   Table name: `profiles`
        *   Enable "Row Level Security (RLS)" if you plan to expand on this (for this basic setup, it might not be strictly necessary, but it's good practice).
        *   Columns:
            *   `id` (type: `uuid`, Primary Key: `true`, Default Value: `uuid_generate_v4()`, Is Unique: `true`, Is Nullable: `false`). **Crucially, set this up as a foreign key to `auth.users.id`**: Click the link icon, select `auth` schema, `users` table, `id` column.
            *   `email` (type: `text`, Is Nullable: `true` or `false` as per your needs).
            *   (Optional) `created_at` (type: `timestamp with time zone`, Default Value: `now()`)
            *   (Optional) `updated_at` (type: `timestamp with time zone`, Default Value: `now()`)
        *   If RLS is enabled, you'll need to create policies. For a simple start where authenticated users can see their own profile and insert their own:
            *   Policy for SELECT: `(auth.uid() = id)` - Target roles: `authenticated`
            *   Policy for INSERT: `(auth.uid() = id)` - Target roles: `authenticated`

3.  **Configure Cloudflare Turnstile:**
    *   In your Cloudflare dashboard, after creating a Turnstile site, get your **Site Key**.
    *   Open `index.html`:
    *   Find the Turnstile widget divs:
        ```html
        <div class="cf-turnstile" id="signup-turnstile-widget" data-sitekey="0x4AAAAAABeUvDgLI36t5lu-"></div>
        <div class="cf-turnstile" id="login-turnstile-widget" data-sitekey="0x4AAAAAABeUvDgLI36t5lu-"></div>
        ```
    *   Replace `0x4AAAAAABeUvDgLI36t5lu-` with **your actual Cloudflare Turnstile Site Key** in both places.
        *Note: The `app.js` currently doesn't verify the Turnstile token server-side with Supabase Edge Functions. For enhanced security, you would typically send the `cf-turnstile-response` token from the client to a Supabase Edge Function, verify it with Cloudflare's `siteverify` endpoint using your Turnstile Secret Key, and only then proceed with the Supabase auth operation. This example relies on client-side Turnstile widget rendering.*

4.  **Place `Code.gs` File:**
    *   Ensure the `Code.gs` file (the script users will download) is in the same directory as `index.html`. The download link in `index.html` is:
        `<a href="Code.gs" download="Code-GS.txt" class="download-button">`

## Running Locally

1.  Make sure all configuration steps above are complete.
2.  Serve the `index.html` file using a local web server. A simple way is using VS Code's "Live Server" extension.
    Alternatively, using Node.js:
    ```bash
    npx live-server
    # or
    # python -m http.server (for Python 3)
    ```
3.  Open your browser and navigate to the local address (e.g., `http://127.0.0.1:5500` or `http://localhost:8000`).

## How It Works

1.  When a user visits `index.html`, `app.js` initializes the Supabase client.
2.  It checks for an existing Supabase session.
    *   If a session exists, the `unlocked-content` section is shown, displaying the instructions and user's email.
    *   If no session exists, the `auth-prompt-section` is shown, prompting the user to sign up or log in.
3.  **Signup:**
    *   User clicks "Sign Up", modal appears.
    *   User fills email, password, and completes Turnstile.
    *   On submit, `app.js` calls `supabaseClient.auth.signUp()`.
    *   If successful and email confirmation is NOT required by Supabase, a session starts.
    *   The `createUserProfile` function is called to insert a record into the `profiles` table.
    *   `onAuthStateChange` listener detects the new session and shows unlocked content.
4.  **Login:**
    *   User clicks "Log In", modal appears.
    *   User fills email, password, and completes Turnstile.
    *   On submit, `app.js` calls `supabaseClient.auth.signInWithPassword()`.
    *   If successful, a session starts.
    *   `onAuthStateChange` listener detects the new session and shows unlocked content.
5.  **Logout:**
    *   User clicks "Logout" button.
    *   `app.js` calls `supabaseClient.auth.signOut()`.
    *   `onAuthStateChange` listener detects session end and shows the auth prompt.
6.  **Forgot Password:**
    *   User clicks "Forgot Password?" link.
    *   Enters email.
    *   `app.js` calls `supabaseClient.auth.resetPasswordForEmail()`.
    *   Supabase sends a password reset link to the user's email (using the Site URL configured in Supabase).

## Deployment

Since this is a static site (HTML, CSS, JS) with BaaS (Supabase), you can deploy it to any static site hosting provider:

*   Netlify
*   Vercel
*   GitHub Pages
*   AWS S3 + CloudFront
*   etc.

Ensure your Supabase project's Site URL (Authentication > URL Configuration) is updated to your live production URL.

## Important Considerations

*   **Supabase Anon Key:** The `SUPABASE_ANON_KEY` is designed to be public and used in client-side applications. It allows access based on your Row Level Security (RLS) policies.
*   **Turnstile Secret Key:** For full Turnstile validation, the Secret Key must be used server-side (e.g., in a Supabase Edge Function), which is not implemented in this basic example. This example relies on the client-side widget discouraging basic bots.
*   **Error Handling:** The `app.js` includes basic error handling and message display for auth operations.
*   **`Code.gs` File:** The content and functionality of `Code.gs` are separate from this instruction page project. This project only serves as a gateway to its download and setup guide.
