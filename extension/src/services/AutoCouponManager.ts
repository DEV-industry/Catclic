import { MatchParser } from "./MatchParser"
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
    };
    liveRetryCount?: number;
    needsClearing?: boolean; // New flag to handle clearing after reload
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
        needsClearing: false
    };
};

export const setSession = async (session: AutoCouponSession) => {
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
            filters: { isLive: false, sport: "all" },
            liveRetryCount: 0
        });
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

    // Show Overlay immediately
    showLoadingOverlay(`AI analizuje mecze... ${session.current}/${session.target}`);

    console.log("Processing Auto Coupon Session:", session);

    // -1. CLEAR COUPON IF NEEDED (Handled here to support reload-based flow)
    if (session.needsClearing) {
        showLoadingOverlay("Czyszczenie kuponu...");
        const cleared = await clearCoupon();
        if (!cleared) {
            console.warn("Could not verify coupon is clear, but proceeding...");
        }
        session.needsClearing = false;
        await setSession(session);
    }

    // 0. STRICT LIVE / SPORT CHECK
    const isLive = session.filters?.isLive || false;
    const sportFilter = session.filters?.sport || "all";

    // 0a. Handle Live Navigation
    // 0a. Handle Live Navigation
    if (isLive) {
        if (!window.location.href.includes("/live")) {
            console.log("Live mode active. Navigating to Live section...");
            showLoadingOverlay("Przechodzenie do sekcji Na Żywo...");
            window.location.href = "https://www.betclic.pl/live";
            return;
        }

        // --- NEW: HANDLE LIVE SPORT FILTERS ---
        if (sportFilter !== "all") {
            // Map internal sport identifiers to UI labels found in the screenshot/DOM
            const sportLabels: Record<string, string> = {
                "football": "Piłka nożna",
                "basketball": "Koszykówka",
                "tennis": "Tenis"
            };

            const targetLabel = sportLabels[sportFilter];
            if (targetLabel) {
                // Find all filter items
                const validFilters = Array.from(document.querySelectorAll('.filters_item'));
                const targetFilter = validFilters.find(el => el.textContent?.includes(targetLabel));

                if (targetFilter) {
                    // Check if already active
                    const isActive = targetFilter.classList.contains('isActive') || targetFilter.querySelector('.isActive');

                    if (!isActive) {
                        console.log(`Switching Live Sport to: ${targetLabel}`);
                        showLoadingOverlay(`Filtrowanie: ${targetLabel}...`);
                        (targetFilter as HTMLElement).click();

                        // Wait for Angular/content update
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } else {
                    console.warn(`Could not find Live filter for: ${targetLabel}`);
                }
            }
        }
    } else {
        // Normal Sport Check (Only if not Live, as Live has its own structure)
        if (!isCurrentPageValidForSport(sportFilter)) {
            console.log(`Current page invalid for sport '${sportFilter}'. Navigating...`);
            session.visitedUrls.push(window.location.href);

            showLoadingOverlay(`Przechodzenie do kategorii: ${sportFilter}...`);
            navigateToSportCategory(sportFilter);
            return;
        }
    }

    // 1. Find matches on current page
    showLoadingOverlay(`Skanowanie oferty... ${session.current}/${session.target}`);
    const containers = MatchParser.findPossibleMatchContainers();
    let addedOnPage = 0;

    for (const container of containers) {
        if (session.current >= session.target) break;

        const isLive = session.filters?.isLive || false;
        if (!isMatchValid(container, isLive)) continue;

        const data = MatchParser.parse(container);
        if (!data || !data.elementA) continue;

        // Visual / Action
        // Check if already selected to simply skip?
        // Betclic usually adds 'is-selected' or similar. 
        if (data.elementA.classList.contains('is-selected') || data.elementA.classList.contains('selected')) {
            console.log("Match already selected, skipping...");
            continue;
        }

        data.elementA.scrollIntoView({ behavior: 'smooth', block: 'center' });
        data.elementA.click();

        const originalBg = data.elementA.style.backgroundColor;
        const el = data.elementA;
        el.style.backgroundColor = "#4ade80";
        setTimeout(() => { if (el) el.style.backgroundColor = originalBg; }, 500);

        session.current++;
        addedOnPage++;

        // Reset retry count on success
        if (session.liveRetryCount && session.liveRetryCount > 0) {
            session.liveRetryCount = 0;
            setSession(session);
        }

        // Update overlay
        showLoadingOverlay(`Dodano mecz: ${data.teamA} vs ${data.teamB} (${session.current}/${session.target})`);

        await new Promise(r => setTimeout(r, 400));
    }

    if (addedOnPage > 0) {
        showToast(`Dodano ${addedOnPage} meczy. Razem: ${session.current}/${session.target}`);
    }

    // 2. Check status
    const currentCount = getBetCount();
    console.log(`Status Check: Session ${session.current}/${session.target}, Actual on Slip: ${currentCount}`);

    // Update session current to match actual reality if possible, or trust the loop?
    // User wants strict check: verification happens here.

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
            // LIVE MODE STRATEGY:

            // Check if we are stuck
            if (addedOnPage === 0) {
                const retries = session.liveRetryCount || 0;
                if (retries >= 3) {
                    // STOP
                    console.log("Live mode: Max retries reached. Stopping.");
                    showToast("Nie znaleziono wystarczającej liczby meczy dla spełnienia kryteriów.");
                    await setSession({ ...session, active: false, liveRetryCount: 0 });
                    hideLoadingOverlay();
                    return;
                }

                console.log(`No new live matches found. Retry ${retries + 1}/3...`);
                showLoadingOverlay(`Szukam więcej meczów... (Próba ${retries + 1}/3)`);

                // Increment retry count
                session.liveRetryCount = retries + 1;
                await setSession(session);

                // Scroll
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 2000));
            } else {
                // We added something, so we are making progress. Reset retries implicitly (handled in loop or here)
                session.liveRetryCount = 0;
                await setSession(session);
            }

            // Proceed to next iteration
            setTimeout(processAutoCoupon, 1000);
            return;
        }

        // PRE-MATCH STRATEGY:
        showToast(`Szukam dalej... Mamy ${session.current}/${session.target}`);
        showLoadingOverlay(`Szukam kolejnych lig... Brakuje ${session.target - session.current}`);

        session.visitedUrls.push(window.location.href);
        await setSession(session);

        setTimeout(() => navigateToNextLeague(session.visitedUrls, sportFilter), 1500);
    }
}

// --- TRIGGER ---
export async function handleAutoCoupon(maxMatches: number, filters: { isLive: boolean, sport: string } = { isLive: false, sport: "all" }) {
    // 0. Show Overlay
    showLoadingOverlay("Inicjalizacja AI... Resetowanie widoku.");

    // 1. Prepare Session with NEEDS_CLEARING flag
    const session: AutoCouponSession = {
        active: true,
        target: maxMatches,
        current: 0,
        visitedUrls: [], // Reset visited
        filters: filters,
        liveRetryCount: 0,
        needsClearing: true // Flag to clear coupon after reload
    };

    await setSession(session);

    // 2. FORCE NAVIGATION TO HOME PAGE (Reset bug prevention)
    console.log("Forcing navigation to Home Page...");
    window.location.href = "https://www.betclic.pl/";
}
