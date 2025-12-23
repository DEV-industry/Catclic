export interface MatchData {
    element: HTMLElement;
    teamA: string;
    teamB: string;
    oddsA: string;
    oddsB: string;
    elementA?: HTMLElement;
    elementB?: HTMLElement;
    id: string; // Unique ID to prevent double injection
}

export class MatchParser {
    // Heuristic selectors - user might need to adjust these
    // Based on common betting site structures (often deeply nested divs)
    private static TEAM_SELECTOR = '.team-name, [class*="team"], [class*="Team"]';
    private static ODDS_SELECTOR = '.odds-value, [class*="oddValue"], [class*="Odd"]';

    static parse(container: HTMLElement): MatchData | null {
        // 1. Specific Selector Strategy (Betclic)
        // Find all odds buttons directly
        const oddButtons = Array.from(container.querySelectorAll('button.btn.is-odd, .odd-button'));

        if (oddButtons.length >= 2) {
            const elemA = oddButtons[0] as HTMLElement;
            // For 3-way (1X2), the last one is Away (2). For 2-way, the last one is Away (2).
            const elemB = oddButtons[oddButtons.length - 1] as HTMLElement;

            // Extract text from the "value" span if it exists, otherwise innerText
            const getValue = (el: HTMLElement) => {
                // Betclic structure: span.btn_label containing the value
                const valueSpan = el.querySelector('.btn_label:not(.is-top)') || el;
                return valueSpan.textContent?.trim() || "";
            };

            const oddsA = getValue(elemA);
            const oddsB = getValue(elemB);

            // Basic validation that we actually have numbers
            if (!/\d/.test(oddsA) || !/\d/.test(oddsB)) return null;

            // Try to find team names
            let teamA = "Home";
            let teamB = "Away";

            // Heuristic: Usually team names are in 'span.scoreboard_contestantLabel' or similar
            // But strict Betclic selector might be 'vertical-scroller .contestants-label' or similar
            // Let's try to find any text nodes that aren't odds in the container
            const teamElements = Array.from(container.querySelectorAll('.scoreboard_contestantLabel, .team-name, .card-participant'));
            if (teamElements.length >= 2) {
                teamA = teamElements[0].textContent?.trim() || "Home";
                teamB = teamElements[1].textContent?.trim() || "Away";
            } else {
                // Fallback: try to split the ID or look for other common classes
                const potentialNames = container.innerText.split('\n').filter(t => t.length > 2 && !t.match(/\d/));
                if (potentialNames.length >= 2) {
                    teamA = potentialNames[0].trim();
                    teamB = potentialNames[1].trim();
                }
            }

            return {
                element: container,
                teamA,
                teamB,
                oddsA,
                oddsB,
                elementA: elemA,
                elementB: elemB,
                id: `match-${oddsA}-${oddsB}` // Note: Ideally should use team names in ID too if stable
            };
        }

        // 2. Fallback to Heuristic Strategy (DISABLED to prevent false positives)
        // The user reported "Potential Winnings" being highlighted, which means strict selectors are better.
        return null;
    }

    static findPossibleMatchContainers(root: Document | HTMLElement = document): HTMLElement[] {
        // Strategy 1: Look for specific Betclic Event Cards (Top Level Only)
        // We avoid selecting child containers (like markets) to prevent double-injection
        const specificCards = Array.from(root.querySelectorAll('app-sports-events-event, .cardEvent'));

        if (specificCards.length > 0) {
            return specificCards as HTMLElement[];
        }

        // Strategy 2: Heuristic (Backup) - Only if specific cards not found
        // But be careful not to pick up the sidebar
        const allDivs = Array.from(root.querySelectorAll('div, a, li')) as HTMLElement[];
        return allDivs.filter(div => {
            if (div.children.length > 50) return false;
            if (div.innerText.length > 500) return false;

            // Exclude common sidebar classes
            if (div.className.includes('coupon') || div.className.includes('basket') || div.className.includes('summary')) return false;

            const text = div.innerText;
            // Check for at least 2 pattern matches of odds (e.g. 1.50 or 1,50)
            const decimals = text.match(/(\d+[.,]\d{2})/g);
            return decimals && decimals.length >= 2;
        });
    }
}
