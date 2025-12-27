
import PredictionContainer from "../components/PredictionContainer.svelte"
import { MatchParser } from "./MatchParser"

const INJECTED_CLASS = "gemini-predictor-injected";

export function scanAndInject() {
    // 1. Find potential match containers
    const containers = MatchParser.findPossibleMatchContainers();



    for (const container of containers) {
        if (container.classList.contains(INJECTED_CLASS)) continue;

        // Refine: Check if we can parse data
        const data = MatchParser.parse(container);
        if (!data) continue;

        // Mark as injected
        container.classList.add(INJECTED_CLASS);
        (container as HTMLElement).style.position = "relative";

        if (data.elementA && data.elementB) {
            // Create a root div for the Svelte component
            const appRoot = document.createElement("div");
            // We make it 0x0 size so it doesn't affect layout, it just holds the logic/tooltip
            appRoot.style.position = "absolute";
            appRoot.style.top = "0";
            appRoot.style.left = "0";
            appRoot.style.width = "100%";
            appRoot.style.height = "100%";
            appRoot.style.zIndex = "10";
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
        }
    }
}
