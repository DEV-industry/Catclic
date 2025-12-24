import type { PlasmoCSConfig } from "plasmo"
import { handleAutoCoupon, processAutoCoupon } from "../services/AutoCouponManager"
import { replaceLogoWithCustom } from "../services/UIService"
import { scanAndInject } from "../services/PredictionInjector"

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

window.addEventListener("load", () => {
    replaceLogoWithCustom();
    scanAndInject();
    observer.observe(document.body, { childList: true, subtree: true });

    // Resume Auto-Coupon if active
    setTimeout(processAutoCoupon, 2000); // Wait for initial load
});
