document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");
  const landing = document.getElementById("landing");
  const next = document.getElementById("next");

  startBtn.addEventListener("click", () => {
    landing.classList.add("hidden");
    next.classList.remove("hidden");
  });
});
