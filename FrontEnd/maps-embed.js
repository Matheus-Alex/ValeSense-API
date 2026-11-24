(() => {
  const mapFrame = document.querySelector("[data-google-map]");
  if (!mapFrame) return;

  const apiKey = (window.GOOGLE_MAPS_EMBED_API_KEY || "").trim();

  const query = (window.GOOGLE_MAPS_EMBED_QUERY || "Brasil").trim() || "Brasil";
  const mapUrl = new URL(apiKey ? "https://www.google.com/maps/embed/v1/place" : "https://www.google.com/maps");
  mapUrl.search = new URLSearchParams(apiKey ? { key: apiKey, q: query } : { q: query, output: "embed" }).toString();

  const iframe = document.createElement("iframe");
  iframe.src = mapUrl.toString();
  iframe.title = `Mapa do Google: ${query}`;
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  iframe.style.cssText = "width:100%;height:100%;border:0;display:block";
  mapFrame.replaceChildren(iframe);
})();
