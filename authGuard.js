import { auth } from "./firebase.js";
import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const currentPage = window.location.pathname;
const isLoginPage = currentPage.includes("login.html");

onAuthStateChanged(auth, (user) => {

  // If user is NOT logged in and trying to access protected page
  if (!user && !isLoginPage) {
    window.location.replace("login.html");
    return;
  }

  // If user IS logged in and on login page
  if (user && isLoginPage) {
    window.location.replace("dashboard.html");
    return;
  }

});
