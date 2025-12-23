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

// Replace Betclic logo with custom logo
function replaceLogoWithCustom() {
    // Inject CSS to hide the Betclic text/icon (::before pseudo element)
    if (!document.getElementById('custom-logo-styles')) {
        const hideStyles = document.createElement('style');
        hideStyles.id = 'custom-logo-styles';
        hideStyles.textContent = `
            a[data-qa="commonLogo"] .icons.icon_logoBetclicFill::before,
            a[data-qa="commonLogo"] .icon_logoBetclicFill::before,
            a[data-qa="commonLogo"]::before {
                display: none !important;
                content: none !important;
            }
            a[data-qa="commonLogo"] .icons.icon_logoBetclicFill,
            a[data-qa="commonLogo"] .icon_logoBetclicFill {
                display: none !important;
            }
        `;
        document.head.appendChild(hideStyles);
    }

    const logoLink = document.querySelector('a[data-qa="commonLogo"]') as HTMLAnchorElement;
    if (logoLink && !logoLink.dataset.customLogoApplied) {
        // Mark as processed
        logoLink.dataset.customLogoApplied = "true";

        // Hide ALL child elements
        Array.from(logoLink.children).forEach((child) => {
            (child as HTMLElement).style.display = "none";
        });

        // Create custom logo image
        const customLogo = document.createElement("img");
        customLogo.src = chrome.runtime.getURL("assets/logo.png");
        customLogo.alt = "Logo";
        customLogo.style.height = "28px";
        customLogo.style.width = "auto";
        customLogo.style.objectFit = "contain";
        customLogo.style.display = "block";

        logoLink.appendChild(customLogo);
        console.log("Betclic logo replaced with custom logo");
    }
}

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
    replaceLogoWithCustom();
    scanAndInject();
});

window.addEventListener("load", () => {
    replaceLogoWithCustom();
    scanAndInject();
    observer.observe(document.body, { childList: true, subtree: true });
});
