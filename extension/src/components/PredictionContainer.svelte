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

  async function getPrediction() {
    if (isLoading || isGenerated) return;
    isLoading = true;
    try {
      const res = await fetch("http://localhost:3000/predict", {
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

      // Auto-open tooltip after generation to show result immediately
      if (highlightedElement) {
        // Calculate position immediately relative to the button or the element?
        // Existing logic uses hover on element. Let's try to simulate that or just define position.
        // Let's rely on the user hovering for now, OR better, open it near the button/element.
        // But the `applyHighlight` adds listeners.
        // Let's just let the user hover or click "See analysis" if I add it.
        // Wait, the user screenshot shows the tooltip OPEN.
        // I'll try to simulate a mouse enter or just set showTooltip = true with a default position?
        // Position is tricky without an event.
        // I'll defer auto-opening to keep it simple, or maybe just point to the highlight.
        // Actually, if I just highlight, the user will see it.
        // NEW REQUIREMENT: "In the top right corner... icon Catclic where after pressing it only then will start generating"
        // Doesn't explicitly say "and open it".
        // But "Catclic" card in screenshot looks like the result.
        // Let's leave it as: Click -> Load -> Highlight (Green) -> Button becomes "Check" or just stays?
        // I'll hide the button if it obstructs, or keep it.
        // I'll keep the button invisible after generation? No, maybe I want to regenerate?
        // Let's hide the button after generation so it doesn't block the view, or maybe change it to "Analiza gotowa".
        // I'll simply hide the trigger button after successful generation.
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

{#if !isGenerated}
  <button
    class="catclic-trigger"
    title="Wygeneruj predykcję Catclic"
    style="
      position: absolute;
      top: 40px;
      left: 12px;
      right: auto;
      z-index: 1000;
      background: transparent;
      border: none;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s;
      pointer-events: auto;
    "
    on:click|stopPropagation|preventDefault={getPrediction}
    on:mousedown|stopPropagation
    on:mouseup|stopPropagation
  >
    {#if isLoading}
      <div class="spinner"></div>
    {:else}
      <img
        src={logoUrl}
        alt="Catclic"
        style="height: 24px; width: auto; object-fit: contain; filter: grayscale(100%) brightness(1.5) drop-shadow(0 2px 3px rgba(0,0,0,0.5));"
      />
    {/if}
  </button>

  <style>
    .catclic-trigger:hover {
      transform: scale(1.1);
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #d50032;
      border-bottom-color: transparent;
      border-radius: 50%;
      display: inline-block;
      box-sizing: border-box;
      animation: rotation 1s linear infinite;
    }
    @keyframes rotation {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
  </style>
{/if}
