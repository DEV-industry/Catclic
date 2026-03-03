<script>
  import { onMount, onDestroy } from "svelte";
  import Tooltip from "./Tooltip.svelte";
  import AnalysisModal from "./AnalysisModal.svelte";

  export let teamA;
  export let teamB;
  export let oddsA;
  export let oddsB;
  export let elementA;
  export let elementB;
  export let fullCardElement = null;

  let prediction = "";
  let summary = "";
  let fullAnalysis = "";
  let stats = null;
  let showTooltip = false;
  let showModal = false;
  let highlightedElement = null;
  let tooltipPosition = { top: 0, left: 0 };
  let closeTimeout;

  let isLoading = false;
  let isGenerated = false;
  const logoUrl = chrome.runtime.getURL("assets/icon-badge.png");
  const mainLogoUrl = chrome.runtime.getURL("assets/logo.png");
  const API_URL = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:3000";

  async function getPrediction() {
    if (isLoading || isGenerated) return;
    isLoading = true;
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamA, teamB, oddsA, oddsB }),
      });
      const data = await res.json();

      // Handle both old and new backend responses during transition
      prediction = data.prediction;
      summary = data.summary || data.reasoning || "Analiza niedostępna.";
      fullAnalysis =
        data.full_analysis ||
        data.reasoning ||
        "Szczegółowa analiza niedostępna.";
      stats = data.stats || null;

      isGenerated = true;
      applyHighlight();

      // Auto-open tooltip logic removed as discussed (left empty)
      if (highlightedElement) {
      }
    } catch (e) {
      console.error("Prediction failed", e);
    } finally {
      isLoading = false;
    }
  }

  function applyHighlight() {
    if (prediction === "1") highlightedElement = elementA;
    else if (prediction === "2") highlightedElement = elementB;

    if (highlightedElement) {
      highlightedElement.style.setProperty(
        "background-color",
        "#22c55e",
        "important",
      );
      highlightedElement.style.setProperty(
        "background-image",
        "none",
        "important",
      );
      highlightedElement.style.setProperty("color", "white", "important");
      highlightedElement.style.setProperty(
        "border-color",
        "#16a34a",
        "important",
      );
      highlightedElement.style.setProperty(
        "box-shadow",
        "0 0 10px rgba(34, 197, 94, 0.5)",
        "important",
      );
      highlightedElement.style.setProperty(
        "transition",
        "all 0.3s ease",
        "important",
      );

      highlightedElement.addEventListener("mouseenter", handleMouseEnter);
      highlightedElement.addEventListener("mouseleave", handleMouseLeave);
    }
  }

  function handleMouseEnter(e) {
    if (!highlightedElement) return;
    clearTimeout(closeTimeout);

    const rect = highlightedElement.getBoundingClientRect();
    let leftPos = rect.left + window.scrollX + rect.width / 2;
    const TOOLTIP_WIDTH = 300;
    const screenWidth = window.innerWidth;
    if (leftPos + TOOLTIP_WIDTH / 2 > screenWidth - 20)
      leftPos = screenWidth - TOOLTIP_WIDTH / 2 - 20;
    if (leftPos - TOOLTIP_WIDTH / 2 < 20) leftPos = TOOLTIP_WIDTH / 2 + 20;

    tooltipPosition = {
      top: rect.top + window.scrollY - 10,
      left: leftPos,
    };
    showTooltip = true;
  }

  function handleMouseLeave() {
    closeTimeout = setTimeout(() => {
      showTooltip = false;
    }, 300);
  }

  function handleTooltipEnter() {
    clearTimeout(closeTimeout);
  }

  function handleTooltipLeave() {
    closeTimeout = setTimeout(() => {
      showTooltip = false;
    }, 300);
  }

  function openAnalysisModal() {
    showModal = true;
    showTooltip = false;
  }

  function portal(node) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      },
    };
  }

  function portalToCard(node, target) {
    if (!target) return;
    target.appendChild(node);

    // Ensure absolute matching
    node.style.position = "absolute";
    node.style.top = "0";
    node.style.left = "0";
    node.style.width = "100%";
    node.style.height = "100%";
    node.style.zIndex = "1";
    node.style.borderRadius = "inherit";

    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      },
    };
  }

  onDestroy(() => {
    if (highlightedElement) {
      highlightedElement.removeEventListener("mouseenter", handleMouseEnter);
      highlightedElement.removeEventListener("mouseleave", handleMouseLeave);
    }
  });

  $: winnerName =
    prediction === "1" ? teamA : prediction === "2" ? teamB : "Remis";
</script>

{#if showTooltip}
  <div
    use:portal
    role="tooltip"
    on:mouseenter={handleTooltipEnter}
    on:mouseleave={handleTooltipLeave}
    style="position: absolute; top: {tooltipPosition.top}px; left: {tooltipPosition.left}px; width: 0; height: 0; overflow: visible; z-index: 99999; pointer-events: auto;"
  >
    <Tooltip
      {winnerName}
      {summary}
      onClose={() => {
        showTooltip = false;
      }}
      on:openAnalysis={openAnalysisModal}
    />
  </div>
{/if}

{#if showModal}
  <div use:portal style="position: relative; z-index: 100000;">
    <AnalysisModal
      {winnerName}
      analysis={fullAnalysis}
      {stats}
      onClose={() => {
        showModal = false;
      }}
    />
  </div>
{/if}

{#if isLoading && fullCardElement}
  <div use:portalToCard={fullCardElement} class="loading-overlay">
    <div class="overlay-logo-container">
      <img src={mainLogoUrl} class="overlay-logo" alt="Catclic" />
    </div>
    <div class="loading-dots">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  </div>
{/if}

{#if !isGenerated && !isLoading}
  <button
    class="catclic-trigger"
    title="Wygeneruj predykcję Catclic"
    on:click|stopPropagation|preventDefault={getPrediction}
    on:mousedown|stopPropagation
    on:mouseup|stopPropagation
  >
    <img
      src={logoUrl}
      alt="Catclic"
      style="height: 24px; width: auto; object-fit: contain; filter: grayscale(100%) brightness(1.5) drop-shadow(0 2px 3px rgba(0,0,0,0.5));"
    />
  </button>
{/if}

<style>
  .catclic-trigger {
    position: absolute;
    top: 50%; /* Center vertically */
    right: 0; /* Align to the right edge of the scoreboard info */
    bottom: auto;
    left: auto;
    transform: translateY(-50%);
    z-index: 1;
    background: transparent;
    border: none;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    cursor: pointer;
    pointer-events: auto;
  }

  .loading-overlay {
    /* Position handled by portalToCard */
    background: rgba(0, 0, 0, 0.5); /* Dark background */
    backdrop-filter: blur(4px); /* Blur effect */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1;
    pointer-events: auto; /* Block clicks */
    border-radius: inherit;
    border: 8px solid #b51721;
    box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.7);
    flex-direction: column;
    gap: 16px;
  }

  .overlay-logo {
    height: 32px;
    width: auto;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  }

  .loading-dots {
    display: flex;
    gap: 8px;
  }

  .dot {
    width: 10px;
    height: 10px;
    background-color: white;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .dot:nth-child(1) {
    animation-delay: -0.32s;
  }
  .dot:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
</style>
