// Home page: shows the signed-in user, or links to log in and register.

(function () {
  "use strict";

  const signedOut = document.getElementById("signed-out");
  const signedIn = document.getElementById("signed-in");
  const userEmail = document.getElementById("user-email");
  const logoutButton = document.getElementById("logout-button");
  const status = document.getElementById("status");

  async function checkSession() {
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!response.ok) return;
      const user = await response.json();
      // textContent, not innerHTML, so the email can't inject markup.
      userEmail.textContent = user.email;
      signedIn.hidden = false;
      signedOut.hidden = true;
    } catch {
      status.textContent = "Could not check your session.";
    }
  }

  logoutButton.addEventListener("click", async function () {
    logoutButton.disabled = true;
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      window.location.reload();
    } catch {
      status.textContent = "Could not log out. Check your connection and try again.";
      logoutButton.disabled = false;
    }
  });

  checkSession();
})();
