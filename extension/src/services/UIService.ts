
export const showToast = (message: string) => {
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

export const replaceLogoWithCustom = () => {
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
