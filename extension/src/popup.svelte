<script>
    import "../style.css"; // Ensure styles are applied if available, or just use Tailwind classes
    import { onMount } from "svelte";

    let activeTab = "home"; // home, settings
    let matchCount = 3;

    function handleSklejKupon() {
        // Send message to the content script in the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "ACTION_SKLEJ_KUPON",
                    count: matchCount,
                });
                window.close(); // Close popup after action
            }
        });
    }
</script>

<div
    class="w-[350px] bg-[#f5f6f7] text-[#0d1620] font-sans min-h-[400px] flex flex-col shadow-lg"
>
    <!-- Header -->
    <div
        class="px-5 py-3 bg-[#d50032] flex items-center justify-between shrink-0 shadow-md z-10"
    >
        <div class="flex items-center gap-3">
            <!-- Logo Image -->
            <img
                src="../../assets/logo.png"
                alt="Betclic AI"
                class="h-8 w-auto object-contain"
            />
        </div>
        <div
            class="text-[10px] text-[#d50032] font-bold bg-white px-2 py-0.5 rounded uppercase tracking-wider"
        >
            BETA
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 p-6 flex flex-col gap-6">
        <!-- Status Card -->
        <div class="bg-white p-4 rounded-lg shadow-sm border border-[#e5e7eb]">
            <div class="flex justify-between items-center mb-2">
                <span
                    class="text-xs text-[#6b7280] uppercase font-bold tracking-wider"
                    >Status Systemu</span
                >
                <span
                    class="text-[#10b981] text-xs font-bold flex items-center gap-1"
                >
                    <span class="w-2 h-2 rounded-full bg-[#10b981]"></span> Aktywny
                </span>
            </div>
            <p class="text-sm text-[#374151] leading-relaxed">
                Analiza meczów działa poprawnie. Otwórz ofertę na Betclic, aby
                zobaczyć predykcje.
            </p>
        </div>

        <!-- Action Area -->
        <div class="flex flex-col gap-4">
            <div
                class="bg-white p-4 rounded-lg shadow-sm border border-[#e5e7eb]"
            >
                <label
                    for="matchCount"
                    class="text-xs text-[#6b7280] font-bold uppercase tracking-wider flex justify-between mb-3"
                >
                    Liczba meczów: <span class="text-[#d50032] text-sm"
                        >{matchCount}</span
                    >
                </label>
                <input
                    type="range"
                    id="matchCount"
                    min="1"
                    max="10"
                    bind:value={matchCount}
                    class="w-full accent-[#d50032] h-1.5 bg-[#e5e7eb] rounded-lg appearance-none cursor-pointer"
                />
            </div>

            <button
                on:click={handleSklejKupon}
                class="w-full py-3.5 px-4 bg-[#fce500] hover:bg-[#e6d000] active:bg-[#ccb900] text-[#0d1620] font-bold rounded-full flex items-center justify-center gap-3 transition-all duration-200 shadow-md hover:shadow-lg transform active:scale-[0.98] cursor-pointer border-0 group uppercase tracking-wide text-sm"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="group-hover:rotate-12 transition-transform"
                >
                    <path
                        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                    ></path>
                </svg>
                Sklej Kupon
            </button>
            <p class="text-xs text-[#9ca3af] text-center px-4">
                Automatycznie wybiera i dodaje najlepsze mecze z dzisiejszej
                oferty.
            </p>
        </div>
    </div>

    <!-- Footer -->
    <div
        class="p-3 bg-white border-t border-[#e5e7eb] flex justify-center items-center shrink-0"
    >
        <span class="text-[10px] text-[#9ca3af] font-medium"
            >Powered by DEV</span
        >
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        background-color: #f5f6f7;
    }
</style>
