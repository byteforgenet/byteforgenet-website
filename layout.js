const initLayout = () => {

  const path = window.location.pathname;

  // Do not load footer or chatbot on login or intro
  if (path.includes("login") || path.includes("intro")) return;

  // --- GLOBAL INTRO ANIMATION ON EVERY PAGE LOAD ---
  const perfNav = performance.getEntriesByType("navigation")[0];
  const isReload = perfNav && perfNav.type === "reload";
  const hasPlayedIntro = sessionStorage.getItem("bf_intro_played");

  if (!hasPlayedIntro || isReload) {
    sessionStorage.setItem("bf_intro_played", "true");

    const introHTML = `
      <div id="globalIntroOverlay">
        <div class="intro-container">
          <div class="logo-sphere">
            <div class="ring ring-1"></div>
            <div class="ring ring-2"></div>
            <div class="ring ring-3"></div>
            <div class="core"></div>
          </div>
          <div class="intro-text-box">
            <div><span id="introTypewriter" class="intro-typewriter-text"></span><span class="intro-caret" id="introCaret"></span></div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("afterbegin", introHTML);

    const introOverlay = document.getElementById("globalIntroOverlay");
    const twElement = document.getElementById("introTypewriter");
    const introCaret = document.getElementById("introCaret");

    // Temporarily disable scrolling
    document.body.style.overflow = "hidden";

    const fullText = "byteforgenet";
    let twIndex = 0;

    setTimeout(() => {
      function type() {
        if (!introOverlay) return;
        if (twIndex < fullText.length) {
          twElement.textContent += fullText.charAt(twIndex);
          twIndex++;
          setTimeout(type, 20 + (Math.random() * 20));
        } else {
          setTimeout(() => {
            if (introCaret) introCaret.classList.add('inactive');
            exitIntro();
          }, 600);
        }
      }
      type();
    }, 400);

    function exitIntro() {
      if (!introOverlay) return;
      introOverlay.style.opacity = "0";
      setTimeout(() => {
        introOverlay.remove();
        document.body.style.overflow = ""; // restore scrolling
      }, 600);
    }
  }
  // --- END GLOBAL INTRO LOGIC ---

  // Load the chatbot logic
  const chatScript = document.createElement("script");
  chatScript.src = "chatbot.js?v=" + new Date().getTime();
  document.body.appendChild(chatScript);

  // Use a cache-busting query string so the browser fetches the latest footer.html
  fetch("footer.html?v=" + new Date().getTime())
    .then(res => res.text())
    .then(data => {
      document.body.insertAdjacentHTML("beforeend", data);

      // Auto year
      const year = new Date().getFullYear();
      const copy = document.getElementById("copyright");
      if (copy) {
        copy.textContent = `© ${year} Byteforgenet. All rights reserved.`;
      }

      // Hook up the footer feedback button
      const fbFooterBtn = document.getElementById("footerFeedbackBtn");
      if (fbFooterBtn) {
        fbFooterBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const modal = document.getElementById("globalFeedbackModal");
          if (modal) {
            modal.classList.remove("hidden");
            document.getElementById("fb-error").style.display = "none";
          }
        });
      }
    });

  // Inject Global Feedback UI Component Modal
  const feedbackHTML = `
    <!-- Feedback Modal -->
    <div class="modal hidden global-feedback-modal" id="globalFeedbackModal">
      <div class="modal-card" style="padding: 24px; position: relative;" onclick="event.stopPropagation()">
        <button id="closeFeedbackModal" style="position: absolute; right: 16px; top: 16px; background: none; border: none; color: #777; font-size: 22px; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#777'">✕</button>
        <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 18px;">Send Feedback</h3>
        <form id="globalFeedbackForm">
          <div style="display: flex; gap: 14px; margin-bottom: 14px;">
            <div class="fb-row" style="flex: 1; margin-bottom: 0;">
              <label>Name</label>
              <input type="text" id="fb-name" placeholder="John Doe" class="fb-input" required />
            </div>
            <div class="fb-row" style="flex: 1; margin-bottom: 0;">
              <label>Email</label>
              <input type="email" id="fb-email" placeholder="john@example.com" class="fb-input" required />
            </div>
          </div>
          <div style="display: flex; gap: 14px; margin-bottom: 14px;">
            <div class="fb-row" style="flex: 1; margin-bottom: 0;">
              <label>Category</label>
              <select id="fb-topic">
                <option value="UI/UX errors">UI/UX Errors</option>
                <option value="Task errors">Task Errors</option>
                <option value="Bug report">Bug report</option>
                <option value="Feature request">Feature request</option>
                <option value="General question">General question</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="fb-row" style="flex: 1; margin-bottom: 0;">
              <label>Priority</label>
              <select id="fb-priority">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
          <div class="fb-row">
            <label>Source Page</label>
            <input type="text" id="fb-page" class="fb-input" readonly value="${window.location.pathname}" style="color: #6b7280; background: rgba(0,0,0,0.2);" />
          </div>
          <div class="fb-row">
            <label>Message</label>
            <textarea id="fb-message" placeholder="What's on your mind?..." required></textarea>
          </div>
          <p id="fb-error" style="color: #f87171; font-size: 13px; margin: 0 0 10px; display: none;"></p>
          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" class="primary small" id="fb-submit" style="width: 100%;">Submit Feedback</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', feedbackHTML);

  const fbModal = document.getElementById("globalFeedbackModal");
  const fbClose = document.getElementById("closeFeedbackModal");
  const fbForm = document.getElementById("globalFeedbackForm");
  const fbSubmitBtn = document.getElementById("fb-submit");
  const fbError = document.getElementById("fb-error");

  fbClose.addEventListener("click", () => {
    fbModal.classList.add("hidden");
  });

  fbModal.addEventListener("click", () => {
    fbModal.classList.add("hidden");
  });

  fbForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // We get name and email purely from the required inputs now
    let userName = document.getElementById("fb-name").value.trim();
    let userEmail = document.getElementById("fb-email").value.trim();

    const payload = {
      name: userName,
      email: userEmail,
      topic: document.getElementById("fb-topic").value,
      priority: document.getElementById("fb-priority").value,
      pageUrl: document.getElementById("fb-page").value,
      message: document.getElementById("fb-message").value
    };

    fbSubmitBtn.textContent = "Sending...";
    fbSubmitBtn.disabled = true;
    fbError.style.display = "none";

    try {
      const res = await fetch("http://localhost:3000/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit feedback");

      fbSubmitBtn.textContent = "Thank you! ✓";
      setTimeout(() => {
        fbModal.classList.add("hidden");
        fbForm.reset();
        fbSubmitBtn.textContent = "Submit Feedback";
        fbSubmitBtn.disabled = false;
      }, 1500);

    } catch (err) {
      console.error(err);
      fbError.textContent = "Error sending message. Please try again.";
      fbError.style.display = "block";
      fbSubmitBtn.textContent = "Submit Feedback";
      fbSubmitBtn.disabled = false;
    }
  });
};


const initThemeToggle = () => {
  const savedTheme = localStorage.getItem("bf_theme") || "dark";
  const isDark = savedTheme === "dark";
  if (!isDark) document.documentElement.classList.add("light-mode");

  const themeBtns = document.querySelectorAll("#themeToggle");
  const themeSelects = document.querySelectorAll("#settingsThemeSelect");

  themeBtns.forEach(btn => {
    btn.textContent = isDark ? "🌙" : "☀️";
    btn.addEventListener("click", (e) => toggleTheme(e));
  });

  themeSelects.forEach(select => {
    select.value = savedTheme;
    select.addEventListener("change", (e) => toggleTheme(e, e.target.value));
  });

  function toggleTheme(event, newThemeVal) {
    const isCurrentlyDark = !document.documentElement.classList.contains("light-mode");
    const willBeDark = newThemeVal ? newThemeVal === "dark" : !isCurrentlyDark;

    if (isCurrentlyDark === willBeDark) return;

    const newTheme = willBeDark ? "dark" : "light";
    localStorage.setItem("bf_theme", newTheme);

    // Update UI elements immediately
    themeBtns.forEach(btn => btn.textContent = willBeDark ? "🌙" : "☀️");
    themeSelects.forEach(sel => sel.value = newTheme);

    // Fallback for browsers that don't support View Transitions
    if (!document.startViewTransition) {
      document.documentElement.classList.toggle("light-mode", !willBeDark);
      return;
    }

    // Determine the origin of the animation based on the event target
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    if (event && event.target) {
      const rect = event.target.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else if (event && event.clientX !== undefined) {
      x = event.clientX;
      y = event.clientY;
    }

    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(() => {
      document.documentElement.classList.toggle("light-mode", !willBeDark);
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];

      document.documentElement.animate(
        { clipPath: willBeDark ? [...clipPath].reverse() : clipPath },
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: willBeDark ? "::view-transition-old(root)" : "::view-transition-new(root)"
        }
      );
    });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initLayout();
    initThemeToggle();
  });
} else {
  initLayout();
  initThemeToggle();
}
