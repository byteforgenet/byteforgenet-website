/**
 * shared.js — Byteforgenet
 * Reusable topbar + toast logic for all protected pages.
 * Import this as a module in each page.
 */

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

/* =====================================================
   TOAST NOTIFICATION SYSTEM
   ===================================================== */

function createToastContainer() {
  if (document.getElementById("bf-toasts")) return;
  const el = document.createElement("div");
  el.id = "bf-toasts";
  el.style.cssText = `
    position: fixed;
    bottom: 28px;
    right: 28px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
  `;
  document.body.appendChild(el);
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 */
export function toast(message, type = "info") {
  createToastContainer();
  const container = document.getElementById("bf-toasts");

  const colors = {
    success: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.4)", icon: "✓" },
    error:   { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.4)", icon: "✕" },
    info:    { bg: "rgba(79,140,255,0.12)", border: "rgba(79,140,255,0.35)", icon: "ℹ" }
  };
  const c = colors[type] || colors.info;

  const el = document.createElement("div");
  el.style.cssText = `
    background: ${c.bg};
    border: 1px solid ${c.border};
    border-radius: 12px;
    padding: 12px 18px;
    color: #e5e5e5;
    font-size: 14px;
    backdrop-filter: blur(14px);
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 220px;
    max-width: 340px;
    pointer-events: all;
    animation: toastIn 0.3s ease forwards;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  `;
  el.innerHTML = `<span style="font-size:16px;">${c.icon}</span><span>${message}</span>`;
  container.appendChild(el);

  // Add animation style once
  if (!document.getElementById("bf-toast-style")) {
    const s = document.createElement("style");
    s.id = "bf-toast-style";
    s.textContent = `
      @keyframes toastIn {
        from { opacity: 0; transform: translateY(16px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes toastOut {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to   { opacity: 0; transform: translateY(8px) scale(0.95); }
      }
    `;
    document.head.appendChild(s);
  }

  setTimeout(() => {
    el.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

/* =====================================================
   ACTIVE NAV HIGHLIGHT
   ===================================================== */

function highlightActiveNav() {
  const page = window.location.pathname.split("/").pop();
  document.querySelectorAll(".nav-item").forEach(a => {
    const href = a.getAttribute("href");
    if (href === page) {
      a.classList.add("active");
    } else {
      a.classList.remove("active");
    }
  });
}

/* =====================================================
   TOPBAR: LOAD REAL FIREBASE USER DATA
   ===================================================== */

function setAvatarFromPhoto(photoURL, initial) {
  const avatars = document.querySelectorAll(".avatar");
  avatars.forEach(avatar => {
    if (photoURL) {
      avatar.innerHTML = `
        <img src="${photoURL}" alt="avatar"
          style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />
        <span class="online-dot"></span>
      `;
    } else {
      avatar.innerHTML = `${initial}<span class="online-dot"></span>`;
    }
  });
}

function initTopbar() {
  onAuthStateChanged(auth, (user) => {
    if (!user) return; // authGuard handles redirect

    const name = user.displayName || user.email?.split("@")[0] || "User";
    const initial = name.charAt(0).toUpperCase();
    const photo = user.photoURL;

    // Set username
    document.querySelectorAll(".username").forEach(el => {
      el.textContent = name;
    });

    // Set avatar
    setAvatarFromPhoto(photo, initial);

    // Role badge
    const role = localStorage.getItem("bf_role") || "member";
    document.querySelectorAll("#roleBadge").forEach(badge => {
      badge.textContent = role.toUpperCase();
      badge.classList.remove("role-admin", "role-member");
      badge.classList.add(role === "admin" ? "role-admin" : "role-member");
    });

    // Store user info for other pages
    localStorage.setItem("bf_username", name);
    localStorage.setItem("bf_email", user.email || "");
    localStorage.setItem("bf_photo", photo || "");
  });
}

/* =====================================================
   LOGOUT
   ===================================================== */

export function logout() {
  signOut(auth)
    .then(() => {
      toast("Signed out. See you soon!", "info");
      setTimeout(() => { window.location.href = "login.html"; }, 900);
    })
    .catch(() => toast("Logout failed. Try again.", "error"));
}

// Make logout available globally (for onclick= in HTML)
window.logout = logout;

/* =====================================================
   DROPDOWN TOGGLES (profile menu + notif menu)
   ===================================================== */

function initDropdowns() {
  const profileBtn = document.getElementById("profileBtn");
  const profileMenu = document.getElementById("profileMenu");
  const notifBtn = document.getElementById("notifBtn");
  const notifMenu = document.getElementById("notifMenu");

  if (profileBtn && profileMenu) {
    profileBtn.onclick = e => {
      e.stopPropagation();
      profileMenu.classList.toggle("hidden");
      notifMenu?.classList.add("hidden");
    };
  }

  if (notifBtn && notifMenu) {
    notifBtn.onclick = e => {
      e.stopPropagation();
      notifMenu.classList.toggle("hidden");
      profileMenu?.classList.add("hidden");
    };
  }

  document.addEventListener("click", () => {
    profileMenu?.classList.add("hidden");
    notifMenu?.classList.add("hidden");
  });

  // Load notifications
  const notifList = document.getElementById("notifList");
  const notifCount = document.getElementById("notifCount");
  const notifications = JSON.parse(localStorage.getItem("bf_notifications") || "[]");
  if (notifCount) notifCount.textContent = notifications.length;
  if (notifList) {
    if (!notifications.length) {
      notifList.innerHTML = `<div style="color:#777;font-size:13px;padding:8px 0;">No notifications</div>`;
    } else {
      notifications.forEach(n => {
        const div = document.createElement("div");
        div.className = "notif-item";
        div.textContent = n.text;
        notifList.appendChild(div);
      });
    }
  }
}

/* =====================================================
   AUTO-INIT
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initTopbar();
  initDropdowns();
  highlightActiveNav();
});
