(() => {
  const currentScript = document.currentScript;
  const serviceWorkerUrl = currentScript?.dataset.serviceWorker || "./sw.js";
  const serviceWorkerScope = currentScript?.dataset.scope || "./";

  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(serviceWorkerUrl, { scope: serviceWorkerScope })
      .catch((error) => console.warn("PWA service worker registration failed", error));
  });
})();
