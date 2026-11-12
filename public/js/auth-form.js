// Shared script for the login and register forms.
// Each form has data-endpoint (where to POST) and data-success (where to go after success).
// Error and notice text is set with textContent, never innerHTML, so user input can't inject markup.

(function () {
  "use strict";

  function showMessage(element, text) {
    if (!element) return;
    element.textContent = text;
    element.hidden = false;
  }

  function hideMessage(element) {
    if (!element) return;
    element.textContent = "";
    element.hidden = true;
  }

  // After registering, the login page shows a notice: ?registered=1.
  const notice = document.querySelector("[data-notice]");
  if (notice && new URLSearchParams(window.location.search).get("registered") === "1") {
    showMessage(notice, "Account created. Log in with your new password.");
  }

  document.querySelectorAll("form[data-endpoint]").forEach(function (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const alertBox = form.querySelector("[role='alert']");
      const button = form.querySelector("button[type='submit']");
      const data = new FormData(form);

      hideMessage(alertBox);
      if (button) button.disabled = true;

      try {
        const response = await fetch(form.dataset.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            email: data.get("email"),
            password: data.get("password"),
          }),
        });

        if (response.ok) {
          window.location.assign(form.dataset.success || "/");
          return;
        }

        // The API returns { error: "..." } for every failure. Show that message as-is.
        let message = "Something went wrong. Please try again.";
        try {
          const body = await response.json();
          if (body && typeof body.error === "string") message = body.error;
        } catch {
          // Keep the generic message if the body isn't JSON.
        }
        showMessage(alertBox, message);
      } catch {
        showMessage(alertBox, "Could not reach the server. Check your connection and try again.");
      } finally {
        if (button) button.disabled = false;
      }
    });
  });
})();
