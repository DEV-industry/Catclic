import { MatchParser } from "./MatchParser"
import { clearCoupon, isMatchValid, getBetCount } from "./CouponManager"
import { showToast, showLoadingOverlay, hideLoadingOverlay } from "./UIService"

export interface AutoCouponSession {
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
export const getSession = async (): Promise<AutoCouponSession> => {
    const data = await chrome.storage.local.get("autoCouponSession");
    return data.autoCouponSession || {
        active: false,
        target: 0,
        current: 0,
        visitedUrls: [],
        filters: { date: "today", sport: "all" }
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
            filters: { date: "today", sport: "all" }
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

    // 0. STRICT SPORT CHECK
    const sportFilter = session.filters?.sport || "all";
    if (!isCurrentPageValidForSport(sportFilter)) {
        console.log(`Current page invalid for sport '${sportFilter}'. Navigating...`);
        session.visitedUrls.push(window.location.href);

        showLoadingOverlay(`Przechodzenie do kategorii: ${sportFilter}...`);
        navigateToSportCategory(sportFilter);
        // Note: verify if we need to hide overlay? Navigation usually clears page, but overlay might persist if SPA. 
        // Betclic seems to be MPA/SPA hybrid. Let's keep overlay until unload.
        return;
    }

    // 1. Find matches on current page
    showLoadingOverlay(`Skanowanie oferty... ${session.current}/${session.target}`);
    const containers = MatchParser.findPossibleMatchContainers();
    let addedOnPage = 0;

    for (const container of containers) {
        if (session.current >= session.target) break;

        const dateFilter = session.filters?.date || "today";
        if (!isMatchValid(container, dateFilter)) continue;

        const data = MatchParser.parse(container);
        if (!data || !data.elementA) continue;

        // Visual / Action
        data.elementA.scrollIntoView({ behavior: 'smooth', block: 'center' });
        data.elementA.click();

        const originalBg = data.elementA.style.backgroundColor;
        const el = data.elementA;
        el.style.backgroundColor = "#4ade80";
        setTimeout(() => { if (el) el.style.backgroundColor = originalBg; }, 500);

        session.current++;
        addedOnPage++;

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
        // Use max(currentCount, session.current) to be safe? 
        // Actually, if coupon says 2, we have 2. Update session to reflect reality
        session.current = currentCount;

        console.log(`Need ${session.target - session.current} more. Navigating...`);
        showToast(`Szukam dalej... Mamy ${session.current}/${session.target}`);

        showLoadingOverlay(`Szukam kolejnych lig... Brakuje ${session.target - session.current}`);

        session.visitedUrls.push(window.location.href);
        await setSession(session);

        setTimeout(() => navigateToNextLeague(session.visitedUrls, sportFilter), 1500);
    }
}

// --- TRIGGER ---
export async function handleAutoCoupon(maxMatches: number, filters: { date: string, sport: string } = { date: "today", sport: "all" }) {
    // 0. Show Overlay
    showLoadingOverlay("Inicjalizacja AI...");

    // 1. Clear existing coupon first (Only on manual trigger)
    const cleared = await clearCoupon();
    if (!cleared) {
        showToast("Błąd: Nie udało się wyczyścić kuponu. Spróbuj ręcznie.");
        hideLoadingOverlay();
        return;
    }

    showLoadingOverlay("Tworzenie sesji...");

    // 2. Start Session
    const session: AutoCouponSession = {
        active: true,
        target: maxMatches,
        current: 0,
        visitedUrls: [window.location.href],
        filters: filters
    };
    await setSession(session);

    // 3. CHECK SPORT LOCATION IMMEDIATELY
    if (!isCurrentPageValidForSport(filters.sport)) {
        showLoadingOverlay(`Przekierowanie do: ${filters.sport}`);
        navigateToSportCategory(filters.sport);
        return;
    }

    // 4. Process current page immediately if valid
    processAutoCoupon();
}
