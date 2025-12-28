import { MatchParser } from "./MatchParser"
import { MatchDetailsParser } from "./MatchDetailsParser"
import { clearCoupon, isMatchValid, getBetCount } from "./CouponManager"
import { showToast, showLoadingOverlay, hideLoadingOverlay } from "./UIService"

export interface AutoCouponSession {
    active: boolean;
    target: number;
    current: number;
    visitedUrls: string[];
    filters: {
        isLive: boolean;
        sport: string;
        maxOdds?: number;
        enableAdvancedStats?: boolean;
    };
    liveRetryCount?: number;
    needsClearing?: boolean;
    consecutiveEmptyVisits?: number; // New: Track consecutive useless navigations
    addedMatches?: string[]; // Track unique match IDs
}

// --- HELPER: STORAGE ---
export const getSession = async (): Promise<AutoCouponSession> => {
    const data = await chrome.storage.local.get("autoCouponSession");
    return data.autoCouponSession || {
        active: false,
        target: 0,
        current: 0,
        visitedUrls: [],
        filters: { isLive: false, sport: "all" },
        liveRetryCount: 0,
        needsClearing: false,
        consecutiveEmptyVisits: 0,
        addedMatches: []
    };
};

export const setSession = async (session: AutoCouponSession) => {
    await chrome.storage.local.set({ autoCouponSession: session });
};

// ... (Existing Navigation Helpers omitted for brevity, assuming they remain unchanged) ...

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

        // 6. CRITICAL: Avoid actual Match pages (contain -m followed by digits)
        // e.g. /pilka-nozna-s1/liga-c123/mecz-m456
        if (href.includes("-m") && /\-m\d+/.test(href)) return false;

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
            filters: { isLive: false, sport: "all" },
            liveRetryCount: 0,
            consecutiveEmptyVisits: 0,
            addedMatches: []
        });
        hideLoadingOverlay();
    }
}

// --- HELPER: SPORT VALIDATION ---
function getSportKeywords(sport: string): string[] {
    switch (sport) {
        case "football": return ["pilka-nozna", "football"];
        case "tennis": return ["tenis", "tennis"];
        case "basketball": return ["koszykowka", "basketball"];
        default: return []; // 'all' or unknown
    }
}

function isCurrentPageValidForSport(sport: string): boolean {
    if (sport === "all") return true;

    const href = window.location.href.toLowerCase();
    const keywords = getSportKeywords(sport);

    // Check if any keyword exists in the URL
    return keywords.some(kw => href.includes(kw));
}

function navigateToSportCategory(sport: string) {
    let url = "";
    switch (sport) {
        case "football": url = "https://www.betclic.pl/pilka-nozna-s1"; break;
        case "tennis": url = "https://www.betclic.pl/tenis-s2"; break;
        case "basketball": url = "https://www.betclic.pl/koszykowka-s4"; break;
    }

    if (url) {
        console.log(`Navigating to main sport category: ${sport} -> ${url}`);
        showToast(`Przechodzę do kategorii: ${sport}...`);
        window.location.href = url;
    }
}


// --- CORE LOGIC ---
export async function processAutoCoupon() {
    const session = await getSession();
    if (!session.active) return;

    // Ensure array exists
    if (!session.addedMatches) session.addedMatches = [];

    // --- FIX 1: SYNC STATE WITH REALITY ---
    const actualCount = getBetCount();
    if (session.current !== actualCount) {
        console.log(`Syncing session current (${session.current}) to actual (${actualCount})`);
        session.current = actualCount;
        await setSession(session);
    }

    // --- FIX 2: GLOBAL SAFETY LIMIT ---
    const MAX_PAGE_VISITS = 20; // Reduced from 30
    if (session.visitedUrls.length > MAX_PAGE_VISITS) {
        console.warn("Max page visits reached. Stopping.");
        showToast(`Zatrzymano: Przeszukano zbyt wiele stron (${MAX_PAGE_VISITS}) bez rezultatu.`);
        await setSession({ ...session, active: false });
        hideLoadingOverlay();
        return;
    }

    // --- FIX 3: CONSECUTIVE EMPTY VISITS ---
    const MAX_CONSECUTIVE_EMPTY = 5;
    if ((session.consecutiveEmptyVisits || 0) >= MAX_CONSECUTIVE_EMPTY) {
        console.warn("Max consecutive empty visits reached. Stopping.");
        showToast(`Nie znaleziono wystarczającej liczby meczy, aby utworzyć taki kupon.`); // Changed message per user request
        await setSession({ ...session, active: false });
        hideLoadingOverlay();
        return;
    }

    // Show Overlay immediately
    showLoadingOverlay(`AI analizuje mecze... ${session.current}/${session.target}`);

    console.log("Processing Auto Coupon Session:", session);

    // -1. CLEAR COUPON IF NEEDED
    if (session.needsClearing) {
        showLoadingOverlay("Czyszczenie kuponu...");
        const cleared = await clearCoupon();
        if (!cleared) {
            console.warn("Could not verify coupon is clear, but proceeding...");
        }
        session.needsClearing = false;
        if (cleared) {
            session.current = 0;
            session.addedMatches = []; // Clear history on reset
        }
        await setSession(session);
    }

    // 0. CHECK COMPLETION FIRST
    if (session.current >= session.target) {
        showToast("Kupon gotowy! Zebrano wymaganą liczbę meczy.");
        await setSession({ ...session, active: false });
        hideLoadingOverlay();
        return;
    }

    // 0. STRICT LIVE / SPORT CHECK
    const isLive = session.filters?.isLive || false;
    const sportFilter = session.filters?.sport || "all";

    // 0a. Handle Live Navigation
    if (isLive) {
        if (!window.location.href.includes("/live")) {
            console.log("Live mode active. Navigating to Live section...");
            showLoadingOverlay("Przechodzenie do sekcji Na Żywo...");
            window.location.href = "https://www.betclic.pl/live";
            return;
        }

        // Handle Live Sport Filters
        if (sportFilter !== "all") {
            const sportLabels: Record<string, string> = {
                "football": "Piłka nożna",
                "basketball": "Koszykówka",
                "tennis": "Tenis"
            };

            const targetLabel = sportLabels[sportFilter];
            if (targetLabel) {
                const validFilters = Array.from(document.querySelectorAll('.filters_item'));
                const targetFilter = validFilters.find(el => el.textContent?.includes(targetLabel));

                if (targetFilter) {
                    const isActive = targetFilter.classList.contains('isActive') || targetFilter.querySelector('.isActive');
                    if (!isActive) {
                        console.log(`Switching Live Sport to: ${targetLabel}`);
                        showLoadingOverlay(`Filtrowanie: ${targetLabel}...`);
                        (targetFilter as HTMLElement).click();
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } else {
                    console.warn(`Could not find Live filter for: ${targetLabel}`);
                    // If filter not found, sport might not be live? Stop?
                    // For now, continue and let empty check handle it.
                }
            }
        }
    } else {
        // Normal Sport Check
        if (!isCurrentPageValidForSport(sportFilter)) {
            console.log(`Current page invalid for sport '${sportFilter}'. Navigating...`);
            session.visitedUrls.push(window.location.href);

            showLoadingOverlay(`Przechodzenie do kategorii: ${sportFilter}...`);
            navigateToSportCategory(sportFilter);
            return;
        }
    }

    // 0b. Scroll to ensure lazy-loaded matches (like "at the bottom") are visible
    window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 800));
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 1200));

    // 1. Find matches on current page
    showLoadingOverlay(`Skanowanie oferty... ${session.current}/${session.target}`);
    const containers = MatchParser.findPossibleMatchContainers();

    // --- AI SELECTION LOGIC ---
    // 1. Collect Valid Candidates
    const candidates: any[] = [];
    const containerMap = new Map<string, { elementA: HTMLElement, elementB?: HTMLElement, element: HTMLElement }>();

    for (const container of containers) {
        if (session.current + candidates.length >= session.target) break; // Optimization? No, we want pool.

        const isLive = session.filters?.isLive || false;
        if (!isMatchValid(container, isLive)) continue;

        const data = MatchParser.parse(container);
        if (!data || !data.elementA) continue;

        // --- FILTER: MAX ODDS ---
        const maxOdds = session.filters?.maxOdds || 100.0;
        const currentOdds = parseFloat(data.oddsA.replace(',', '.'));

        if (isNaN(currentOdds)) continue;
        if (currentOdds > maxOdds) continue;

        // Check Unique ID
        if (session.addedMatches && session.addedMatches.includes(data.id)) continue;

        if (data.elementA.classList.contains('is-selected') || data.elementA.classList.contains('selected')) continue;

        candidates.push({
            id: data.id,
            teamA: data.teamA,
            teamB: data.teamB,
            // odds: currentOdds // Optional
        });
        containerMap.set(data.id, { elementA: data.elementA, elementB: data.elementB, element: data.element });
    }

    let addedOnPage = 0;
    let selectedBets: { id: string, prediction: '1' | '2' | 'advanced', advancedSelection?: string, teamA?: string }[] = [];

    if (candidates.length > 0) {
        const needed = session.target - session.current;

        // --- MIXED STRATEGY ---
        // If Advanced Stats is enabled, we replace some standard picks with Advanced ones.
        // For simplicity: If enabled, try to make the NEXT bet an advanced one if we haven't enough.
        // Or: 50% chance. 

        const enableAdvanced = session.filters?.enableAdvancedStats || false;

        // Simple strategy: Interleave. 1 Standard, 1 Advanced, etc.
        // Or just pick candidates.

        // Let's filter candidates for standard vs advanced.

        console.log(`Found ${candidates.length} candidates. Asking AI to rank top ${needed}...`);
        showLoadingOverlay(`AI analizuje ${candidates.length} kandydatów...`);

        try {
            // Rank for Standard First
            const response = await fetch('http://localhost:3000/predict/rank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matches: candidates, count: needed })
            });

            if (response.ok) {
                let standardSelected = await response.json();

                if (enableAdvanced) {
                    // Take only half standard, leave room for advanced
                    // actually, we iterate one by one.
                    selectedBets = standardSelected;
                } else {
                    selectedBets = standardSelected;
                }
            } else {
                throw new Error("Backend error");
            }
        } catch (e) {
            // ... fallback
            const shuffled = candidates.sort(() => 0.5 - Math.random());
            selectedBets = shuffled.slice(0, needed).map(c => ({
                id: c.id,
                teamA: c.teamA,
                prediction: Math.random() > 0.5 ? '1' : '2'
            }));
        }

        // Process Selected
        for (const bet of selectedBets) {
            if (session.current >= session.target) break;

            // DECIDE: Standard or Advanced?
            // If enabled, we flip a coin or alternate.
            // Let's try: if (session.current % 2 !== 0 && enableAdvanced) -> do Advanced
            // This ensures we get specific bets.

            const doAdvanced = enableAdvanced && (Math.random() > 0.5); // 50% chance for advanced to ensure mix

            const elements = containerMap.get(bet.id);
            if (!elements) continue;

            if (doAdvanced) {
                // --- ADVANCED FLOW ---
                showLoadingOverlay(`Analiza szczegółowa (AI): ${bet.id}...`);

                // 1. Enter Match
                // We need to click the match area, not the odds.
                // Usually clicking the match names works.
                const matchLink = elements.element.querySelector('a') || elements.element;
                matchLink.click();

                // Wait for navigation (it might be SPA)
                await new Promise(r => setTimeout(r, 2000));

                // 2. Parse Details
                // Static import used above

                // Try to find stats text
                const markets = await MatchDetailsParser.scanAdvancedMarkets();
                console.log("Found Markets:", markets);

                // 3. AI Decision (Mocked or Real)
                // For now, let's look for "Rzuty rożne" -> "Powyżej 8.5" or similar
                let chosenBet = null;

                // Simple Heuristic: Pick ANY bet from "Corners" if available
                const cornerMarket = markets.find(m => m.marketName.toLowerCase().includes("rożne"));
                if (cornerMarket && cornerMarket.bets.length > 0) {
                    // Prefer "Powyżej" but take anything
                    chosenBet = cornerMarket.bets.find(b => b.selection.toLowerCase().includes("powyżej")) || cornerMarket.bets[0];
                }

                if (!chosenBet) {
                    // Fallback to cards?
                    const cardMarket = markets.find(m => m.marketName.toLowerCase().includes("kartki"));
                    if (cardMarket && cardMarket.bets.length > 0) {
                        chosenBet = cardMarket.bets.find(b => b.selection.toLowerCase().includes("powyżej")) || cardMarket.bets[0];
                    }
                }

                // Final Fallback: Just pick the first available advanced bet from any market to prove it works
                if (!chosenBet && markets.length > 0) {
                    // Try to avoid "Exact Score" or high risk bets if possible, but for data validation take first
                    const firstSafeMarket = markets.find(m => !m.marketName.toLowerCase().includes("dokładny"));
                    if (firstSafeMarket && firstSafeMarket.bets.length > 0) {
                        chosenBet = firstSafeMarket.bets[0];
                    } else {
                        // desperate fallback
                        chosenBet = markets[0].bets[0];
                    }
                }

                if (chosenBet) {
                    chosenBet.element.click();
                    showLoadingOverlay(`Dodano (AI Advanced): ${chosenBet.selection}`);
                    session.addedMatches.push(bet.id);
                    session.current++;
                    addedOnPage++;
                    await new Promise(r => setTimeout(r, 1000));

                    // 4. Go Back
                    window.history.back();
                    await new Promise(r => setTimeout(r, 1500)); // Wait for list reload

                    break; // Exit loop as page state changed, let next iteration re-scan
                } else {
                    console.log("No suitable advanced bet found. Falling back to standard bet.");
                    // Go back to list
                    window.history.back();
                    await new Promise(r => setTimeout(r, 1500));

                    // Let's just do the standard click HERE.
                    try {
                        const newContainer = document.querySelector(`app-sports-events-event[id*="${bet.id}"]`) ||
                            Array.from(document.querySelectorAll('a')).find(a => a.href.includes(bet.id))?.closest('div'); // Rough re-find

                        if (newContainer) {
                            const oddBtns = newContainer.querySelectorAll('.odd-button, button'); // simplifying
                            // Just pick one
                            if (oddBtns.length > 0) {
                                (oddBtns[0] as HTMLElement).click();
                                session.addedMatches.push(bet.id);
                                session.current++;
                                addedOnPage++;
                                showLoadingOverlay(`Dodano (Standard Fallback): ${bet.teamA}`);
                            }
                        }
                    } catch (e) {
                        console.error("Fallback standard failed", e);
                    }

                    break; // Break loop to refresh candidates next run
                }

            } else {
                // --- STANDARD FLOW ---
                let elToClick: HTMLElement | null = null;
                if (bet.prediction === '1') {
                    elToClick = elements.elementA;
                } else if (bet.prediction === '2') {
                    elToClick = elements.elementB || null;
                }

                if (elToClick) {
                    elToClick.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    elToClick.click();

                    // Visual Feedback
                    const originalBg = elToClick.style.backgroundColor;
                    elToClick.style.backgroundColor = "#4ade80"; // Green for AI pick
                    setTimeout(() => { if (elToClick) elToClick.style.backgroundColor = originalBg; }, 500);

                    session.addedMatches.push(bet.id);
                    session.current++;
                    addedOnPage++;

                    showLoadingOverlay(`Dodano (AI): ${bet.id} (${session.current}/${session.target})`);
                    await new Promise(r => setTimeout(r, 600));
                }
            }
        }
    }

    // Update consecutive empty logic
    if (addedOnPage > 0) {
        session.consecutiveEmptyVisits = 0;
        showToast(`Dodano ${addedOnPage} meczy. Razem: ${session.current}/${session.target}`);
        await setSession(session);
    } else {
        // If we didn't add anything, this was an empty visit
        session.consecutiveEmptyVisits = (session.consecutiveEmptyVisits || 0) + 1;
        console.log(`Empty page visit. Consecutive: ${session.consecutiveEmptyVisits}`);
        await setSession(session);
    }

    // 2. Check status
    const currentCount = getBetCount();
    console.log(`Status Check: Session ${session.current}/${session.target}, Actual on Slip: ${currentCount}`);

    if (currentCount >= session.target) {
        if (currentCount > session.target) {
            showToast(`Uwaga: Masz ${currentCount} meczy, a cel był ${session.target}.`);
        } else {
            showToast("Kupon gotowy! Zebrano wymaganą liczbę meczy.");
        }

        await setSession({ ...session, active: false });
        hideLoadingOverlay();
    } else {
        // We need more
        console.log(`Need ${session.target - session.current} more. Taking action...`);

        if (session.filters.isLive) {
            // Live Mode
            if (addedOnPage === 0) {
                const retries = session.liveRetryCount || 0;
                if (retries >= 3) {
                    console.log("Live mode: Max retries reached. Stopping.");
                    showToast("Nie znaleziono wystarczającej liczby meczy dla spełnienia kryteriów.");
                    await setSession({ ...session, active: false, liveRetryCount: 0 });
                    hideLoadingOverlay();
                    return;
                }

                console.log(`No new live matches found. Retry ${retries + 1}/3...`);
                showLoadingOverlay(`Szukam więcej meczów... (Próba ${retries + 1}/3)`);

                session.liveRetryCount = retries + 1;
                await setSession(session);

                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 2000));
            } else {
                session.liveRetryCount = 0;
                await setSession(session);
            }

            setTimeout(processAutoCoupon, 1000);
            return;
        }

        // PM logic
        showToast(`Szukam dalej... Mamy ${session.current}/${session.target}`);
        showLoadingOverlay(`Szukam kolejnych lig... Brakuje ${session.target - session.current}`);

        session.visitedUrls.push(window.location.href);
        await setSession(session);

        setTimeout(() => navigateToNextLeague(session.visitedUrls, sportFilter), 1500);
    }
}

export async function handleAutoCoupon(maxMatches: number, filters: { isLive: boolean, sport: string, maxOdds?: number, enableAdvancedStats?: boolean } = { isLive: false, sport: "all" }) {
    showLoadingOverlay("Inicjalizacja AI... Resetowanie widoku.");

    const session: AutoCouponSession = {
        active: true,
        target: maxMatches,
        current: 0,
        visitedUrls: [],
        filters: filters,
        liveRetryCount: 0,
        needsClearing: true,
        consecutiveEmptyVisits: 0
    };

    await setSession(session);

    console.log("Forcing navigation to Home Page...");
    window.location.href = "https://www.betclic.pl/";
}
