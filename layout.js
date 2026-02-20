document.addEventListener("DOMContentLoaded", () => {

  const path = window.location.pathname;

  // Do not load footer on login or intro
  if (path.includes("login") || path.includes("intro")) return;

  fetch("footer.html")
    .then(res => res.text())
    .then(data => {
      document.body.insertAdjacentHTML("beforeend", data);

      // Auto year
      const year = new Date().getFullYear();
      const copy = document.getElementById("copyright");
      if (copy) {
        copy.textContent = `© ${year} Byteforgenet. All rights reserved.`;
      }
    });
});
