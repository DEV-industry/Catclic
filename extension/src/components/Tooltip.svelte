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
  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[300px] p-4 rounded-xl shadow-2xl border border-slate-700 bg-slate-900 text-white z-[99999] font-sans pointer-events-auto flex flex-col gap-3"
  transition:scale
>
  <!-- Header -->
  <div class="flex justify-between items-center border-b border-slate-800 pb-2">
    <div class="flex items-center gap-2">
      <span class="text-xl">🤖</span>
      <h3 class="font-bold text-sm text-slate-200 m-0">Analiza AI</h3>
    </div>
    <button
      on:click={onClose}
      class="text-slate-400 hover:text-white bg-transparent border-0 text-xl cursor-pointer leading-none p-0"
      >&times;</button
    >
  </div>

  <!-- Content -->
  <div>
    <div class="text-base text-white mb-2">
      AI sugeruje: <span class="font-bold text-green-400">{winnerName}</span>
    </div>

    <!-- Short Summary -->
    <p class="text-xs text-slate-300 mb-2 leading-relaxed">
      {summary}
    </p>

    <button
      on:click={handleOpenAnalysis}
      class="text-xs text-green-400 font-bold underline cursor-pointer hover:text-green-300 transition-colors bg-transparent border-0 p-0"
    >
      Zobacz pełną analizę...
    </button>
  </div>

  <!-- Arrow -->
  <div
    class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-slate-900"
  ></div>
</div>
