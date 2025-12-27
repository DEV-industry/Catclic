export interface StatMarket {
    marketName: string;
    bets: {
        selection: string;
        odds: number;
        element: HTMLElement;
    }[];
}

export class MatchDetailsParser {
    // Selectors based on Betclic's structure
    private static TAB_CONTAINER_SELECTOR = '.tab-container, .sports-tab-bar, .markets-tabs';
    private static SUB_TAB_CONTAINER_SELECTOR = '.sub-tab-container, .market-types-tabs';

    static async navigateToTab(tabName: string): Promise<boolean> {
        // Try precise selector from user feedback
        // Structure: div.tab_list > div.tab_item > span.tab_link > span.tab_label
        const labels = Array.from(document.querySelectorAll('.tab_label, .tab-label, span[class*="label"], .tab span'));
        const targetLabel = labels.find(el => el.textContent?.trim().toLowerCase() === tabName.toLowerCase());

        if (targetLabel) {
            // Click the closest clickable parent (tab_item or tab_link)
            const clickable = targetLabel.closest('.tab_item, .tab_link, button, [role="button"]') as HTMLElement;
            if (clickable) {
                clickable.click();
                console.log(`Clicked tab wrapper for ${tabName}`);
                await new Promise(r => setTimeout(r, 1000));
                return true;
            } else {
                // Try clicking the label itself
                console.log(`Clicked tab label for ${tabName}`);
                (targetLabel as HTMLElement).click();
                await new Promise(r => setTimeout(r, 1000));
                return true;
            }
        }

        // Fallback: look for any text containing the name
        const allElements = Array.from(document.querySelectorAll('div, span, button'));
        const wideTarget = allElements.find(el =>
            el.textContent?.trim().toLowerCase() === tabName.toLowerCase() &&
            (el.classList.contains('tab_label') || el.classList.contains('tab-item') || el.tagName === 'BUTTON')
        );

        if (wideTarget) {
            console.log(`Clicked wide target for ${tabName}`);
            (wideTarget as HTMLElement).click();
            await new Promise(r => setTimeout(r, 1000));
            return true;
        }

        console.warn(`Tab ${tabName} not found.`);
        return false;
    }

    static async navigateToSubTab(subTabName: string): Promise<boolean> {
        // Subtabs might be chips or buttons.
        const candidates = Array.from(document.querySelectorAll('button, div[role="button"], span.chip-label, .chip'));
        const target = candidates.find(b => b.textContent?.trim().toLowerCase().includes(subTabName.toLowerCase()));

        if (target) {
            (target as HTMLElement).click();
            await new Promise(r => setTimeout(r, 800));
            return true;
        }
        return false;
    }

    static getMarketsFromCurrentView(): StatMarket[] {
        const markets: StatMarket[] = [];

        // Strategy: Look for market blocks.
        // The user screenshot shows "Rzuty rożne" as a header, and then rows "Powyżej x ... Poniżej x"
        // The container usually has a title.

        const marketContainers = Array.from(document.querySelectorAll('.marketBox, .market-container, .market-group, app-market-group, .marketWrapper, div[class*="market"], app-selection'));

        for (const container of marketContainers) {
            try {
                // Title
                const titleEl = container.querySelector('.marketBox_title, .market-title, .group-title, h2, h3, .marketHeader');
                const marketName = titleEl?.textContent?.trim() || "Unknown";
                if (!marketName || marketName === "Unknown") continue;

                // Buttons
                const betButtons = Array.from(container.querySelectorAll('button, .odd-button, .selection-button, .marketButton'));
                const bets = [];

                for (const btn of betButtons) {
                    // Label often separate from odd
                    const labelEl = btn.querySelector('.btn_label, .selection-label');
                    const oddEl = btn.querySelector('.btn_odd, .selection-odd');

                    const label = labelEl?.textContent?.trim() || btn.textContent?.replace(/\d+,\d+/, '').trim() || "";
                    const oddText = oddEl?.textContent?.trim() || btn.textContent?.match(/\d+,\d+/)?.[0] || "0";

                    const odd = parseFloat(oddText.replace(',', '.'));

                    if (label && !isNaN(odd)) {
                        bets.push({
                            selection: label,
                            odds: odd,
                            element: btn as HTMLElement
                        });
                    }
                }

                if (bets.length > 0) {
                    markets.push({ marketName, bets });
                }
            } catch (e) {
                console.warn("Error parsing market container:", e);
            }
        }

        // Fallback: If no structured markets found, scan for ANY odds buttons and group them by preceding text
        if (markets.length === 0) {
            console.log("No structured markets found. Using aggressive fallback.");
            const allButtons = Array.from(document.querySelectorAll('button'));
            const oddButtons = allButtons.filter(b => /\d+,\d{2}/.test(b.textContent || ""));

            if (oddButtons.length > 0) {
                // Mock market "Aggressive Scan"
                const bets = oddButtons.map(btn => ({
                    selection: btn.textContent?.replace(/\d+,\d+/, '').trim() || "Option",
                    odds: parseFloat(btn.textContent?.match(/\d+,\d+/)?.[0].replace(',', '.') || "0"),
                    element: btn as HTMLElement
                }));
                markets.push({ marketName: "Aggressive Scan", bets });
            }
        }

        return markets;
    }

    static async scanAdvancedMarkets(): Promise<StatMarket[]> {
        const allMarkets: StatMarket[] = [];

        // 1. Try to switch to "Statystyki"
        const enteredStats = await this.navigateToTab("Statystyki");
        if (!enteredStats) {
            console.log("Could not find 'Statystyki' tab. Trying to parse current view.");
        }

        // 2. Look for relevant sub-tabs: "Rzuty rożne", "Kartki", "Gole"
        // Just scrape whatever is visible first
        allMarkets.push(...this.getMarketsFromCurrentView());

        // Try to click accessible sub-tabs if we are in stats
        // (For now, we assume expanding all markets or scrolling might be needed but manual observation suggests they are often open or easily viewable)

        return allMarkets;
    }
}
