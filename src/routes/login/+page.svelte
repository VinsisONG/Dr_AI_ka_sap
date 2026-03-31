<script>
  // @ts-nocheck
  import { enhance } from "$app/forms";

  /** @type {import('./$types').ActionData} */
  let { form } = $props();
  let mode = $state("login");
  let loading = $state(false);

  const getValue = (field) => form?.values?.[field] ?? "";

  $effect(() => {
    if (form?.mode) {
      mode = form.mode;
    }
  });
</script>

<div class="auth-page">
  <div class="auth-card">
    <div class="brand">
      <div class="brand-icon">⚕</div>
      <h1>Dr. AI ka sap</h1>
      <p class="brand-sub">Injury support for athletes</p>
    </div>

    <!-- Tab toggle -->
    <div class="tab-row">
      <button
        class="tab"
        class:active={mode === "login"}
        onclick={() => (mode = "login")}>Log In</button
      >
      <button
        class="tab"
        class:active={mode === "signup"}
        onclick={() => (mode = "signup")}>Sign Up</button
      >
    </div>

    <!-- Error / success messages from server -->
    {#if form?.error && (!form?.mode || form.mode === mode)}
      <p class="msg error">{form.error}</p>
    {/if}
    {#if form?.success && (!form?.mode || form.mode === mode)}
      <p class="msg success">{form.success}</p>
    {/if}

    <!-- Login form -->
    {#if mode === "login"}
      <form
        method="POST"
        action="?/login"
        use:enhance={() => {
          loading = true;
          return async ({ update }) => {
            await update();
            loading = false;
          };
        }}
      >
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={getValue("email")}
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="submit-btn" disabled={loading}>
          {loading ? "Logging in…" : "Log In"}
        </button>

        <button
          type="button"
          class="link-btn"
          onclick={() => (mode = "forgot")}
        >
          Forgot password?
        </button>
      </form>
    {/if}

    <!-- Sign up form -->
    {#if mode === "signup"}
      <form
        method="POST"
        action="?/signup"
        use:enhance={() => {
          loading = true;
          return async ({ update }) => {
            await update();
            loading = false;
          };
        }}
      >
        <div class="field">
          <label for="su-email">Email</label>
          <input
            id="su-email"
            name="email"
            type="email"
            value={getValue("email")}
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="field two-up">
          <div>
            <label for="su-city">City</label>
            <input
              id="su-city"
              name="city"
              type="text"
              value={getValue("city")}
              placeholder="Riga"
              required
              autocomplete="address-level2"
            />
          </div>

          <div>
            <label for="su-country">Country</label>
            <input
              id="su-country"
              name="country"
              type="text"
              value={getValue("country")}
              placeholder="Latvia"
              required
              autocomplete="country-name"
            />
          </div>
        </div>

        <div class="field">
          <label for="su-password">Password</label>
          <input
            id="su-password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            minlength="8"
            required
            autocomplete="new-password"
          />
        </div>

        <div class="field">
          <label for="su-confirm">Confirm Password</label>
          <input
            id="su-confirm"
            name="confirm"
            type="password"
            placeholder="Repeat your password"
            minlength="8"
            required
            autocomplete="new-password"
          />
        </div>

        <button type="submit" class="submit-btn" disabled={loading}>
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>
    {/if}

    <!-- Forgot password -->
    {#if mode === "forgot"}
      <form
        method="POST"
        action="?/forgot"
        use:enhance={() => {
          loading = true;
          return async ({ update }) => {
            await update();
            loading = false;
          };
        }}
      >
        <p class="forgot-hint">
          Enter your email and we'll send you a reset link.
        </p>

        <div class="field">
          <label for="reset-email">Email</label>
          <input
            id="reset-email"
            name="email"
            type="email"
            value={getValue("email")}
            placeholder="you@example.com"
            required
          />
        </div>

        <button type="submit" class="submit-btn" disabled={loading}>
          {loading ? "Sending…" : "Send Reset Link"}
        </button>

        <button type="button" class="link-btn" onclick={() => (mode = "login")}>
          ← Back to log in
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :global(body) {
    font-family: "Georgia", serif;
    background: #f0ede8;
    color: #1a1a1a;
    min-height: 100vh;
  }

  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .auth-card {
    background: #fff;
    border: 1px solid #ddd8d0;
    border-radius: 16px;
    padding: 40px 36px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* ── Brand ── */
  .brand {
    text-align: center;
  }
  .brand-icon {
    font-size: 2.2rem;
    margin-bottom: 8px;
  }
  .brand h1 {
    font-size: 1.6rem;
    font-weight: normal;
    letter-spacing: -0.02em;
    color: #1a1a1a;
  }
  .brand-sub {
    font-size: 0.82rem;
    color: #7a7570;
    margin-top: 4px;
  }

  /* ── Tabs ── */
  .tab-row {
    display: flex;
    background: #f0ede8;
    border-radius: 8px;
    padding: 4px;
    gap: 4px;
  }
  .tab {
    flex: 1;
    background: none;
    border: none;
    border-radius: 6px;
    padding: 9px;
    font-family: inherit;
    font-size: 0.88rem;
    color: #7a7570;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tab.active {
    background: #fff;
    color: #1a1a1a;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  }

  /* ── Messages ── */
  .msg {
    font-size: 0.85rem;
    padding: 10px 14px;
    border-radius: 8px;
    text-align: center;
  }
  .msg.error {
    background: #fdf0f0;
    color: #b04040;
  }
  .msg.success {
    background: #eef4f0;
    color: #2b6a4a;
  }

  /* ── Form fields ── */
  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field.two-up {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .field.two-up > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field label {
    font-size: 0.75rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #7a7570;
  }
  .field input {
    border: 1px solid #ddd8d0;
    border-radius: 8px;
    padding: 11px 14px;
    font-family: inherit;
    font-size: 0.92rem;
    color: #1a1a1a;
    background: #fafaf8;
    outline: none;
    transition: border-color 0.2s;
  }
  .field input:focus {
    border-color: #2b4a3e;
    background: #fff;
  }

  /* ── Buttons ── */
  .submit-btn {
    width: 100%;
    background: #2b4a3e;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 13px;
    font-family: inherit;
    font-size: 0.95rem;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: opacity 0.15s;
    margin-top: 4px;
  }
  .submit-btn:hover:not(:disabled) {
    opacity: 0.88;
  }
  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .link-btn {
    background: none;
    border: none;
    color: #7a7570;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    text-align: center;
    text-decoration: underline;
    padding: 0;
    transition: color 0.15s;
  }
  .link-btn:hover {
    color: #2b4a3e;
  }

  .forgot-hint {
    font-size: 0.87rem;
    color: #7a7570;
    text-align: center;
    line-height: 1.5;
  }

  @media (max-width: 560px) {
    .auth-card {
      padding: 32px 22px;
    }

    .field.two-up {
      grid-template-columns: 1fr;
    }
  }
</style>
