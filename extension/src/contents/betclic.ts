import type { PlasmoCSConfig } from "plasmo"
import { handleAutoCoupon, processAutoCoupon, getSession } from "../services/AutoCouponManager"
import { replaceLogoWithCustom, showLoadingOverlay } from "../services/UIService"
import { scanAndInject } from "../services/PredictionInjector"
import { startReasonInjector } from "../services/CouponManager"

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

console.log("Betclic Smart Predictor: Content Script Active")

// Inject styles globally since we are not using Shadow DOM for the portal
const style = getStyle();
document.head.appendChild(style);

// Observe DOM changes to handle infinite scroll / navigation
const observer = new MutationObserver((mutations) => {
    replaceLogoWithCustom();
    scanAndInject();
});

// Fast Restore Overlay
async function checkAndRestoreOverlay() {
    try {
        const session = await getSession();
        if (session.active) {
            // Show immediate overlay to prevent flash
            showLoadingOverlay(`Wczytywanie oferty... ${session.current}/${session.target}`);
        }
    } catch (e) {
        console.error("Failed to restore overlay:", e);
    }
}

// Run immediately to catch it as fast as possible
checkAndRestoreOverlay();


window.addEventListener("load", () => {
    replaceLogoWithCustom();
    scanAndInject();
    startReasonInjector();
    observer.observe(document.body, { childList: true, subtree: true });

    // Resume Auto-Coupon if active
    // The overlay is already shown by checkAndRestoreOverlay, so we can wait safe 2s for parsing
    setTimeout(processAutoCoupon, 2000);
});
