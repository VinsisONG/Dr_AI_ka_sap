<script>
  import { resolve } from "$app/paths";
</script>

<svelte:head>
  <title>Dr. AI ka sap</title>
  <meta
    name="description"
    content="Injury support for athletes with a simple path to log in, sign up, and review your recovery guidance."
  />
</svelte:head>

<main class="landing-page">
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">Dr. AI ka sap</p>
      <h1>Injury support for athletes who need clear next steps.</h1>
      <p class="summary">
        Find out injury prevention steps before an appointment.
      </p>

      <div class="actions">
        <a class="button primary" href={resolve("/login?mode=login")}>Log In</a>
        <a class="button secondary" href={resolve("/login?mode=signup")}>Sign Up</a>
      </div>
    </div>

    <div class="preview-box" aria-label="Screenshot placeholder">
      <div class="preview-frame">
        <p class="preview-label">App Screenshot</p>
        <p class="preview-note">Add your product image here later.</p>
      </div>
    </div>
  </section>
</main>

<style>
  .landing-page {
    width: 100%;
    min-height: 100vh;
    padding: 32px;
    display: grid;
    place-items: center;
    font-family: Georgia, serif;
    color: #261717;
    background: radial-gradient(
        circle at top left,
        rgba(140, 48, 48, 0.16),
        transparent 34%
      ),
      linear-gradient(135deg, #f6f0eb 0%, #efe4dc 48%, #f9f5f1 100%);
  }

  .hero {
    width: min(1120px, 100%);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 480px);
    gap: 48px;
    align-items: center;
  }

  .hero-copy {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .eyebrow {
    margin: 0;
    font-size: 0.82rem;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #7f5f5f;
  }

  h1 {
    margin: 0;
    font-size: clamp(3rem, 6vw, 5.8rem);
    line-height: 0.94;
    letter-spacing: -0.05em;
    max-width: 12ch;
  }

  .summary {
    margin: 0;
    max-width: 34rem;
    font-size: 1.08rem;
    line-height: 1.75;
    color: #5f4949;
  }

  .actions {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    padding-top: 10px;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 150px;
    padding: 14px 22px;
    border-radius: 999px;
    border: 1px solid transparent;
    text-decoration: none;
    font-size: 0.95rem;
    letter-spacing: 0.03em;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease,
      box-shadow 0.18s ease;
  }

  .button.primary {
    background: #6a1f1f;
    color: #fff8f6;
    box-shadow: 0 16px 30px rgba(106, 31, 31, 0.18);
  }

  .button.secondary {
    border-color: rgba(83, 35, 35, 0.16);
    background: rgba(255, 255, 255, 0.58);
    color: #4c2b2b;
  }

  .preview-box {
    min-height: 520px;
    padding: 18px;
    border-radius: 32px;
    background: rgba(103, 57, 57, 0.08);
    border: 1px solid rgba(96, 48, 48, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }

  .preview-frame {
    height: 100%;
    min-height: 484px;
    border-radius: 24px;
    border: 2px dashed rgba(106, 31, 31, 0.24);
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.8),
        rgba(248, 238, 231, 0.92)
      ),
      linear-gradient(135deg, rgba(255, 255, 255, 0.4), transparent);
    display: grid;
    place-content: center;
    text-align: center;
    padding: 24px;
  }

  .preview-label {
    margin: 0;
    font-size: 0.84rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #7f5f5f;
  }

  .preview-note {
    margin: 12px 0 0;
    font-size: 1.1rem;
    line-height: 1.6;
    color: #5a4040;
  }

  @media (max-width: 860px) {
    .landing-page {
      padding: 24px;
    }

    .hero {
      grid-template-columns: 1fr;
      gap: 32px;
    }

    h1 {
      max-width: none;
      font-size: clamp(2.6rem, 13vw, 4.6rem);
    }

    .preview-box {
      min-height: 360px;
    }

    .preview-frame {
      min-height: 324px;
    }
  }
</style>
