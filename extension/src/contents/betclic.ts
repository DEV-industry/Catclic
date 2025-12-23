import type { PlasmoCSConfig } from "plasmo"
import PredictionContainer from "../components/PredictionContainer.svelte"
import { MatchParser } from "../services/MatchParser"

// @ts-ignore
import cssText from "data-text:../../style.css"

export const config: PlasmoCSConfig = {
    matches: ["https://*.betclic.pl/*"]
}

export const getStyle = () => {
    const style = document.createElement("style")
    style.textContent = cssText
    return style
}

console.log("Betclic Smart Predictor: Content Script Active")

// Inject styles globally since we are not using Shadow DOM for the portal
const style = getStyle();
document.head.appendChild(style);

// --- DEBUGGING ---
// (Disabled for production feel)
// setInterval(() => { ... }, 5000);

const INJECTED_CLASS = "gemini-predictor-injected";

function scanAndInject() {
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

// Observe DOM changes to handle infinite scroll / navigation
const observer = new MutationObserver((mutations) => {
    scanAndInject();
});

window.addEventListener("load", () => {
    scanAndInject();
    observer.observe(document.body, { childList: true, subtree: true });
});
