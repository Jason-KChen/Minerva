const GOOGLE_CLASSROOM_OVERLAY_SCRIPT = "src/embed_scripts/GoogleClassroomOverlay.js";
const FONT_AWESOME_URL = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css";
const IFRAME_API = "https://www.youtube.com/iframe_api";

function addScript(url) {
    let script = document.createElement("script");
    script.src = url;

    (document.head || document.documentElement).appendChild(script);
}

function addStyleSheet(url) {
    // Add the style sheet
    let style = document.createElement("link");
    style.rel = "stylesheet";
    style.type = "text/css";
    style.href = url;
    style.crossOrigin = "anonymous";

    (document.head||document.documentElement).appendChild(style);
    console.log(`Added stylesheet from ${url}`);
}

// This content script is guaranteed to fire after "load" event is fired
addStyleSheet(FONT_AWESOME_URL);
addScript(chrome.runtime.getURL(GOOGLE_CLASSROOM_OVERLAY_SCRIPT));
addScript(IFRAME_API);
