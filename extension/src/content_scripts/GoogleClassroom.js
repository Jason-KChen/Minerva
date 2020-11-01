const GOOGLE_CLASSROOM_OVERLAY_SCRIPT = "src/embed_scripts/GoogleClassroomOverlay.js";
const FONT_AWESOME_URL = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css";
const IFRAME_API = "https://www.youtube.com/iframe_api";

// Snackbar source
const SNACKBAR_JS = "https://cdnjs.cloudflare.com/ajax/libs/node-snackbar/0.1.16/snackbar.min.js";
const SNACKBAR_CSS = "https://cdnjs.cloudflare.com/ajax/libs/node-snackbar/0.1.16/snackbar.css";

// Webcam vendor scripts
const TFJS_CORE = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core";
const TFJS_WASM = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/tf-backend-wasm.js";
const BLAZE_FACE = "https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface";
const TFJS_CONV = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter";
const FACE_API = "https://gitcdn.xyz/repo/justadudewhohacks/face-api.js/master/dist/face-api.js";
// const FACE_API = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/dist/face-api.min.js";

function addScript(url, func=null) {
    let script = document.createElement("script");
    script.src = url;
    script.type = "text/javascript";
    if(func != null) {
        script.onload = () => {
            func();
        };
    }

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
addStyleSheet(SNACKBAR_CSS);
addScript(SNACKBAR_JS);
addScript(IFRAME_API);

// ML scripts
addScript(TFJS_CORE, () => {
    addScript(TFJS_WASM, () => {
        addScript(TFJS_CONV, () => {
            addScript(BLAZE_FACE, () => {
                addScript(FACE_API,  ()=> {
                    addScript(chrome.runtime.getURL(GOOGLE_CLASSROOM_OVERLAY_SCRIPT));
                });
            });
        });
    });
});
