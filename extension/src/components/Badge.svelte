<script lang="ts">
  export let prediction: string;
  export let isLoading: boolean = false;
  export let onClick: () => void;

  const getColor = (pred: string) => {
    if (isLoading) return 'bg-gray-500';
    if (!pred) return 'bg-blue-600';
    // Simple heuristic: match team name roughly or just show color
    return 'bg-green-600'; 
  };
</script>

<button 
  class="{getColor(prediction)} text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg hover:scale-105 transition-transform z-50 flex items-center gap-1"
  on:click|stopPropagation={onClick}
>
  {#if isLoading}
    <span class="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
    Analyzing...
  {:else if prediction}
    AI: {prediction}
  {:else}
    Ask AI
  {/if}
</button>
