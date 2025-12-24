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
  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[300px] rounded-lg shadow-2xl bg-white text-[#0d1620] z-[99999] font-sans pointer-events-auto flex flex-col overflow-hidden ring-1 ring-black/5"
  transition:scale
>
  <!-- Header -->
  <div class="flex justify-between items-center bg-[#d50032] px-4 py-2.5">
    <div class="flex items-center gap-2">
      <!-- Logo if available, or just white text icon -->
      <img
        src={chrome.runtime.getURL("assets/logo.png")}
        alt="Betclic AI"
        class="h-8 w-auto object-contain"
      />
    </div>
    <button
      on:click={onClose}
      class="text-white/80 hover:text-white bg-transparent border-0 text-lg cursor-pointer leading-none p-0 transition-colors"
      >&times;</button
    >
  </div>

  <!-- Content -->
  <div class="p-4">
    <div class="text-sm text-[#4b5563] mb-2 font-medium">
      AI sugeruje: <span
        class="font-bold text-[#d50032] uppercase tracking-wide"
        >{winnerName}</span
      >
    </div>

    <!-- Short Summary -->
    <p class="text-xs text-[#374151] mb-3 leading-relaxed">
      {summary}
    </p>

    <button
      on:click={handleOpenAnalysis}
      class="text-xs text-[#d50032] font-bold cursor-pointer hover:text-[#a30026] transition-colors bg-transparent border-0 p-0 underline decoration-2 underline-offset-2"
    >
      Zobacz pełną analizę...
    </button>
  </div>

  <!-- Arrow -->
  <div
    class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white drop-shadow-sm"
  ></div>
</div>
