
// --- HELPER: CHECK IF MATCH IS VALID (Date Filter) ---
export function isMatchValid(element: HTMLElement, dateFilter: string): boolean {
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

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// Helper: Find element by text content
const findByText = (selector: string, text: string): HTMLElement | undefined => {
    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    return elements.find(el => el.innerText && el.innerText.toLowerCase().includes(text.toLowerCase()));
};

// Helper: Get current bet count
const getBetCount = (): number => {
    const headers = Array.from(document.querySelectorAll('h2, span, div')) as HTMLElement[];
    const header = headers.find(el => el.innerText && /^\d+\s+(zdarzeń|events|bets|zdarzenie)/i.test(el.innerText));

    if (header) {
        const num = parseInt(header.innerText.match(/^(\d+)/)?.[1] || "0", 10);
        return num;
    }

    // Fallback checks
    const removeBtns = document.querySelectorAll('button[aria-label="Usuń"], .basket-item-remove, .icon_cross');
    return removeBtns.length;
};

// --- HELPER: CLEAR COUPON ---
export async function clearCoupon() {
    console.log("Attempting to clear coupon...");

    let initialCount = getBetCount();
    console.log(`Initial bet count: ${initialCount}`);

    if (initialCount === 0) {
        console.log("Coupon is already empty.");
        return;
    }

    // --- Strategy 1: "Remove All" via Menu (Three dots -> Remove all) ---
    console.log("Strategy 1: Trying 'Three Dots' menu removal...");

    // 1. Find the menu button
    const couponHeader = document.querySelector('.basket-header, .bcl-basket-header') as HTMLElement;

    if (couponHeader) {
        const buttons = Array.from(couponHeader.querySelectorAll('button'));
        // Prioritize buttons that look like "More options"
        let menuBtn = buttons.find(b =>
            /więcej|more|opcje|options/i.test(b.ariaLabel || "") ||
            /dots|kebab/i.test(b.innerHTML) ||
            b.querySelector('.icon_dots') ||
            b.querySelector('.icon_kebab')
        );

        // Fallback to the last button in the header if no specific icon found
        if (!menuBtn) menuBtn = buttons[buttons.length - 1];

        if (menuBtn) {
            console.log("Clicking menu button...", menuBtn);
            menuBtn.click();
            await wait(600); // Wait for menu to open

            // 2. Find "Usuń wszystkie zakłady" option
            // Search globally as it might be in a portal
            const removeText = "usuń wszystkie";
            const removeOption = findByText('button, li, div[role="button"], span', removeText);

            if (removeOption) {
                console.log("Found 'Usuń wszystkie' option, clicking...", removeOption);
                // Ensure we click the interactive element if we found a span
                const clickable = removeOption.closest('button, li, div[role="button"]') as HTMLElement || removeOption;
                clickable.click();
                await wait(800); // Wait for modal

                // 3. Confirm Modal
                // Look for primary action button in a modal footer
                const confirmBtn = document.querySelector(
                    'button.bcl-modal-footer__btn--primary, [data-qa="modal-confirm"], button[data-test="modal-confirm-button"], .modal-footer button.primary'
                ) as HTMLElement;

                if (confirmBtn) {
                    console.log("Confirming removal...");
                    confirmBtn.click();
                    await wait(1000); // Wait for action to complete
                } else {
                    console.warn("Confirmation button not found!");
                }
            } else {
                console.log("Option 'Usuń wszystkie' not found in menu.");
            }
        }
    }

    // Check if cleared
    if (getBetCount() === 0) {
        console.log("Coupon cleared via Strategy 1.");
        return;
    }

    // --- Strategy 2: Direct "Remove All" (Bin Icon) ---
    console.log("Strategy 1 failed/incomplete. Trying Strategy 2 (Direct Bin Icon)...");

    const removeAllBtn = document.querySelector(
        'button[aria-label="Usuń wszystko"], [data-qa="basket-remove-all"], .basket-header-action--remove, .icon_trash'
    ) as HTMLElement;

    if (removeAllBtn) {
        console.log("Found Direct 'Remove All' button, clicking...");
        removeAllBtn.click();
        await wait(600);

        // Confirm modal
        const confirmBtn = document.querySelector(
            'button.bcl-modal-footer__btn--primary, [data-qa="modal-confirm"]'
        ) as HTMLElement;

        if (confirmBtn) {
            confirmBtn.click();
            await wait(1000);
        }

        if (getBetCount() === 0) {
            console.log("Coupon cleared via Strategy 2.");
            return;
        }
    }

    // --- Strategy 3: Iterative Delete (Fallback) ---
    console.log("Strategies 1 & 2 failed. Falling back to Iterative Removal.");

    let safetyLimit = 20;
    while (getBetCount() > 0 && safetyLimit > 0) {
        // Find any remove button (X icon)
        const removeBtns = document.querySelectorAll(
            '[data-qa="basket-item-remove"], button.basket-item-remove, .basket-item__action--remove, .icon_cross, svg.bcl-basket-item__remove-icon'
        );

        if (removeBtns.length === 0) break;

        const btn = removeBtns[0] as HTMLElement;
        const clickable = btn.closest('button') || btn;

        try {
            clickable.click();
        } catch (e) { console.error(e); }

        await wait(300); // Fast iteration
        safetyLimit--;
    }

    if (getBetCount() === 0) {
        console.log("Coupon cleared via Iterative Strategy.");
    } else {
        console.warn("Failed to fully clear coupon.");
    }
}
