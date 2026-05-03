<script>
  // @ts-nocheck
  import { resolve } from "$app/paths";
  import { enhance } from "$app/forms";
  import { page } from "$app/state";

  /** @type {import('./$types').ActionData} */
  let { form } = $props();

  const getModeFromUrl = () => {
    const requested = page.url.searchParams.get("mode");
    return requested === "signup" || requested === "forgot" ? requested : "login";
  };

  let mode = $state(getModeFromUrl());
  let loading = $state(false);

  const getValue = (field) => form?.values?.[field] ?? "";

  $effect(() => {
    if (form?.mode) {
      mode = form.mode;
      return;
    }

    mode = getModeFromUrl();
  });
</script>

<div class="auth-page">
  <div class="auth-card">
    <div class="brand">
      <div class="brand-icon">+</div>
      <h1>Dr. AI ka sap</h1>
      <p class="brand-sub">Injury support for athletes</p>
    </div>

    <div class="tab-row">
      <a class="tab" class:active={mode === "login"} href={resolve("/login?mode=login")}>
        Log In
      </a>
      <a class="tab" class:active={mode === "signup"} href={resolve("/login?mode=signup")}>
        Sign Up
      </a>
    </div>

    {#if form?.error && (!form?.mode || form.mode === mode)}
      <p class="msg error">{form.error}</p>
    {/if}
    {#if form?.success && (!form?.mode || form.mode === mode)}
      <p class="msg success">{form.success}</p>
    {/if}

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
            placeholder="........"
            required
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="submit-btn" disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </button>

        <a class="link-btn" href={resolve("/login?mode=forgot")}>Forgot password?</a>
      </form>
    {/if}

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
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    {/if}

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
          Enter your email and we will send you a reset link.
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
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <a class="link-btn" href={resolve("/login?mode=login")}>Back to log in</a>
      </form>
    {/if}
  </div>
</div>

<style>
  .auth-page {
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: "Georgia", serif;
    color: #1a1a1a;
    background: #f0ede8;
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

  .tab-row {
    display: flex;
    background: #f0ede8;
    border-radius: 8px;
    padding: 4px;
    gap: 4px;
  }

  .tab {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border-radius: 6px;
    padding: 9px;
    font-family: inherit;
    font-size: 0.88rem;
    color: #7a7570;
    text-decoration: none;
    transition: all 0.15s;
  }

  .tab.active {
    background: #fff;
    color: #1a1a1a;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  }

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
    display: inline-block;
    color: #7a7570;
    font-family: inherit;
    font-size: 0.85rem;
    text-align: center;
    text-decoration: underline;
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
