<script>
    import "../style.css"; // Ensure styles are applied if available, or just use Tailwind classes
    import { onMount } from "svelte";
    import { scale } from "svelte/transition";

    let activeTab = "home"; // home, settings
    let matchCount = 3;
    let isLive = false;
    let sportFilter = "all"; // all, football, tennis, basketball
    let maxOdds = 2.5;
    let enableAdvancedStats = false;
    let showFilters = false;

    let isValidDomain = false;

    onMount(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (
                tabs[0]?.url &&
                (tabs[0].url.includes("betclic.pl") ||
                    tabs[0].url.includes("betclic.com"))
            ) {
                isValidDomain = true;
            } else {
                isValidDomain = false;
            }
        });
    });

    function handleSklejKupon() {
        // Send message to the content script in the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "ACTION_SKLEJ_KUPON",
                    count: matchCount,
                    filters: {
                        isLive: isLive,
                        sport: sportFilter,
                        maxOdds: maxOdds,
                        enableAdvancedStats: enableAdvancedStats,
                    },
                });
                window.close(); // Close popup after action
            }
        });
    }

    function openBetclic() {
        chrome.tabs.create({ url: "https://www.betclic.pl" });
    }
</script>

{#if isValidDomain}
    <div
        class="w-[350px] bg-[#f5f6f7] text-[#0d1620] font-sans min-h-[400px] flex flex-col shadow-lg"
    >
        <!-- Header -->
        <div
            class="px-5 py-3 bg-[#b51721] flex items-center justify-between shrink-0 shadow-md z-10"
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
                class="text-[10px] text-[#b51721] font-bold bg-white px-2 py-0.5 rounded uppercase tracking-wider"
            >
                BETA
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 p-6 flex flex-col gap-6">
            <!-- Status Card -->
            <div
                class="bg-white p-4 rounded-lg shadow-sm border border-[#e5e7eb]"
            >
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
                    Analiza meczów działa poprawnie. Otwórz ofertę na Betclic,
                    aby zobaczyć predykcje.
                </p>
            </div>

            <!-- Action Area -->
            <div class="flex flex-col gap-4">
                <!-- Filter Toggle -->
                <div class="flex justify-end">
                    <button
                        on:click={() => (showFilters = !showFilters)}
                        class="text-xs text-[#6b7280] font-bold uppercase tracking-wider flex items-center gap-2 hover:text-[#b51721] transition-colors bg-transparent border-0 cursor-pointer p-0"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polygon
                                points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                            ></polygon>
                        </svg>
                        Filtry i Ustawienia
                    </button>
                </div>

                <!-- Filters (Collapsible) -->
                {#if showFilters}
                    <div
                        class="grid grid-cols-2 gap-3"
                        transition:scale={{ duration: 200, start: 0.95 }}
                    >
                        <div
                            class="bg-white p-3 rounded-lg shadow-sm border border-[#e5e7eb] flex flex-col justify-center"
                        >
                            <span
                                class="text-[10px] text-[#6b7280] font-bold uppercase tracking-wider block mb-2"
                                >Tryb</span
                            >
                            <button
                                on:click={() => (isLive = !isLive)}
                                class={`w-full text-sm font-bold py-1.5 px-3 rounded transition-all flex items-center justify-between border ${
                                    isLive
                                        ? "bg-red-50 text-[#b51721] border-[#b51721]"
                                        : "bg-gray-50 text-[#6b7280] border-transparent hover:bg-gray-100"
                                }`}
                            >
                                <span>Na żywo</span>
                                <div
                                    class={`w-3 h-3 rounded-full shadow-sm transition-colors ${
                                        isLive
                                            ? "bg-[#b51721] animate-pulse"
                                            : "bg-gray-300"
                                    }`}
                                ></div>
                            </button>
                        </div>
                        <div
                            class="bg-white p-3 rounded-lg shadow-sm border border-[#e5e7eb]"
                        >
                            <label
                                class="text-[10px] text-[#6b7280] font-bold uppercase tracking-wider block mb-2"
                                for="sportFilter">Sport</label
                            >
                            <select
                                id="sportFilter"
                                bind:value={sportFilter}
                                class="w-full text-sm bg-transparent border-none outline-none font-medium text-[#0d1620] cursor-pointer"
                            >
                                <option value="all">Auto</option>
                                <option value="football">Piłka Nożna</option>
                                <option value="tennis">Tenis</option>
                                <option value="basketball">Koszykówka</option>
                            </select>
                        </div>
                    </div>
                {/if}

                {#if showFilters && (sportFilter === "football" || sportFilter === "all")}
                    <div
                        transition:scale={{ duration: 200 }}
                        class="bg-white p-3 rounded-lg shadow-sm border border-[#e5e7eb] flex items-center justify-between"
                    >
                        <div class="flex flex-col">
                            <span
                                class="text-[10px] text-[#6b7280] font-bold uppercase tracking-wider mb-1"
                                >Eksperymentalne</span
                            >
                            <span class="text-xs font-bold text-[#0d1620]"
                                >Zaawansowane Statystyki (AI)</span
                            >
                        </div>
                        <button
                            on:click={() =>
                                (enableAdvancedStats = !enableAdvancedStats)}
                            class={`relative w-11 h-6 transition-colors rounded-full ${enableAdvancedStats ? "bg-[#b51721]" : "bg-gray-200"}`}
                        >
                            <span
                                class={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${enableAdvancedStats ? "translate-x-5" : "translate-x-0"}`}
                            ></span>
                        </button>
                    </div>
                {/if}

                <div
                    class="bg-white p-4 rounded-lg shadow-sm border border-[#e5e7eb]"
                >
                    <label
                        for="matchCount"
                        class="text-xs text-[#6b7280] font-bold uppercase tracking-wider flex justify-between mb-3"
                    >
                        Liczba meczów: <span class="text-[#b51721] text-sm"
                            >{matchCount}</span
                        >
                    </label>
                    <input
                        type="range"
                        id="matchCount"
                        min="1"
                        max="10"
                        bind:value={matchCount}
                        class="w-full accent-[#b51721] h-1.5 bg-[#e5e7eb] rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div
                    class="bg-white p-4 rounded-lg shadow-sm border border-[#e5e7eb]"
                >
                    <label
                        for="maxOdds"
                        class="text-xs text-[#6b7280] font-bold uppercase tracking-wider flex justify-between mb-3"
                    >
                        Maksymalny Kurs: <span class="text-[#b51721] text-sm"
                            >{maxOdds.toFixed(2)}</span
                        >
                    </label>
                    <input
                        type="range"
                        id="maxOdds"
                        min="1.10"
                        max="5.00"
                        step="0.05"
                        bind:value={maxOdds}
                        class="w-full accent-[#b51721] h-1.5 bg-[#e5e7eb] rounded-lg appearance-none cursor-pointer"
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
{:else}
    <div
        class="w-[300px] bg-white flex flex-col items-center justify-center p-5 text-center min-h-[250px] shadow-2xl border-t-4 border-[#b51721]"
    >
        <div
            class="mb-3 transform hover:scale-105 transition-transform duration-300 bg-[#b51721] rounded-full p-3 shadow-lg"
        >
            <img
                src="../../assets/logo.png"
                alt="Catclic Logo"
                class="h-6 w-auto drop-shadow-sm"
            />
        </div>
        <h3 class="text-base font-bold text-[#0d1620] mb-1">
            Tylko na Betclic
        </h3>
        <p class="text-[11px] text-[#6b7280] mb-4 leading-relaxed px-1">
            To rozszerzenie działa wyłącznie na stronie Betclic.pl. Przejdź do
            serwisu, aby skorzystać z funkcji.
        </p>
        <button
            on:click={openBetclic}
            class="w-full py-2 bg-[#b51721] text-white text-xs font-bold rounded-md hover:bg-[#900f18] transition-all transform hover:-translate-y-0.5 shadow-sm hover:shadow-md border-0 cursor-pointer uppercase tracking-wide"
        >
            Przejdź do Betclic.pl
        </button>

        <img
            src="../../assets/catclic-sleepy.png"
            alt="Sleepy Cat"
            class="mt-4 w-20 h-auto opacity-90 drop-shadow-sm hover:scale-105 transition-transform duration-500"
        />
    </div>
{/if}

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        background-color: #f5f6f7;
    }
</style>
