(async () => {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) return;
    const status = await response.json();
    document.documentElement.dataset.backend = "python";
    const roomCode = document.querySelector("#roomCode");
    if (roomCode) roomCode.textContent = "PY";
    console.info("Number Hunter backend connected:", status);
  } catch {
    document.documentElement.dataset.backend = "static";
  }
})();
