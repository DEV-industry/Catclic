<script>
    import { fade, scale } from "svelte/transition";
    export let analysis;
    export let stats = null;
    export let onClose;

    function handleKeydown(e) {
        if (e.key === "Escape") onClose();
    }

    // Radar chart configuration
    const radarLabels = ["Atak", "Obrona", "Forma", "H2H", "Posiadanie"];
    const radarAngles = radarLabels.map(
        (_, i) => (Math.PI * 2 * i) / radarLabels.length - Math.PI / 2,
    );

    // Get radar data from stats or use defaults
    $: radarData = stats?.radar || {
        home: { attack: 85, defense: 70, form: 80, h2h: 75, possession: 82 },
        away: { attack: 45, defense: 65, form: 50, h2h: 40, possession: 38 },
    };

    $: homeTeamName = stats?.homeTeam || "Home";
    $: awayTeamName = stats?.awayTeam || "Away";

    // Convert data to array format for polygon
    $: homeValues = [
        radarData.home.attack,
        radarData.home.defense,
        radarData.home.form,
        radarData.home.h2h,
        radarData.home.possession,
    ];
    $: awayValues = [
        radarData.away.attack,
        radarData.away.defense,
        radarData.away.form,
        radarData.away.h2h,
        radarData.away.possession,
    ];

    // SVG center and radius
    const cx = 100;
    const cy = 100;
    const maxRadius = 70;

    // Calculate polygon points
    function getPolygonPoints(values) {
        return values
            .map((val, i) => {
                const r = (val / 100) * maxRadius;
                const x = cx + r * Math.cos(radarAngles[i]);
                const y = cy + r * Math.sin(radarAngles[i]);
                return `${x},${y}`;
            })
            .join(" ");
    }

    // Grid circles radii (20%, 40%, 60%, 80%, 100%)
    // Grid circles radii (20%, 40%, 60%, 80%, 100%)
    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

    // Calculate confidence based on probabilities
    $: maxProb = stats?.probs
        ? Math.max(stats.probs.home, stats.probs.draw, stats.probs.away)
        : 0;

    $: confidenceLabel =
        maxProb >= 70
            ? "Bardzo Wysoka"
            : maxProb >= 55
              ? "Wysoka"
              : maxProb >= 45
                ? "Średnia"
                : "Niska";

    $: confidenceColor =
        maxProb >= 55
            ? "text-[#15803d]" // Green
            : maxProb >= 45
              ? "text-[#ca8a04]" // Yellow/Orange
              : "text-[#dc2626]"; // Red
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Backdrop -->
<div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100000] flex items-center justify-center p-4"
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
        class="bg-[#f5f6f7] rounded-lg shadow-2xl w-[520px] overflow-hidden flex flex-col relative max-h-[90vh] font-sans"
        transition:scale={{ start: 0.98, duration: 200 }}
    >
        <!-- Header (Compact) -->
        <div
            class="px-5 py-3 flex justify-between items-center bg-[#d50032] shrink-0"
        >
            <div class="flex items-center gap-2">
                <img
                    src={chrome.runtime.getURL("assets/logo.png")}
                    alt="Betclic AI"
                    class="h-9 w-auto object-contain"
                />
            </div>
            <button
                on:click={onClose}
                class="text-white/80 hover:text-white transition-colors bg-transparent border-0 p-1 cursor-pointer leading-none text-xl"
                >&times;</button
            >
        </div>

        <!-- Body -->
        <div class="flex-1 flex flex-col overflow-y-auto">
            {#if stats && stats.probs}
                <div class="p-6 flex flex-col gap-6">
                    <!-- 1. Probabilities (Compact Bar) -->
                    <div
                        class="bg-white p-4 rounded-lg shadow-sm border border-[#e5e7eb]"
                    >
                        <div
                            class="flex justify-between text-sm text-[#6b7280] font-medium mb-2 uppercase tracking-wider"
                        >
                            <span>Home</span>
                            <span>Draw</span>
                            <span>Away</span>
                        </div>
                        <div
                            class="flex h-3 rounded overflow-hidden bg-[#e5e7eb]"
                        >
                            <div
                                class="bg-[#3d8c4a] h-full"
                                style="width: {stats.probs.home}%"
                            ></div>
                            <div
                                class="bg-[#9ca3af] h-full"
                                style="width: {stats.probs.draw}%"
                            ></div>
                            <div
                                class="bg-[#4b5563] h-full"
                                style="width: {stats.probs.away}%"
                            ></div>
                        </div>
                    </div>

                    <!-- 2. Radar Chart (Spider Web) -->
                    <div
                        class="bg-white p-4 rounded-lg shadow-sm border border-[#e5e7eb]"
                    >
                        <h3
                            class="text-sm text-[#6b7280] mb-3 font-medium uppercase tracking-wide text-center"
                        >
                            Porównanie Drużyn
                        </h3>
                        <div class="flex items-center justify-center">
                            <svg viewBox="0 0 200 200" class="w-52 h-52">
                                <!-- Grid circles (pentagon shapes) -->
                                {#each gridLevels as level}
                                    <polygon
                                        points={radarAngles
                                            .map((angle, i) => {
                                                const r = level * maxRadius;
                                                const x =
                                                    cx + r * Math.cos(angle);
                                                const y =
                                                    cy + r * Math.sin(angle);
                                                return `${x},${y}`;
                                            })
                                            .join(" ")}
                                        fill="none"
                                        stroke="#e5e7eb"
                                        stroke-width="1"
                                    />
                                {/each}

                                <!-- Axis lines -->
                                {#each radarAngles as angle}
                                    <line
                                        x1={cx}
                                        y1={cy}
                                        x2={cx + maxRadius * Math.cos(angle)}
                                        y2={cy + maxRadius * Math.sin(angle)}
                                        stroke="#e5e7eb"
                                        stroke-width="1"
                                    />
                                {/each}

                                <!-- Away team polygon (draw first, so Home is on top) -->
                                <polygon
                                    points={getPolygonPoints(awayValues)}
                                    fill="rgba(239, 68, 68, 0.2)"
                                    stroke="#ef4444"
                                    stroke-width="2"
                                />

                                <!-- Home team polygon -->
                                <polygon
                                    points={getPolygonPoints(homeValues)}
                                    fill="rgba(74, 222, 128, 0.25)"
                                    stroke="#4ade80"
                                    stroke-width="2"
                                />

                                <!-- Data points - Away -->
                                {#each awayValues as val, i}
                                    <circle
                                        cx={cx +
                                            (val / 100) *
                                                maxRadius *
                                                Math.cos(radarAngles[i])}
                                        cy={cy +
                                            (val / 100) *
                                                maxRadius *
                                                Math.sin(radarAngles[i])}
                                        r="3"
                                        fill="#ef4444"
                                    />
                                {/each}

                                <!-- Data points - Home -->
                                {#each homeValues as val, i}
                                    <circle
                                        cx={cx +
                                            (val / 100) *
                                                maxRadius *
                                                Math.cos(radarAngles[i])}
                                        cy={cy +
                                            (val / 100) *
                                                maxRadius *
                                                Math.sin(radarAngles[i])}
                                        r="3"
                                        fill="#4ade80"
                                    />
                                {/each}

                                <!-- Labels -->
                                {#each radarLabels as label, i}
                                    <text
                                        x={cx +
                                            (maxRadius + 18) *
                                                Math.cos(radarAngles[i])}
                                        y={cy +
                                            (maxRadius + 18) *
                                                Math.sin(radarAngles[i])}
                                        text-anchor="middle"
                                        dominant-baseline="middle"
                                        class="fill-[#374151] text-[8px] font-medium"
                                    >
                                        {label}
                                    </text>
                                {/each}
                            </svg>
                        </div>
                        <!-- Legend -->
                        <div class="flex justify-center gap-8 mt-3">
                            <div class="flex items-center gap-2">
                                <div
                                    class="w-3 h-3 rounded-full bg-[#4ade80]"
                                ></div>
                                <span class="text-sm text-[#4b5563]"
                                    >{homeTeamName}</span
                                >
                            </div>
                            <div class="flex items-center gap-2">
                                <div
                                    class="w-3 h-3 rounded-full bg-[#ef4444]"
                                ></div>
                                <span class="text-sm text-[#4b5563]"
                                    >{awayTeamName}</span
                                >
                            </div>
                        </div>
                    </div>

                    <!-- 3. Analysis Text -->
                    <div
                        class="bg-white p-4 rounded-lg shadow-sm border border-[#e5e7eb]"
                    >
                        <h3
                            class="text-sm text-[#6b7280] mb-3 font-medium uppercase tracking-wide"
                        >
                            Analiza Ekspercka
                        </h3>
                        <div
                            class="text-[#374151] text-base leading-relaxed analysis-content"
                        >
                            {@html analysis}
                        </div>
                    </div>
                </div>
            {:else}
                <!-- Loading State placeholder if stats missing but modal open -->
                <div
                    class="flex-1 flex items-center justify-center text-[#6b7280]"
                >
                    <span class="animate-pulse"
                        >Analizowanie danych meczowych...</span
                    >
                </div>
            {/if}
        </div>

        <!-- Footer -->
        <div
            class="p-4 bg-white border-t border-[#e5e7eb] flex justify-between items-center shrink-0"
        >
            <div class="flex flex-col">
                <span class="text-sm text-[#6b7280]">Pewność Typu</span>
                <div class="{confidenceColor} font-bold text-base">
                    {confidenceLabel} ({Math.round(maxProb)}%)
                </div>
            </div>
            <button
                on:click={onClose}
                class="px-6 py-2 bg-[#fce500] hover:bg-[#e6d000] text-[#0d1620] text-base rounded border-0 transition-colors font-bold cursor-pointer uppercase shadow-sm"
                >Zamknij</button
            >
        </div>
    </div>
</div>
