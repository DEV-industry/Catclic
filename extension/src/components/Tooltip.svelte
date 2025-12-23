<script>
  import { scale } from "svelte/transition";
  import { createEventDispatcher } from "svelte";

  export let winnerName;
  export let summary;
  export let onClose;

  const dispatch = createEventDispatcher();

  function handleOpenAnalysis() {
    dispatch("openAnalysis");
  }
</script>

<div
  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[300px] p-4 rounded-lg shadow-2xl border border-[#2a2a2f] bg-[#151519] text-white z-[99999] font-sans pointer-events-auto flex flex-col gap-3"
  transition:scale
>
  <!-- Header -->
  <div class="flex justify-between items-center border-b border-[#2a2a2f] pb-2">
    <div class="flex items-center gap-2">
      <span class="text-lg">🤖</span>
      <h3 class="font-semibold text-sm text-white m-0">Analiza AI</h3>
    </div>
    <button
      on:click={onClose}
      class="text-[#6b6b75] hover:text-white bg-transparent border-0 text-lg cursor-pointer leading-none p-0"
      >&times;</button
    >
  </div>

  <!-- Content -->
  <div>
    <div class="text-sm text-[#a0a0a8] mb-2">
      AI sugeruje: <span class="font-bold text-[#4ade80]">{winnerName}</span>
    </div>

    <!-- Short Summary -->
    <p class="text-xs text-[#8a8a95] mb-3 leading-relaxed">
      {summary}
    </p>

    <button
      on:click={handleOpenAnalysis}
      class="text-xs text-[#6cb96c] font-medium cursor-pointer hover:text-[#8cd98c] transition-colors bg-transparent border-0 p-0 underline"
    >
      Zobacz pełną analizę...
    </button>
  </div>

  <!-- Arrow -->
  <div
    class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#151519]"
  ></div>
</div>
