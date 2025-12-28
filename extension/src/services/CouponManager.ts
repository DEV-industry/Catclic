
// --- HELPER: CHECK IF MATCH IS VALID (isLive Filter) ---
export function isMatchValid(element: HTMLElement, isLive: boolean): boolean {
    const text = element.innerText.toLowerCase();

    // 1. LIVE MODE
    if (isLive) {
        // If explicitly "Jutro" or "Pojutrze", definitely not live
        if (text.includes("jutro") || text.includes("pojutrze")) return false;

        // TRUST: If we are in Live mode (Auto Coupon triggered it), and we are on the Live Page,
        // we can assume the matches found are correctly filtered by the site.
        // The regex checks were too strict for some sports (e.g. Basketball "Q1").
        // We still check for "Jutro" to avoid "Suggested" widgets, but otherwise we permit it.
        return true;
    }

    // 2. STANDARD MODE (Default: Today)
    // CRITICAL FIX: Explicitly exclude matches that are ALREADY LIVE
    // User reported that live matches have class 'is-live'
    if (
        element.classList.contains('is-live') ||
        element.querySelector('.is-live') ||
        element.closest('.is-live')
    ) {
        console.log("Skipping live match (class detected) in standard mode:", text);
        return false;
    }

    // NEW: HREF Check (Robust)
    // If the match card links to a /live/ URL, it is definitely live.
    const link = element.tagName === 'A' ? element as HTMLAnchorElement : element.querySelector('a');
    if (link && link.href && link.href.includes('/live/')) {
        console.log("Skipping live match (href detected) in standard mode:", link.href);
        return false;
    }

    // Heuristic: Check for "Teraz" or time indications (e.g. 15', 90+2')
    if (text.includes("teraz") || /\d{1,2}'/.test(text)) {
        console.log("Skipping live match (text detected) in standard mode:", text);
        return false;
    }

    // Falls back to "Today" logic if not Live mode
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
    return true; // Default to true if only time is shown (implies today)
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// Helper: Find element by text content
const findByText = (selector: string, text: string): HTMLElement | undefined => {
    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    return elements.find(el => el.innerText && el.innerText.toLowerCase().includes(text.toLowerCase()));
};

// Helper: Get current bet count
export const getBetCount = (): number => {
    // Strategy: Target specific header title from screenshot
    const countEl = document.querySelector('.progressiveBettingSlip_headerTitle span') as HTMLElement;
    if (countEl && countEl.innerText) {
        const text = countEl.innerText;
        // Matches "0 zdarzeń", "1 zdarzenie", etc.
        const match = text.match(/^(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
    }

    // Fallback: older selectors just in case
    const headers = Array.from(document.querySelectorAll('h2, span, div')) as HTMLElement[];
    const header = headers.find(el => el.innerText && /^\d+\s+(zdarzeń|events|bets|zdarzenie)/i.test(el.innerText));

    if (header) {
        const num = parseInt(header.innerText.match(/^(\d+)/)?.[1] || "0", 10);
        return num;
    }

    return 0; // Default if nothing found, though unsafe.
};

// --- HELPER: CLEAR COUPON ---
export async function clearCoupon(): Promise<boolean> {
    console.log("Attempting to clear coupon [Iterative Mode]...");

    // Max attempts to prevent infinite loops (e.g. 20 events max)
    const MAX_ATTEMPTS = 20;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const currentCount = getBetCount();
        console.log(`Clear loop check: ${currentCount} items remaining (Iteration ${i + 1})`);

        if (currentCount === 0) {
            console.log("Coupon is empty. Success.");
            return true;
        }

        // Find any "remove" button (usually an X icon)
        // Selectors:
        // - .icon_close: Standard Betclic close icon
        // - button containing .icon_close
        // - bcdk-icon-close: sometimes used
        const closeIcons = Array.from(document.querySelectorAll('.icon_close, .icon_cross'));

        // Find the clickable button wrapper for this icon
        const removeBtn = closeIcons
            .map(icon => icon.closest('button'))
            .find(btn => btn !== null && btn.offsetParent !== null); // Check visibility roughly

        if (removeBtn) {
            console.log("Found remove button. Clicking...");
            removeBtn.click();

            // Wait for UI update/animation
            await wait(400);
        } else {
            console.warn("No specific remove button found, but count > 0.");
            // Fallback: If no button found but count > 0, maybe try searching for specific text buttons or just break?
            // Let's try to wait a bit potentially for UI to settle
            await wait(1000);

            // Re-check count, if still > 0 and no button, we might be stuck or selectors changed
            if (getBetCount() > 0) {
                console.error("Stuck: logic sees items but cannot find remove button.");
                // Heuristic: maybe they are under a "read more" or similar? Unlikely for coupon items.
                // Just continue to see if something appears, or break if consecutive fails?
                // For now, let loop continue to max attempts.
            }
        }
    }

    return getBetCount() === 0;
}
