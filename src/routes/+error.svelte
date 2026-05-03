<script>
  // @ts-nocheck
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  let { status } = $props();

  let homeHref = $derived(page.data?.viewer ? resolve("/app") : resolve("/"));
  let title = $derived(status === 404 ? "Error 404" : "Something went wrong");
  let summary = $derived(
    status === 404
      ? "The page you asked for does not exist."
      : "An unexpected error interrupted this request."
  );
</script>

<svelte:head>
  <title>{title} | Dr. AI ka sap</title>
</svelte:head>

<a class="home-link" href={homeHref}>Home</a>

<main class="error-page">
  <div class="error-shell">
    <p class="eyebrow">Navigation</p>
    <h1>{title}</h1>
    <p class="summary">{summary}</p>
  </div>
</main>

<style>
  .home-link {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 10;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 8px;
    background: #6e0505;
    color: #fff3f3;
    text-decoration: none;
    font: inherit;
    box-shadow: 0 12px 30px rgba(27, 16, 16, 0.18);
  }

  .home-link:hover {
    background: #8b1a1a;
  }

  .error-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    font-family: "Georgia", serif;
    background:
      radial-gradient(circle at top left, rgba(110, 5, 5, 0.18), transparent 34%),
      linear-gradient(135deg, #161112 0%, #241c1d 48%, #1d1718 100%);
    color: #f2e9e9;
  }

  .error-shell {
    width: min(760px, 100%);
    padding: 40px 36px;
    border-radius: 28px;
    border: 1px solid #433233;
    background: color-mix(in srgb, #241c1d 92%, transparent);
    box-shadow: 0 20px 48px rgba(27, 16, 16, 0.24);
  }

  .eyebrow {
    margin: 0 0 12px;
    font-size: 0.78rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #baa8a8;
  }

  h1 {
    margin: 0;
    font-size: clamp(2.8rem, 8vw, 5.2rem);
    line-height: 0.94;
    letter-spacing: -0.05em;
    color: #d29c9c;
  }

  .summary {
    margin: 18px 0 0;
    max-width: 32rem;
    font-size: 1.05rem;
    line-height: 1.75;
    color: #f2e9e9;
  }

  @media (max-width: 640px) {
    .home-link {
      top: 12px;
      left: 12px;
    }

    .error-page {
      padding: 16px;
    }

    .error-shell {
      padding: 32px 24px;
    }
  }
</style>
