<script>
  // @ts-nocheck
  import { enhance } from "$app/forms";
  import BodyModelViewer from "$lib/components/BodyModelViewer.svelte";

  let { data, form } = $props();

  // ── Theme ──
  let theme = $state("system");
  $effect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
  });

  // ── Nav ──
  let navOpen = $state(false);
  function toggleNav() {
    navOpen = !navOpen;
  }
  function closeNav() {
    navOpen = false;
  }

  // ── Profile modal ──
  let profileOpen = $state(false);
  function openProfile() {
    profileOpen = true;
  }
  function closeProfile() {
    profileOpen = false;
  }

  // ── Chat ──
  let chatInput = $state("");
  let messages = $state([]);
  let chatContainer = $state(null);
  let isLoading = $state(false);
  let errorMsg = $state("");
  let streamingText = $state("");
  let isStreaming = $state(false);
  let painAreas = $state([]);

  // ── Parallax ──
  let mouseX = $state(0);
  let mouseY = $state(0);
  function handleMouseMove(e) {
    mouseX = -((e.clientX / window.innerWidth - 0.5) * 20);
    mouseY = -((e.clientY / window.innerHeight - 0.5) * 20);
  }

  // ── Word limit ──
  const MAX_CHARS = 1500;
  const PAIN_PREFIX = "Area of pain: ";
  let currentChars = $derived(() => chatInput.length);
  let overLimit = $derived(() => currentChars() > MAX_CHARS);
  let painSummary = $derived(
    () => `${PAIN_PREFIX}${painAreas.length ? painAreas.join("; ") : "None selected"}`
  );

  function syncPainAreasToChat(nextAreas) {
    painAreas = nextAreas;
  }

  function handlePainAreasChange(event) {
    syncPainAreasToChat(event.detail?.areas ?? []);
  }

  async function sendMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed || isLoading || isStreaming || overLimit()) return;
    const promptMessage = painAreas.length
      ? `${PAIN_PREFIX}${painAreas.join("; ")}\n${trimmed}`
      : trimmed;
    errorMsg = "";
    messages = [...messages, { role: "user", text: trimmed }];
    chatInput = "";
    isLoading = true;
    scrollChat();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: promptMessage,
          history: messages.slice(0, -1),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? "Unknown error");
      }
      const { reply } = await res.json();
      isLoading = false;
      await typewriterEffect(reply);
    } catch (e) {
      errorMsg = `Error: ${e.message}`;
      messages = messages.slice(0, -1);
      chatInput = trimmed;
      isLoading = false;
      isStreaming = false;
    }
  }

  async function typewriterEffect(fullText) {
    isStreaming = true;
    streamingText = "";
    scrollChat();
    for (let i = 0; i < fullText.length; i++) {
      streamingText += fullText[i];
      await sleep(fullText[i] === "." || fullText[i] === "," ? 40 : 18);
      scrollChat();
    }
    messages = [...messages, { role: "ai", text: fullText }];
    streamingText = "";
    isStreaming = false;
    scrollChat();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function scrollChat() {
    setTimeout(() => {
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 50);
  }
  function handleKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Profile data ──
  let nickname = $state("");
  let saved = $state(false);
  let saveError = $state("");
  let profileHydrated = $state(false);
  let saveTimer;

  const SPORT_LIST = [
    "Football",
    "Basketball",
    "Tennis",
    "Swimming",
    "Running",
    "Cycling",
    "Volleyball",
    "Martial Arts",
    "Gymnastics",
    "Hockey",
    "Baseball",
    "Rugby",
    "Skiing",
    "Weightlifting",
    "CrossFit",
    "Other",
  ];
  const REGULARITY = ["Every day", "Every other day", "Weekly", "Monthly"];
  const INTENSITY = [
    "Max",
    "High",
    "Medium High",
    "Comfortable",
    "Light",
    "Very Light",
  ];
  const COMMON_CONDITIONS = [
    "Heart problems",
    "Hypertension",
    "Asthma",
    "Weak bones / Osteoporosis",
    "Diabetes",
    "Common joint dislocation",
    "Common spraining",
    "Chronic back pain",
    "Knee problems",
    "Shoulder problems",
    "Concussion history",
    "Muscle tears",
  ];

  let sports = $state([]);
  function addSport() {
    sports = [
      ...sports,
      {
        name: SPORT_LIST[0],
        regularity: REGULARITY[2],
        intensity: INTENSITY[3],
      },
    ];
  }
  function removeSport(i) {
    sports = sports.filter((_, idx) => idx !== i);
  }
  function updateSport(i, k, v) {
    sports = sports.map((s, idx) => (idx === i ? { ...s, [k]: v } : s));
  }

  let selectedConditions = $state([]);
  let customCondition = $state("");
  function toggleCondition(c) {
    selectedConditions = selectedConditions.includes(c)
      ? selectedConditions.filter((x) => x !== c)
      : [...selectedConditions, c];
  }
  function addCustomCondition() {
    const t = customCondition.trim();
    if (t && !selectedConditions.includes(t))
      selectedConditions = [...selectedConditions, t];
    customCondition = "";
  }
  function removeCondition(c) {
    selectedConditions = selectedConditions.filter((x) => x !== c);
  }
  function handleCustomKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomCondition();
    }
  }

  let accountOpen = $state(false);
  let email = $state("");
  let city = $state("");
  let country = $state("");

  $effect(() => {
    if (!data.user || profileHydrated) return;

    const metadata = data.user.user_metadata ?? {};
    email = data.user.email ?? "";
    city = data.profile?.city ?? metadata.city ?? "";
    country = data.profile?.country ?? metadata.country ?? "";
    sports = Array.isArray(data.profile?.sports) ? data.profile.sports : [];
    selectedConditions = Array.isArray(data.profile?.problems)
      ? data.profile.problems
      : [];

    if (!nickname) {
      nickname = metadata.nickname ?? data.user.email?.split("@")[0] ?? "";
    }

    profileHydrated = true;
  });

  $effect(() => {
    if (form?.profileSaved) {
      showSavedState();
    } else if (form?.profileError) {
      saveError = form.profileError;
      saved = false;
    }
  });

  function showSavedState() {
    clearTimeout(saveTimer);
    saveError = "";
    saved = true;
    saveTimer = setTimeout(() => (saved = false), 2500);
  }

  function saveProfile() {
    saved = false;
    saveError = "";
  }
</script>

<!-- ── Overlays ── -->
{#if navOpen && !profileOpen}
  <div class="overlay" onclick={closeNav} aria-hidden="true"></div>
{/if}
{#if profileOpen}
  <div class="overlay" onclick={closeProfile} aria-hidden="true"></div>
{/if}

<!-- ── Sidebar ── -->
<nav class="sidebar" class:open={navOpen}>
  <button class="nav-toggle" onclick={toggleNav} aria-label="Toggle navigation">
    {#if navOpen}<span>✕</span>{:else}<span>☰</span>{/if}
  </button>

  {#if navOpen}
    <div class="nav-links">
      <a href="/" onclick={closeNav}>Home</a>
      <a href="/about" onclick={closeNav}>About</a>
      <a href="/services" onclick={closeNav}>Services</a>
      <a href="/contact" onclick={closeNav}>Contact</a>
    </div>
  {/if}

  <!-- Profile button pinned to bottom of sidebar -->
  <button class="profile-btn" onclick={openProfile} aria-label="Open profile">
    <div class="profile-avatar-small">
      {#if nickname}{nickname[0].toUpperCase()}{:else if email}{email[0].toUpperCase()}{:else}?{/if}
    </div>
    {#if navOpen}
      <span class="profile-label">{nickname || email || "Profile"}</span>
    {/if}
  </button>
</nav>

<!-- ── Main ── -->
<main onmousemove={handleMouseMove}>
  <div
    class="background-aura background-aura-left"
    style={`transform: translate(${mouseX * 1.2}px, ${mouseY * 1.2}px);`}
  ></div>
  <div
    class="background-aura background-aura-right"
    style={`transform: translate(${mouseX * -1.1}px, ${mouseY * -1.1}px);`}
  ></div>

  <section class="body-stage">
    <div class="body-copy">
      <p class="body-kicker">Interactive Anatomy</p>
      <h1>
        Pinpoint where it hurts before you ask the assistant what to do next.
      </h1>
      <p class="body-summary" style="">
        Rotate the body, zoom into a region, and switch on selection mode when
        you want to start marking painful muscle areas.
      </p>
    </div>

    <BodyModelViewer on:areaschange={handlePainAreasChange} />
  </section>

  <!-- ── Chatbox ── -->
  <div class="chatbox">
    <div class="chat-header">
      <span>Medical Assistant</span>
      <span class="powered-by">Gemini AI</span>
    </div>
    <div class="chat-messages" bind:this={chatContainer}>
      {#if messages.length === 0 && !isLoading && !isStreaming}
        <p class="chat-placeholder">Ask a health question to get started…</p>
      {/if}
      {#each messages as msg}
        <div class="message {msg.role}"><span>{msg.text}</span></div>
      {/each}
      {#if isStreaming}
        <div class="message ai">
          <span>{streamingText}<span class="cursor">▋</span></span>
        </div>
      {/if}
      {#if isLoading && !isStreaming}
        <div class="message ai loading">
          <span class="dot"></span><span class="dot"></span><span class="dot"
          ></span>
        </div>
      {/if}
      {#if errorMsg}
        <p class="error-msg">{errorMsg}</p>
      {/if}
    </div>
    <div class="chat-input-row">
      <div class="pain-summary-box" class:empty={painAreas.length === 0}>
        <span class="pain-summary-label">Area of pain:</span>
        <span class="pain-summary-text">
          {painAreas.length ? painAreas.join("; ") : "None selected"}
        </span>
      </div>
      <div class="textarea-wrapper">
        <textarea
          bind:value={chatInput}
          onkeydown={handleKeydown}
          placeholder="Type a message…"
          rows="2"
          disabled={isLoading || isStreaming}
          class:over-limit={overLimit()}
        ></textarea>
        <span class="char-count" class:over-limit={overLimit()}>
          {currentChars()}/{MAX_CHARS}
        </span>
      </div>
      <button
        onclick={sendMessage}
        aria-label="Send"
        disabled={isLoading ||
          isStreaming ||
          overLimit() ||
          chatInput.trim() === ""}>➤</button
      >
    </div>
  </div>
</main>

<!-- ── Profile Modal ── -->
{#if profileOpen}
  <div class="profile-modal" role="dialog" aria-modal="true">
    <div class="modal-header">
      <div class="modal-avatar">
        {#if nickname}{nickname[0].toUpperCase()}{:else if email}{email[0].toUpperCase()}{:else}:/{/if}
      </div>
      <div>
        <h1 class="modal-title">{nickname || email || "Your Profile"}</h1>
        <p class="modal-sub">Athlete · Injury Recovery</p>
      </div>
      <button class="close-btn" onclick={closeProfile} aria-label="Close"
        >✕</button
      >
    </div>

    <div class="modal-body">
      <!-- Nickname -->
      <section class="section">
        <h2 class="section-title">Name / Nickname</h2>
        <input
          class="text-input"
          type="text"
          placeholder="Enter your name or nickname"
          bind:value={nickname}
        />
      </section>

      <div class="divider"></div>

      <!-- Sports -->
      <section class="section">
        <div class="section-row">
          <h2 class="section-title">Sports</h2>
          <button class="add-btn" onclick={addSport}>+ Add Sport</button>
        </div>
        {#if sports.length === 0}
          <p class="empty-hint">No sports added yet.</p>
        {/if}
        {#each sports as sport, i}
          <div class="sport-row">
            <select
              class="select"
              value={sport.name}
              onchange={(e) => updateSport(i, "name", e.target.value)}
            >
              {#each SPORT_LIST as s}<option value={s}>{s}</option>{/each}
            </select>
            <select
              class="select"
              value={sport.regularity}
              onchange={(e) => updateSport(i, "regularity", e.target.value)}
            >
              {#each REGULARITY as r}<option value={r}>{r}</option>{/each}
            </select>
            <select
              class="select"
              value={sport.intensity}
              onchange={(e) => updateSport(i, "intensity", e.target.value)}
            >
              {#each INTENSITY as it}<option value={it}>{it}</option>{/each}
            </select>
            <button class="remove-btn" onclick={() => removeSport(i)}>✕</button>
          </div>
        {/each}
      </section>

      <div class="divider"></div>

      <!-- Medical -->
      <section class="section">
        <h2 class="section-title">Common / Medical Problems</h2>
        <div class="condition-grid">
          {#each COMMON_CONDITIONS as c}
            <button
              class="condition-chip"
              class:selected={selectedConditions.includes(c)}
              onclick={() => toggleCondition(c)}>{c}</button
            >
          {/each}
        </div>
        {#if selectedConditions.length > 0}
          <div class="selected-tags">
            {#each selectedConditions as c}
              <span class="tag"
                >{c}<button
                  class="tag-remove"
                  onclick={() => removeCondition(c)}>✕</button
                ></span
              >
            {/each}
          </div>
        {/if}
        <div class="custom-row">
          <input
            class="text-input"
            type="text"
            placeholder="Type a custom condition and press Enter…"
            bind:value={customCondition}
            onkeydown={handleCustomKeydown}
          />
          <button class="add-btn" onclick={addCustomCondition}>Add</button>
        </div>
      </section>

      <div class="divider"></div>

      <!-- Theme -->
      <section class="section">
        <h2 class="section-title">Theme</h2>
        <div class="theme-row">
          {#each [["light", "☀️ Light"], ["dark", "🌙 Dark"], ["system", "🖥 System"]] as [t, label]}
            <button
              class="theme-btn"
              class:active={theme === t}
              onclick={() => (theme = t)}>{label}</button
            >
          {/each}
        </div>
      </section>

      <div class="divider"></div>

      <!-- Account Info -->
      <section class="section">
        <button
          class="account-toggle"
          onclick={() => (accountOpen = !accountOpen)}
        >
          <span>Account Info</span>
          <span class="chevron" class:open={accountOpen}>›</span>
        </button>
        {#if accountOpen}
          <div class="account-info">
            <div>
              <p class="field-label">Email / Username</p>
              <p class="info-value">{email || "Not available"}</p>
            </div>
            <div class="city-country-row">
              <div class="field-group">
                <p class="field-label">City</p>
                <input
                  class="text-input"
                  name="city"
                  form="profile-form"
                  type="text"
                  placeholder="City"
                  bind:value={city}
                />
                <p class="info-value">{city || "—"}</p>
              </div>
              <div class="field-group">
                <p class="field-label">Country</p>
                <input
                  class="text-input"
                  name="country"
                  form="profile-form"
                  type="text"
                  placeholder="Country"
                  bind:value={country}
                />
                <p class="info-value">{country || "—"}</p>
              </div>
            </div>
            <p class="helper-text">
              Reset your password from the login screen after logging out.
            </p>
          </div>
        {/if}
      </section>

      <div class="divider"></div>

      <!-- Bottom actions -->
      <div class="bottom-actions">
        <form
          id="profile-form"
          method="POST"
          action="?/saveProfile"
          class="profile-save-form"
          use:enhance={() => {
            saveProfile();
            return async ({ result, update }) => {
              await update({ reset: false, invalidateAll: true });

              if (result.type === "success") {
                showSavedState();
              } else if (result.type === "failure") {
                saveError =
                  result.data?.profileError ??
                  "Profile details could not be saved. Please try again.";
              }
            };
          }}
        >
          <input type="hidden" name="sports" value={JSON.stringify(sports)} />
          <input
            type="hidden"
            name="problems"
            value={JSON.stringify(selectedConditions)}
          />
        </form>
        <button
          class="save-btn"
          type="submit"
          form="profile-form"
          onclick={saveProfile}
        >
          {#if saved}✓ Saved{:else}Save Profile{/if}
        </button>
        {#if saveError}
          <p class="save-error">{saveError}</p>
        {/if}
        <form method="POST" action="?/logout" class="logout-form">
          <button class="danger-btn" type="submit">Log Out</button>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :global(:root) {
    --bg: #f0ede8;
    --surface: #ffffff;
    --border: #ddd8d0;
    --text: #1a1a1a;
    --muted: #7a7570;
    --accent: #2b4a3e;
    --accent-lt: #e8f0ec;
    --danger: #b04040;
    --chip-bg: #ebe8e2;
    --chip-sel: #2b4a3e;
    --chip-sel-t: #ffffff;
  }
  :global([data-theme="dark"]) {
    --bg: #141a18;
    --surface: #1e2923;
    --border: #2e3d38;
    --text: #e8e8e0;
    --muted: #7a9e8e;
    --accent: #5aaf8a;
    --accent-lt: #1e3028;
    --danger: #e06060;
    --chip-bg: #2a3830;
    --chip-sel: #5aaf8a;
    --chip-sel-t: #0e1a14;
  }
  :global(body) {
    font-family: "Georgia", serif;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    overflow: hidden;
    transition:
      background 0.3s,
      color 0.3s;
  }

  /* ── Overlay ── */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 30;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* ── Sidebar ── */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 52px;
    background: #1c2a3a;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    transition: width 0.25s ease;
    overflow: hidden;
  }
  .sidebar.open {
    width: 220px;
  }

  .nav-toggle {
    background: none;
    border: none;
    color: #e8e8e0;
    font-size: 1.4rem;
    cursor: pointer;
    padding: 18px 16px;
    flex-shrink: 0;
    width: 52px;
    text-align: center;
    transition: color 0.2s;
  }
  .nav-toggle:hover {
    color: #a8d8b9;
  }

  .nav-links {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    width: 100%;
    animation: slideIn 0.2s ease;
  }
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .nav-links a {
    color: #c8d8e8;
    text-decoration: none;
    font-size: 0.95rem;
    padding: 10px 12px;
    border-radius: 6px;
    transition:
      background 0.15s,
      color 0.15s;
    white-space: nowrap;
  }
  .nav-links a:hover {
    background: rgba(168, 216, 185, 0.12);
    color: #a8d8b9;
  }

  /* Profile button pinned to bottom */
  .profile-btn {
    position: absolute;
    bottom: 16px;
    left: 0;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px 12px;
    transition: background 0.15s;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .profile-btn:hover {
    background: rgba(168, 216, 185, 0.1);
  }
  .profile-avatar-small {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #5aaf8a;
    color: #0e1a14;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: bold;
    flex-shrink: 0;
  }
  .profile-label {
    color: #c8d8e8;
    font-size: 0.88rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Main bg ── */
  main {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: start;
    justify-content: space-between;
    padding: 28px 28px 28px 92px;
    overflow: auto;
  }
  .background-aura {
    position: absolute;
    border-radius: 999px;
    filter: blur(18px);
    pointer-events: none;
    opacity: 0.8;
    transition: transform 0.1s ease-out;
  }
  .background-aura-left {
    width: 460px;
    height: 460px;
    left: 120px;
    top: 80px;
    background: radial-gradient(
      circle,
      rgba(255, 208, 173, 0.32),
      transparent 68%
    );
  }
  .background-aura-right {
    width: 520px;
    height: 520px;
    right: 260px;
    bottom: -80px;
    background: radial-gradient(
      circle,
      rgba(125, 175, 142, 0.18),
      transparent 70%
    );
  }
  .body-stage {
    position: relative;
    z-index: 1;
    width: 65%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .body-copy {
    max-width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .body-kicker {
    font-size: 0.76rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #7c6956;
  }
  .body-copy h1 {
    font-size: clamp(2rem, 2.2vw, 3.6rem);
    line-height: 0.96;
    letter-spacing: -0.04em;
    color: #27190d;
    max-width: 100%;
  }
  .body-summary {
    font-size: 1rem;
    line-height: 1.65;
    color: #5d4a38;
    width: 100%;
    max-width: 100%;
  }

  /* ── Chatbox ── */
  .chatbox {
    position: sticky;
    top: 28px;
    width: 30%;
    min-width: 320px;
    max-height: calc(100vh - 56px);
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    align-self: start;
  }
  .chat-header {
    background: #1c2a3a;
    color: #e8e8e0;
    padding: 12px 16px;
    font-size: 0.9rem;
    letter-spacing: 0.04em;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .powered-by {
    font-size: 0.7rem;
    opacity: 0.55;
    letter-spacing: 0.06em;
  }
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 200px;
    max-height: 420px;
  }
  .chat-placeholder {
    color: #aaa;
    font-size: 0.85rem;
    text-align: center;
    margin-top: 24px;
  }
  .message {
    max-width: 85%;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.88rem;
    line-height: 1.45;
    word-break: break-word;
  }
  .message.user {
    background: #1c2a3a;
    color: #e8e8e0;
    align-self: flex-end;
    border-bottom-right-radius: 2px;
  }
  .message.ai {
    background: #eef2f0;
    color: #2a2a2a;
    align-self: flex-start;
    border-bottom-left-radius: 2px;
  }
  .message.loading {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 14px;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #7a9e8e;
    display: inline-block;
    animation: bounce 1.2s infinite ease-in-out;
  }
  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }
  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0.7);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }
  .cursor {
    display: inline-block;
    animation: blink 0.7s infinite;
    color: #5a8f7b;
    font-weight: bold;
    margin-left: 1px;
  }
  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
  .error-msg {
    font-size: 0.8rem;
    color: #b04040;
    background: #fdf0f0;
    border-radius: 6px;
    padding: 8px 10px;
    margin-top: 4px;
  }
  .chat-input-row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid #eee;
    background: #fafafa;
    flex-shrink: 0;
  }
  .pain-summary-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid #d7ddd8;
    border-radius: 8px;
    background: #f2f6f3;
    color: #234034;
  }
  .pain-summary-box.empty {
    background: #f5f5f5;
    color: #66716b;
  }
  .pain-summary-label {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .pain-summary-text {
    font-size: 0.86rem;
    line-height: 1.4;
  }
  .textarea-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .composer-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .chat-input-row textarea {
    width: 100%;
    resize: none;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 8px 10px;
    padding-bottom: 20px;
    font-family: inherit;
    font-size: 0.87rem;
    line-height: 1.4;
    outline: none;
    transition: border-color 0.2s;
    background: #fff;
  }
  .chat-input-row textarea:focus {
    border-color: #5a8f7b;
  }
  .chat-input-row textarea:disabled {
    background: #f0f0f0;
  }
  .chat-input-row textarea.over-limit {
    border-color: #b04040;
  }
  .char-count {
    position: absolute;
    bottom: 5px;
    right: 8px;
    font-size: 0.7rem;
    color: #aaa;
    pointer-events: none;
  }
  .char-count.over-limit {
    color: #b04040;
    font-weight: bold;
  }
  .chat-input-row button {
    background: #1c2a3a;
    color: #e8e8e0;
    border: none;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.15s;
    flex-shrink: 0;
    align-self: flex-end;
    margin-bottom: 1px;
  }
  .chat-input-row button:hover:not(:disabled) {
    background: #2e4260;
  }
  .chat-input-row button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Profile Modal ── */
  .profile-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(680px, calc(100vw - 40px));
    max-height: calc(100vh - 60px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.25);
    z-index: 50;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modalIn 0.22s ease;
  }
  @keyframes modalIn {
    from {
      opacity: 0;
      transform: translate(-50%, -48%) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px 28px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .modal-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
    flex-shrink: 0;
  }
  .modal-title {
    font-size: 1.3rem;
    font-weight: normal;
    color: var(--text);
  }
  .modal-sub {
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 2px;
  }
  .close-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .close-btn:hover {
    background: var(--chip-bg);
    color: var(--text);
  }

  .modal-body {
    overflow-y: auto;
    padding: 0 28px 28px;
    flex: 1;
  }

  /* ── Profile internals ── */
  .section {
    padding: 22px 0;
  }
  .section-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }
  .section-title {
    font-size: 0.72rem;
    font-weight: bold;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 12px;
  }
  .section-row .section-title {
    margin-bottom: 0;
  }
  .divider {
    height: 1px;
    background: var(--border);
  }

  .text-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    font-family: inherit;
    font-size: 0.9rem;
    background: var(--bg);
    color: var(--text);
    outline: none;
    transition: border-color 0.2s;
  }
  .text-input:focus {
    border-color: var(--accent);
  }

  .select {
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    font-family: inherit;
    font-size: 0.82rem;
    background: var(--bg);
    color: var(--text);
    outline: none;
    cursor: pointer;
    min-width: 0;
  }

  .sport-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
  }
  .remove-btn {
    background: none;
    border: none;
    color: var(--danger);
    cursor: pointer;
    font-size: 0.85rem;
    padding: 4px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .empty-hint {
    font-size: 0.85rem;
    color: var(--muted);
    font-style: italic;
    margin-bottom: 8px;
  }

  .condition-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }
  .condition-chip {
    border: 1px solid var(--border);
    background: var(--chip-bg);
    color: var(--text);
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .condition-chip:hover {
    border-color: var(--accent);
  }
  .condition-chip.selected {
    background: var(--chip-sel);
    color: var(--chip-sel-t);
    border-color: var(--chip-sel);
  }

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--accent-lt);
    color: var(--accent);
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 0.8rem;
  }
  .tag-remove {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 0.7rem;
    padding: 0;
  }

  .custom-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .theme-row {
    display: flex;
    gap: 10px;
  }
  .theme-btn {
    flex: 1;
    border: 1px solid var(--border);
    background: var(--chip-bg);
    color: var(--text);
    border-radius: 8px;
    padding: 10px;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .theme-btn.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .account-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px;
    font-family: inherit;
    font-size: 0.92rem;
    color: var(--text);
    cursor: pointer;
    transition: background 0.15s;
  }
  .account-toggle:hover {
    background: var(--accent-lt);
  }
  .chevron {
    font-size: 1.2rem;
    display: inline-block;
    transition: transform 0.2s;
    color: var(--muted);
  }
  .chevron.open {
    transform: rotate(90deg);
  }

  .account-info {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .field-label {
    display: block;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 5px;
  }
  .city-country-row {
    display: flex;
    gap: 12px;
  }
  .city-country-row .info-value {
    display: none;
  }
  .field-group {
    flex: 1;
  }
  .info-value {
    font-size: 0.96rem;
    line-height: 1.45;
    color: var(--text);
  }
  .link-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-family: inherit;
    font-size: 0.88rem;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }
  .helper-text {
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--muted);
  }

  .bottom-actions {
    padding-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .profile-save-form {
    display: none;
  }
  .save-btn {
    width: 100%;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 13px;
    font-family: inherit;
    font-size: 0.95rem;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .save-btn:hover {
    opacity: 0.88;
  }
  .save-error {
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .logout-form {
    width: 100%;
  }
  .danger-btn {
    width: 100%;
    background: var(--danger);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 11px;
    font-family: inherit;
    font-size: 0.88rem;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .danger-btn.outline {
    background: none;
    border: 1px solid var(--danger);
    color: var(--danger);
  }
  .danger-btn:hover {
    opacity: 0.8;
  }

  .add-btn {
    background: var(--accent-lt);
    border: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 8px;
    padding: 7px 14px;
    font-family: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .add-btn:hover {
    background: var(--accent);
    color: #fff;
  }

  @media (max-width: 1200px) {
    main {
      flex-direction: column;
      padding-right: 28px;
      padding-bottom: 28px;
    }

    .body-stage,
    .chatbox {
      width: 100%;
    }

    .chatbox {
      position: static;
      max-height: 540px;
      min-width: 0;
    }
  }

  @media (max-width: 860px) {
    main {
      padding: 86px 16px 24px 68px;
    }

    .body-copy h1 {
      max-width: none;
    }
  }
</style>
