"use strict";

const accountButton = document.getElementById("account-button");
const footerAccountButton = document.getElementById("footer-account-button");
const authDialog = document.getElementById("auth-dialog");
const authClose = document.getElementById("auth-close");
const authTitle = document.getElementById("auth-title");
const authDescription = document.getElementById("auth-description");
const authMessage = document.getElementById("auth-message");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const registerName = document.getElementById("register-name");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");
const registerConfirmPassword = document.getElementById("register-confirm-password");
const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");
const showLogin = document.getElementById("show-login");
const showRegister = document.getElementById("show-register");
const logoutButton = document.getElementById("logout-button");

let currentUser = null;

function setAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function updateAccountControls() {
  const label = currentUser ? `Hi, ${currentUser.name}` : "Login / Register";
  accountButton.innerHTML = `${label} <span aria-hidden="true">→</span>`;
  footerAccountButton.textContent = currentUser ? "My account" : "Login / Register";
}

function clearSensitiveFields() {
  loginPassword.value = "";
  registerPassword.value = "";
  registerConfirmPassword.value = "";
}

function showMode(mode) {
  const isRegistering = mode === "register";
  loginForm.hidden = isRegistering;
  registerForm.hidden = !isRegistering;
  loginTab.classList.toggle("active", !isRegistering);
  registerTab.classList.toggle("active", isRegistering);
  loginTab.setAttribute("aria-selected", String(!isRegistering));
  registerTab.setAttribute("aria-selected", String(isRegistering));
  authTitle.textContent = isRegistering ? "Create your account" : "Welcome back";
  authDescription.textContent = isRegistering
    ? "Your account details are stored securely in CompareKart."
    : "Sign in to keep your account information secure.";
  setAuthMessage("");
  clearSensitiveFields();

  if (isRegistering) {
    registerName.focus();
  } else {
    loginEmail.focus();
  }
}

function openAuthDialog() {
  authDialog.hidden = false;
  logoutButton.hidden = !currentUser;

  if (currentUser) {
    loginForm.hidden = true;
    registerForm.hidden = true;
    authTitle.textContent = `Hello, ${currentUser.name}`;
    authDescription.textContent = "You are signed in to CompareKart.";
    setAuthMessage(`Signed in as ${currentUser.email}`, false);
  } else {
    showMode("login");
  }
}

function closeAuthDialog() {
  authDialog.hidden = true;
  clearSensitiveFields();
}

async function requestAuth(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Authentication request failed.");
  }

  return data;
}

async function submitLogin(event) {
  event.preventDefault();
  const submitButton = loginForm.querySelector(".auth-submit");
  submitButton.disabled = true;
  setAuthMessage("Signing in...", false);

  try {
    const data = await requestAuth("/api/auth/login", {
      email: loginEmail.value.trim(),
      password: loginPassword.value
    });

    currentUser = data.user;
    updateAccountControls();
    closeAuthDialog();
  } catch (error) {
    setAuthMessage(error.message);
  } finally {
    submitButton.disabled = false;
  }
}

async function submitRegistration(event) {
  event.preventDefault();
  const submitButton = registerForm.querySelector(".auth-submit");

  if (registerPassword.value !== registerConfirmPassword.value) {
    setAuthMessage("Passwords do not match.");
    registerConfirmPassword.focus();
    return;
  }

  submitButton.disabled = true;
  setAuthMessage("Creating your account...", false);

  try {
    const data = await requestAuth("/api/auth/register", {
      name: registerName.value.trim(),
      email: registerEmail.value.trim(),
      password: registerPassword.value,
      confirmPassword: registerConfirmPassword.value
    });

    currentUser = data.user;
    updateAccountControls();
    closeAuthDialog();
  } catch (error) {
    setAuthMessage(error.message);
  } finally {
    submitButton.disabled = false;
  }
}

accountButton.addEventListener("click", openAuthDialog);
footerAccountButton.addEventListener("click", openAuthDialog);
authClose.addEventListener("click", closeAuthDialog);
authDialog.addEventListener("click", event => {
  if (event.target === authDialog) closeAuthDialog();
});
loginTab.addEventListener("click", () => showMode("login"));
registerTab.addEventListener("click", () => showMode("register"));
showLogin.addEventListener("click", () => showMode("login"));
showRegister.addEventListener("click", () => showMode("register"));
loginForm.addEventListener("submit", submitLogin);
registerForm.addEventListener("submit", submitRegistration);

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await requestAuth("/api/auth/logout", {});
    currentUser = null;
    updateAccountControls();
    closeAuthDialog();
  } catch (error) {
    setAuthMessage(error.message);
  } finally {
    logoutButton.disabled = false;
  }
});

fetch("/api/auth/me")
  .then(response => {
    if (response.status === 401) return null;
    if (!response.ok) throw new Error("Could not restore account session.");
    return response.json();
  })
  .then(data => {
    currentUser = data?.user || null;
    updateAccountControls();
  })
  .catch(error => {
    console.error("Could not load account session:", error);
  });
