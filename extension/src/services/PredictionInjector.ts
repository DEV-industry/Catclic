
import PredictionContainer from "../components/PredictionContainer.svelte"
import { MatchParser } from "./MatchParser"

const INJECTED_CLASS = "gemini-predictor-injected";

export function scanAndInject() {
    // 1. Find potential match containers
    const containers = MatchParser.findPossibleMatchContainers();

    // GLOBAL CHECK: If we already have 1 injected match on the page, STOP.
    if (document.querySelectorAll(`.${INJECTED_CLASS}`).length >= 1) return;

    let injectedCount = 0;
    for (const container of containers) {
        if (injectedCount >= 1) break; // LIMIT TO 1 PER SCAN (redundant with above but safe)

        if (container.classList.contains(INJECTED_CLASS)) continue;

        // Refine: Check if we can parse data
        const data = MatchParser.parse(container);
        if (!data) continue;

        // Mark as injected
        container.classList.add(INJECTED_CLASS);

        if (data.elementA && data.elementB) {
            // Create a root div for the Svelte component
            const appRoot = document.createElement("div");
            // We make it 0x0 size so it doesn't affect layout, it just holds the logic/tooltip
            appRoot.style.position = "absolute";
            appRoot.style.pointerEvents = "none"; // Let clicks pass through unless on tooltip
            container.appendChild(appRoot);

            new PredictionContainer({
                target: appRoot,
                props: {
                    teamA: data.teamA,
                    teamB: data.teamB,
                    oddsA: data.oddsA,
                    oddsB: data.oddsB,
                    elementA: data.elementA,
                    elementB: data.elementB
                }
            });

            console.log(`Injected prediction component for match ${data.id}`);
            injectedCount++;
        }
    }
}
