self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

function saveSharedFileToIDB(file) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("abookscan_share_db", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("shared_files")) {
        db.createObjectStore("shared_files");
      }
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction("shared_files", "readwrite");
      const store = tx.objectStore("shared_files");
      store.put({ file, name: file.name, type: file.type, timestamp: Date.now() }, "latest_file");
      tx.oncomplete = () => resolve();
      tx.onerror = (err) => reject(err);
    };
    request.onerror = (err) => reject(err);
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Intercept PWA Share Target POST request when user chooses "Ouvrir avec" / "Partager avec" AbookScan
  if (event.request.method === "POST" && url.searchParams.get("share_target") === "true") {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get("file") || formData.get("media") || formData.get("audio");
          if (file && file instanceof File) {
            await saveSharedFileToIDB(file);
          }
        } catch (err) {
          console.error("Error processing shared target file:", err);
        }
        return Response.redirect("/?shared_file=1", 303);
      })()
    );
    return;
  }

  // Do not intercept non-GET requests or API calls
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) {
    return;
  }
  // Simple fetch pass-through for other GET requests
  event.respondWith(fetch(event.request));
});
