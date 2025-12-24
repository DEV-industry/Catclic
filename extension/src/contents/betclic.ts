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
        handleAutoCoupon(request.count || 3, request.filters);
    }
});

// --- HELPER: CHECK IF MATCH IS VALID (Date Filter) ---
function isMatchValid(element: HTMLElement, dateFilter: string): boolean {
    const text = element.innerText.toLowerCase();

    // 1. Filter: TODAY
    if (dateFilter === "today") {
        if (text.includes("jutro") || text.includes("pojutrze")) return false;
        if (text.includes("dzisiaj")) return true;

        // Strict date check for today
        const today = new Date();
        const d = String(today.getDate()).padStart(2, '0');
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const todayStr = `${d}.${m}`;
        const todayStrSlash = `${d}/${m}`;

        const dateMatches = text.match(/\d{1,2}[./]\d{2}/g);
        if (dateMatches) {
            // If date found is NOT today, return false
            return !dateMatches.some(date => date !== todayStr && date !== todayStrSlash);
        }
        return true; // Default to true if only time is shown
    }

    // 2. Filter: TOMORROW
    if (dateFilter === "tomorrow") {
        if (text.includes("jutro")) return true;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const d = String(tomorrow.getDate()).padStart(2, '0');
        const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const tomStr = `${d}.${m}`;
        const tomStrSlash = `${d}/${m}`;

        return text.includes(tomStr) || text.includes(tomStrSlash);
    }

    // 3. Filter: ALL
    return true;
}

// --- HELPER: CLEAR COUPON ---
async function clearCoupon() {
    console.log("Attempting to clear coupon...");

    // Helper: Wait function
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Helper: Get current bet count from header text (e.g. "8 zdarzeń")
    const getBetCount = (): number => {
        // Look for the header text containing "zdarzeń" or "events"
        const headers = Array.from(document.querySelectorAll('h2, span, div')) as HTMLElement[];
        const header = headers.find(el => el.innerText && /^\d+\s+(zdarzeń|events|bets)/i.test(el.innerText));

        if (header) {
            const num = parseInt(header.innerText.match(/^(\d+)/)?.[1] || "0", 10);
            return num;
        }

        // Fallback: Check number of remove buttons visible
        const removeBtns = document.querySelectorAll('button[aria-label="Usuń"], .basket-item-remove, .icon_cross');
        return removeBtns.length;
    };

    let initialCount = getBetCount();
    console.log(`Initial bet count: ${initialCount}`);

    if (initialCount === 0) {
        console.log("Coupon is already empty.");
        return;
    }

    // Strategy 1: "Remove All" (Bin Icon / Text)
    // Selectors found in typical Betclic HTML or common patterns
    const removeAllSelectors = [
        'button[aria-label="Usuń wszystko"]',
        '[data-qa="basket-remove-all"]',
        '.basket-header-action--remove',
        '.icon_trash',
        'button.basket-clear-btn'
    ];

    const removeAllBtn = document.querySelector(removeAllSelectors.join(', ')) as HTMLElement;

    if (removeAllBtn) {
        console.log("Found 'Remove All' button, clicking...");
        removeAllBtn.click();
        await wait(500); // Wait for potential modal

        // Confirm modal if exists
        const confirmSelectors = [
            'button.bcl-modal-footer__btn--primary',
            '[data-qa="modal-confirm"]',
            'button[data-test="modal-confirm-button"]',
            '.modal-footer button.primary'
        ];

        const confirmBtn = document.querySelector(confirmSelectors.join(', ')) as HTMLElement;
        if (confirmBtn) {
            console.log("Confirming removal...");
            confirmBtn.click();
            await wait(800);
        }

        // Check if cleared
        if (getBetCount() === 0) {
            console.log("Coupon cleared via 'Remove All'.");
            return;
        }
        console.log("Strategy 1 incomplete. Falling back to iterative.");
    }

    // Strategy 2: Iterative Delete (Count Aware)
    console.log("Strategy 1 failed/skipped. Trying iterative removal.");

    // Selectors for individual delete buttons (X icons)
    const removeSelectors = [
        '[data-qa="basket-item-remove"]',
        'button.basket-item-remove',
        '.basket-item__action--remove',
        '.icon_cross',
        'svg.bcl-basket-item__remove-icon',
        'button[aria-label="Usuń"]'
    ];

    // Safety limit to prevent infinite loops
    let safetyLimit = 30;
    let retryCount = 0;

    while (getBetCount() > 0 && safetyLimit > 0) {
        // Find the FIRST remove button currently in DOM
        const btn = document.querySelector(removeSelectors.join(', ')) as HTMLElement;

        if (!btn) {
            // Logic: Buttons might be hidden if coupon collapsed? 
            // Or maybe lagging.
            console.log("No remove buttons found but count > 0. UI might be lagging or collapsed.");

            if (retryCount < 3) {
                console.log("Retrying search...");
                retryCount++;
                await wait(500);
                continue;
            } else {
                break;
            }
        }

        // Reset retry count if we found a button
        retryCount = 0;

        // Try to click the wrapper button if we found an icon/svg
        const clickable = btn.closest('button') || btn;

        try {
            clickable.click();
        } catch (e) {
            console.error("Error clicking remove button", e);
        }

        // Wait for DOM update - Critical for React/Vue apps to re-render list
        await wait(400);
        safetyLimit--;
    }

    if (getBetCount() > 0) {
        console.warn(`Safety limit reached. Coupon still has ${getBetCount()} bets.`);
    } else {
        console.log("Coupon clearance complete.");
    }
}

// --- AUTO COUPON LOGIC ---

interface AutoCouponSession {
    active: boolean;
    target: number;
    current: number;
    visitedUrls: string[];
    filters: {
        date: string;
        sport: string;
    };
}

// --- HELPER: STORAGE ---
const getSession = async (): Promise<AutoCouponSession> => {
    const data = await chrome.storage.local.get("autoCouponSession");
    return data.autoCouponSession || {
        active: false,
        target: 0,
        current: 0,
        visitedUrls: [],
        filters: { date: "today", sport: "all" }
    };
};

const setSession = async (session: AutoCouponSession) => {
    await chrome.storage.local.set({ autoCouponSession: session });
};

// --- NAVIGATION HELPER ---
function navigateToNextLeague(visited: string[], sportFilter: string) {
    // Strategy: Find sidebar or main navigation links.
    // Betclic URLs usually contain "-s" (Sport) or "-c" (Competition) ids.
    // e.g., /pilka-nozna-s1, /premier-league-c3
    const set = new Set(visited);

    // Broaden selector to get most internal links
    const allLinks = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];

    // Filter relevant links
    const candidates = allLinks.filter(a => {
        const href = a.href;

        // 1. Must be same origin (internal link)
        if (!href.startsWith(window.location.origin)) return false;

        // 2. Avoid homepage/live
        if (href === window.location.origin + "/" || href.endsWith(".pl/")) return false;
        if (href.includes("/live/")) return false; // Usually want pre-match

        // 3. Avoid account/policy/irrelevant pages
        if (href.includes("my-account") || href.includes("terms") || href.includes("login")) return false;

        // 4. MUST match a content pattern (Sport or Competition ID)
        const isSportOrComp = /-[sc]\d+(\/|$)/.test(href);
        const isFootball = href.includes("pilka-nozna");

        if (!isSportOrComp && !isFootball) return false;

        // --- SPORT FILTER ---
        if (sportFilter !== "all") {
            const lowerHref = href.toLowerCase();
            if (sportFilter === "football" && !lowerHref.includes("pilka-nozna")) return false;
            if (sportFilter === "tennis" && !lowerHref.includes("tenis")) return false;
            if (sportFilter === "basketball" && !lowerHref.includes("koszykowka")) return false;
        }

        // 5. Avoid current and visited
        if (href === window.location.href) return false;
        if (set.has(href)) return false;

        return true;
    });

    if (candidates.length > 0) {
        // Prefer competition links (-c) over sport links (-s) if available, as they are more specific
        const compLinks = candidates.filter(a => a.href.includes("-c"));
        const finalPool = compLinks.length > 0 ? compLinks : candidates;

        // Pick random
        const next = finalPool[Math.floor(Math.random() * finalPool.length)];
        console.log("Navigating to next league:", next.href);
        showToast(`Przechodzę do: ${next.innerText || "kolejnej ligi"}...`);
        window.location.href = next.href;
    } else {
        console.log("No more leagues found to navigate.");
        showToast("Nie znaleziono więcej unikalnych lig do przeszukania.");
        setSession({
            active: false,
            target: 0,
            current: 0,
            visitedUrls: [],
            filters: { date: "today", sport: "all" }
        });
    }
}

// --- CORE LOGIC ---
async function processAutoCoupon() {
    const session = await getSession();
    if (!session.active) return;

    console.log("Processing Auto Coupon Session:", session);

    // 1. Find matches on current page
    const containers = MatchParser.findPossibleMatchContainers();
    let addedOnPage = 0;

    for (const container of containers) {
        if (session.current >= session.target) break;

        // Use Filter Check
        // Default to "today" if older session format
        const dateFilter = session.filters?.date || "today";
        if (!isMatchValid(container, dateFilter)) continue;

        const data = MatchParser.parse(container);
        if (!data || !data.elementA) continue;

        // Check if already selected (simple check if button is green/active?)
        // Assuming click for now
        data.elementA.scrollIntoView({ behavior: 'smooth', block: 'center' });
        data.elementA.click();

        // Visual flash
        const originalBg = data.elementA.style.backgroundColor;
        const el = data.elementA; // Capture for closure
        el.style.backgroundColor = "#4ade80";
        setTimeout(() => {
            if (el) el.style.backgroundColor = originalBg;
        }, 500);

        session.current++;
        addedOnPage++;

        // Small delay to prevent rate limit / UI glitch
        await new Promise(r => setTimeout(r, 400));
    }

    if (addedOnPage > 0) {
        showToast(`Dodano ${addedOnPage} meczy. Razem: ${session.current}/${session.target}`);
    }

    // 2. Check status
    if (session.current >= session.target) {
        showToast("Kupon gotowy! Zebrano wymaganą liczbę meczy.");
        await setSession({ ...session, active: false });
    } else {
        // Need more? Navigate!
        console.log(`Need ${session.target - session.current} more. Navigating...`);
        showToast(`Szukam dalej... Brakuje ${session.target - session.current}`);

        // Add current URL to visited
        session.visitedUrls.push(window.location.href);
        await setSession(session);

        // Navigate
        const sportFilter = session.filters?.sport || "all";
        setTimeout(() => navigateToNextLeague(session.visitedUrls, sportFilter), 1500);
    }
}

// --- TRIGGER ---
async function handleAutoCoupon(maxMatches: number, filters: { date: string, sport: string } = { date: "today", sport: "all" }) {
    // 1. Clear existing coupon first (Only on manual trigger)
    await clearCoupon();

    // 2. Start Session
    const session: AutoCouponSession = {
        active: true,
        target: maxMatches,
        current: 0,
        visitedUrls: [window.location.href],
        filters: filters
    };
    await setSession(session);

    // 3. Process current page immediately
    processAutoCoupon();
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
                content: none !important;
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

    // Resume Auto-Coupon if active
    setTimeout(processAutoCoupon, 2000); // Wait for initial load
});
