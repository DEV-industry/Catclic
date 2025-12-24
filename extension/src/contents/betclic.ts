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

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ACTION_SKLEJ_KUPON") {
        console.log("Received Sklej Kupon command", request);
        handleAutoCoupon(request.count || 3);
    }
});

// --- HELPER: CHECK IF MATCH IS TODAY ---
function isToday(element: HTMLElement): boolean {
    // Strategy: Look for time text or "Dzisiaj".
    // 1. Check for "Dzisiaj" text explicitly
    if (element.innerText.includes("Dzisiaj")) return true;

    // 2. Check for date patterns (dd.mm or dd/mm)
    // If we see a date like "27.12" or "27/12" and it's NOT today's date, return false.
    // If matches only have HH:MM, they are usually today.

    // Heuristic: If it contains a date format that is NOT today, assuming non-today.
    // However, Betclic mostly shows "Dzisiaj" or just time for today.
    // Future matches show "Jutro" or "Pt. 27/12".

    // So, strict check:
    // If it says "Jutro", "Pojutrze", or match regex for future date -> False
    // If it says "Dzisiaj" or has NO date (only time) -> True (risky but common)

    const text = element.innerText;

    if (text.includes("Jutro")) return false;
    if (text.includes("Pojutrze")) return false;

    // Check for DD.MM format
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const todayStr = `${day}.${month}`; // 24.12
    const todayStrSlash = `${day}/${month}`; // 24/12

    // Find all dates in text
    const dateMatches = text.match(/\d{1,2}[./]\d{2}/g);
    if (dateMatches) {
        // If any date found is NOT today, then it's not today
        // (Assuming a match container doesn't contain multiple dates for different events)
        const isFuture = dateMatches.some(d => d !== todayStr && d !== todayStrSlash);
        if (isFuture) return false;
    }

    return true; // Default to true if no counter-evidence found (e.g. only time shown)
}

// --- HELPER: CLEAR COUPON ---
async function clearCoupon() {
    console.log("Attempting to clear coupon...");

    // Strategy 1: Look for a "Remove All" / Trash icon button in the basket header
    // Betclic often has a trash icon: .icon_trash, or a button with "Wyczyść"
    const removeAllBtn = document.querySelector('button.basket-header-action--remove, .icon_trash, [data-qa="basket-remove-all"]') as HTMLElement;

    if (removeAllBtn) {
        console.log("Found 'Remove All' button, clicking...");
        removeAllBtn.click();

        // Sometimes a confirmation modal appears "Czy na pewno chcesz usunąć?"
        // We need to wait a tiny bit and confirm if it shows up
        await new Promise(r => setTimeout(r, 300));
        const confirmBtn = document.querySelector('button.bcl-modal-footer__btn--primary, [data-qa="modal-confirm"]') as HTMLElement;
        if (confirmBtn) {
            confirmBtn.click();
        }
        await new Promise(r => setTimeout(r, 500)); // Wait for clearance
        return;
    }

    // Strategy 2: Click individual remove buttons (X) for each bet
    const removeButtons = Array.from(document.querySelectorAll('button.basket-item-remove, .icon_cross, [data-qa="basket-item-remove"]'));
    if (removeButtons.length > 0) {
        console.log(`Found ${removeButtons.length} individual bets to remove.`);
        for (const btn of removeButtons) {
            (btn as HTMLElement).click();
            await new Promise(r => setTimeout(r, 100)); // Small delay between clicks
        }
        await new Promise(r => setTimeout(r, 500)); // Wait for final clearance
    }
}

// --- AUTO COUPON LOGIC ---
async function handleAutoCoupon(maxMatches: number) {
    // 1. Clear existing coupon first
    await clearCoupon();

    const containers = MatchParser.findPossibleMatchContainers();
    console.log(`Found ${containers.length} potential matches for coupon`);

    let addedCount = 0;


    // Use a Set to avoid adding multiple bets from same match (though simple iteration usually suffices)

    for (const container of containers) {
        if (addedCount >= maxMatches) break;

        // DATE FILTER
        if (!isToday(container)) {
            // console.log("Skipping match, not today");
            continue;
        }

        const data = MatchParser.parse(container);
        if (!data || !data.elementA) continue;

        // STRATEGY: Select Home Team (elementA) for now.
        // In future: Use prediction logic to select the best one.
        const targetButton = data.elementA;

        // Check if already selected (Betclic adds 'is-selected' or similar class usually, depends on site)
        // If we can't detect, clicking it again might toggle it OFF. 
        // For now, let's assume we want to click it.

        // Scroll into view gently
        targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Click
        targetButton.click();

        // Visual feedback
        const originalBg = targetButton.style.backgroundColor;
        targetButton.style.backgroundColor = "#4ade80"; // flash green
        setTimeout(() => {
            targetButton.style.backgroundColor = originalBg;
        }, 500);

        console.log(`Added match to coupon: ${data.teamA} vs ${data.teamB}`);
        addedCount++;
    }

    if (addedCount > 0) {
        showToast(`Dodano ${addedCount} mecze z dnia dzisiejszego!`);
    } else {
        showToast("Nie znaleziono odpowiednich meczów na dzisiaj.");
    }
}

function showToast(message: string) {
    const toast = document.createElement("div");
    toast.textContent = message;
    Object.assign(toast.style, {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#151519",
        color: "white",
        padding: "12px 24px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        zIndex: "999999",
        fontFamily: "sans-serif",
        border: "1px solid #2a2a2f"
    });
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.5s";
        setTimeout(() => toast.remove(), 500);
    }, 3000);
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
