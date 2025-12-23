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

  async function getPrediction() {
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

      applyHighlight();
    } catch (e) {
      console.error("Prediction failed", e);
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

  onMount(() => {
    getPrediction();
  });

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
