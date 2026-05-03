<script>
  let { children } = $props();
</script>

<svelte:head></svelte:head>

{@render children()}

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(html, body) {
    margin: 0;
    min-height: 100%;
  }
</style>
