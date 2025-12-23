<script>
    import { fade, scale } from "svelte/transition";
    export let winnerName;
    export let analysis;
    export let stats = null;
    export let onClose;

    function handleKeydown(e) {
        if (e.key === "Escape") onClose();
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Backdrop -->
<div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100000] flex items-center justify-center p-4"
    transition:fade
    on:click|self={onClose}
    on:keydown={(e) => {
        if (e.key === "Escape" || e.key === "Enter") onClose();
    }}
    role="button"
    tabindex="0"
>
    <!-- Modal Content -->
    <div
        class="bg-[#1a1d2e] border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative h-[500px] max-h-[90vh] font-sans"
        transition:scale={{ start: 0.98, duration: 200 }}
    >
        <!-- Header (Compact) -->
        <div
            class="px-5 py-3 border-b border-slate-800/50 flex justify-between items-center bg-[#1a1d2e] shrink-0"
        >
            <div class="flex items-center gap-2">
                <div
                    class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                ></div>
                <h2
                    class="text-sm font-bold text-white tracking-wide uppercase"
                >
                    AI Match Intelligence
                </h2>
            </div>
            <button
                on:click={onClose}
                class="text-slate-400 hover:text-white transition-colors bg-transparent border-0 p-1 cursor-pointer leading-none"
                >&times;</button
            >
        </div>

        <!-- Body -->
        <div class="flex-1 flex flex-col overflow-hidden">
            {#if stats && stats.probs}
                <div
                    class="p-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 flex-1"
                >
                    <!-- 1. Probabilities (Compact Bar) -->
                    <div class="mb-5">
                        <div
                            class="flex justify-between text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider"
                        >
                            <span>Home</span>
                            <span>Draw</span>
                            <span>Away</span>
                        </div>
                        <div
                            class="flex h-2 rounded-full overflow-hidden bg-slate-800"
                        >
                            <div
                                class="bg-green-500 h-full"
                                style="width: {stats.probs.home}%"
                            ></div>
                            <div
                                class="bg-slate-500 h-full"
                                style="width: {stats.probs.draw}%"
                            ></div>
                            <div
                                class="bg-blue-500 h-full"
                                style="width: {stats.probs.away}%"
                            ></div>
                        </div>
                    </div>

                    <!-- 2. Analysis Text -->
                    <div>
                        <h3
                            class="text-[10px] text-slate-400 mb-2 font-bold uppercase tracking-wide"
                        >
                            Analiza Ekspercka
                        </h3>
                        <div
                            class="text-slate-200 text-sm leading-relaxed text-justify analysis-content"
                        >
                            {@html analysis}
                        </div>
                    </div>
                </div>
            {:else}
                <!-- Loading State placeholder if stats missing but modal open -->
                <div
                    class="flex-1 flex items-center justify-center text-slate-500"
                >
                    <span class="animate-pulse"
                        >Analizowanie danych meczowych...</span
                    >
                </div>
            {/if}
        </div>

        <!-- Footer -->
        <div
            class="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center shrink-0"
        >
            <div class="flex flex-col">
                <span class="text-[9px] text-slate-500">Pewność Typu</span>
                <div class="text-green-400 font-bold text-xs">Wysoka (78%)</div>
            </div>
            <button
                on:click={onClose}
                class="px-6 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-md border border-slate-700 transition-colors uppercase font-bold tracking-wide cursor-pointer"
                >Zamknij</button
            >
        </div>
    </div>
</div>

<style>
    /* Custom scrollbar for webkit */
    .scrollbar-thin::-webkit-scrollbar {
        width: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
        background: transparent;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 2px;
    }
</style>
