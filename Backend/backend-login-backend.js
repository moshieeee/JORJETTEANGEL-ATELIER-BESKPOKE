// Handles backend sign-in, setup, and email verification.

const ADMIN_AUTH_ENABLED = true;
const ADMIN_USERS_KEY = "jorjetteangel-admin-users";
const ADMIN_SESSION_KEY = "jorjetteangel-admin-session";
const ADMIN_REMEMBER_KEY = "jorjetteangel-admin-remember";
const STAFF_ACCOUNTS_KEY = "jorjetteangel-staff-accounts";
const EMAILJS_SERVICE_ID = "jorgetteangel";
const EMAILJS_SIGN_IN_TEMPLATE_ID = "template_rpofcdw";
const EMAILJS_PUBLIC_KEY = "babfxp13g9RIpKj4W";
const ADMIN_OTP_LIFETIME_MS = 15 * 60 * 1000;

function employeeIdPrefix(role) {
  const prefixes = {
    admin: "ACC-EMP",
    cashier: "ACC-CSH",
    warehouse: "ACC-WHS",
    production: "ACC-PRD",
  };
  const prefix = prefixes[String(role || "").toLowerCase()];
  if (!prefix) throw new Error(`Unsupported employee role: ${role}`);
  return prefix;
}

function nextEmployeeId(role, existingAccounts) {
  const prefix = employeeIdPrefix(role);
  const idPattern = new RegExp(`^${prefix}-(\\d+)$`);
  const highestNumber = existingAccounts.reduce((highest, account) => {
    const match = idPattern.exec(account.employeeId || "");
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}-${String(highestNumber + 1).padStart(3, "0")}`;
}

function existingEmployeeAccounts(admins) {
  const savedStaff = window.backendMemoryStorage.getItem(STAFF_ACCOUNTS_KEY);
  const staff = savedStaff ? JSON.parse(savedStaff) : [];
  if (!Array.isArray(staff)) {
    throw new Error("Saved staff directory must be a list.");
  }
  return [...admins, ...staff];
}

if (!ADMIN_AUTH_ENABLED) {
  window.location.replace("backend-e-commerce-admin.html");
} else {
  const adminLoginPanel = document.getElementById("admin-login-panel");
  const adminAuthShell = document.querySelector(".admin-auth-shell");
  const adminAppFrame = document.getElementById("admin-app-frame");
  const adminOtpPanel = document.getElementById("admin-otp-panel");
  const adminSetupPanel = document.getElementById("admin-setup-panel");
  const adminLoginForm = document.getElementById("admin-login-form");
  const adminOtpForm = document.getElementById("admin-otp-form");
  const adminSetupForm = document.getElementById("admin-setup-form");
  const adminLoginMessage = document.getElementById("admin-login-message");
  const adminOtpMessage = document.getElementById("admin-otp-message");
  const adminOtpEmail = document.getElementById("admin-otp-email");
  const adminOtpTitle = document.getElementById("admin-otp-title");
  const adminOtpDescription = document.getElementById("admin-otp-description");
  const adminOtpCodeInputs = Array.from(
    document.querySelectorAll("#admin-otp-code-inputs input"),
  );
  const adminOtpResendButton = document.getElementById("admin-otp-resend");
  const adminSetupMessage = document.getElementById("admin-setup-message");
  const emailField = document.getElementById("admin-email");
  const passwordField = document.getElementById("admin-password");
  const rememberCheck = document.getElementById("admin-remember");
  const setupFirstNameInput = document.getElementById("setup-first-name");
  const setupLastNameInput = document.getElementById("setup-last-name");
  const setupEmailInput = document.getElementById("setup-email");
  const setupPasswordInput = document.getElementById("setup-password");
  const setupConfirmPasswordInput = document.getElementById(
    "setup-confirm-password",
  );
  let pendingLoginAccount = null;
  let pendingOtp = null;
  let sendingOtp = false;

  function loadAdmins() {
    const savedAdmins = window.backendMemoryStorage.getItem(ADMIN_USERS_KEY);
    if (!savedAdmins) return [];

    const admins = JSON.parse(savedAdmins);
    if (
      !Array.isArray(admins) ||
      admins.some(
        (admin) =>
          !admin ||
          typeof admin.email !== "string" ||
          typeof admin.passwordSalt !== "string" ||
          typeof admin.passwordHash !== "string",
      )
    ) {
      throw new Error("Saved admin account data is invalid.");
    }
    return admins;
  }

  function loadStaffAccounts() {
    const savedStaff = window.backendMemoryStorage.getItem(STAFF_ACCOUNTS_KEY);
    if (!savedStaff) return [];

    const staff = JSON.parse(savedStaff);
    if (
      !Array.isArray(staff) ||
      staff.some(
        (account) =>
          !account ||
          typeof account.email !== "string" ||
          typeof account.passwordSalt !== "string" ||
          typeof account.passwordHash !== "string",
      )
    ) {
      throw new Error("Saved staff account data is invalid.");
    }
    return staff;
  }

  function setMessage(element, message, type = "") {
    element.textContent = message;
    element.className = "status-message";
    if (type) element.classList.add(type);
  }

  function renderLoginOrSetup() {
    const hasAccounts =
      loadAdmins().length > 0 || loadStaffAccounts().length > 0;
    adminLoginPanel.classList.toggle("hidden", !hasAccounts);
    adminOtpPanel.classList.remove("visible");
    adminOtpPanel.setAttribute("aria-hidden", "true");
    adminSetupPanel.classList.toggle("hidden", hasAccounts);
    document.title = hasAccounts
      ? "Atelier Admin | Login"
      : "Atelier Admin | First-time Setup";
    document.querySelector(".auth-kicker").textContent = hasAccounts
      ? "Secure entry"
      : "First-time setup";
    document.querySelector(".auth-title").textContent = hasAccounts
      ? "Sign in"
      : "Create administrator account";
    if (!hasAccounts) {
      setMessage(
        adminSetupMessage,
        "Create the first admin account for this browser.",
      );
    }
  }

  async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) {
      throw new Error(
        "Secure password hashing is unavailable. Open this project through localhost or HTTPS.",
      );
    }
    const saltBytes = Uint8Array.from(salt.match(/.{2}/g), (byte) =>
      Number.parseInt(byte, 16),
    );
    const passwordKey = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const hash = await window.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: saltBytes, iterations: 120000, hash: "SHA-256" },
      passwordKey,
      256,
    );
    return Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  function makeSalt() {
    if (!window.crypto?.getRandomValues) {
      throw new Error(
        "Secure password generation is unavailable. Open this project through localhost or HTTPS.",
      );
    }
    return Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  function persistAdminSession(admin) {
    window.backendMemoryStorage.setItem(
      ADMIN_SESSION_KEY,
      JSON.stringify({
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        employeeId: admin.employeeId,
        signedInAt: new Date().toISOString(),
      }),
    );
  }

  function redirectToDashboard() {
    adminAuthShell.hidden = true;
    adminAppFrame.hidden = false;
    adminAppFrame.src = "backend-e-commerce-admin.html";
  }

  window.addEventListener("message", (event) => {
    let isAdminWindow = event.source === adminAppFrame.contentWindow;
    if (!isAdminWindow && adminAppFrame.contentWindow) {
      const moduleFrame = adminAppFrame.contentWindow.document
        .getElementById("dashboard-module-frame");
      isAdminWindow = event.source === moduleFrame?.contentWindow;
    }
    if (
      !isAdminWindow ||
      event.data?.type !== "admin-logout"
    ) {
      return;
    }
    adminAppFrame.src = "about:blank";
    adminAppFrame.hidden = true;
    adminAuthShell.hidden = false;
    renderLoginOrSetup();
  });

  function makeVerificationCode() {
    if (!window.crypto?.getRandomValues) {
      throw new Error("Secure verification code generation is unavailable.");
    }
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return String(values[0] % 1000000).padStart(6, "0");
  }

  async function sendAdminOtp() {
    if (sendingOtp || !pendingLoginAccount) return;
    if (!window.emailjs) {
      setMessage(
        adminOtpMessage,
        "Email verification is unavailable because the email service did not load. Check your connection and retry.",
        "error",
      );
      return;
    }

    sendingOtp = true;
    adminOtpResendButton.disabled = true;
    setMessage(adminOtpMessage, "Sending your verification code...");
    try {
      const code = makeVerificationCode();
      const expiresAt = Date.now() + ADMIN_OTP_LIFETIME_MS;
      await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_SIGN_IN_TEMPLATE_ID,
        {
          to_email: pendingLoginAccount.email,
          customer_name:
            [pendingLoginAccount.firstName, pendingLoginAccount.lastName]
              .filter(Boolean)
              .join(" "),
          passcode: code,
          time: `${new Date(expiresAt).toLocaleTimeString("en-PH", {
            hour: "numeric",
            minute: "2-digit",
          })} ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
          website_link: window.location.href.split("#")[0],
        },
        { publicKey: EMAILJS_PUBLIC_KEY },
      );
      pendingOtp = { code, expiresAt };
      adminOtpCodeInputs.forEach((input) => {
        input.value = "";
      });
      setMessage(
        adminOtpMessage,
        "Verification email sent. Check your inbox.",
        "success",
      );
      adminOtpCodeInputs[0].focus();
    } catch (error) {
      console.error("Email service could not send the backend verification code.", error);
      const details =
        error && typeof error === "object"
          ? [error.status, error.text, error.message]
              .filter(
                (detail) =>
                  typeof detail === "string" || typeof detail === "number",
              )
              .join(" ")
          : String(error);
      setMessage(
        adminOtpMessage,
        details
          ? `Could not send the verification email: ${details}`
          : "Could not send the verification email. Please retry.",
        "error",
      );
    } finally {
      sendingOtp = false;
      adminOtpResendButton.disabled = false;
    }
  }

  function beginAdminOtp(account, purpose = "signin") {
    pendingLoginAccount = account;
    pendingOtp = null;
    adminOtpEmail.textContent = account.email;
    adminOtpTitle.textContent =
      purpose === "setup"
        ? "Verify Your Admin Account"
        : "Verify Your Email Address";
    adminOtpDescription.replaceChildren(
      document.createTextNode("Enter the 6-digit verification code sent to "),
      adminOtpEmail,
      document.createTextNode(
        purpose === "setup"
          ? " to complete your administrator setup."
          : " to finish signing in.",
      ),
    );
    adminOtpCodeInputs.forEach((input) => {
      input.value = "";
    });
    adminLoginPanel.classList.add("hidden");
    adminSetupPanel.classList.add("hidden");
    adminOtpPanel.classList.add("visible");
    adminOtpPanel.setAttribute("aria-hidden", "false");
    document.querySelector(".auth-kicker").textContent = "Email verification";
    document.querySelector(".auth-title").textContent =
      purpose === "setup" ? "Verify administrator setup" : "Verify your sign in";
    void sendAdminOtp();
  }

  function handlePasswordVisibilityToggle(event) {
    const button = event.currentTarget;
    const field = document.getElementById(
      button.getAttribute("data-toggle-password"),
    );
    if (!field) return;
    const isHidden = field.type === "password";
    field.type = isHidden ? "text" : "password";
    button.textContent = isHidden ? "Hide" : "Show";
    button.setAttribute("aria-label", `${isHidden ? "Hide" : "Show"} password`);
  }

  async function submitAdminSetup(event) {
    event.preventDefault();
    setMessage(adminSetupMessage, "");

    const firstName = setupFirstNameInput.value.trim();
    const lastName = setupLastNameInput.value.trim();
    const email = setupEmailInput.value.trim().toLowerCase();
    const password = setupPasswordInput.value;
    const confirmPassword = setupConfirmPasswordInput.value;

    if (
      !setupFirstNameInput.reportValidity() ||
      !setupLastNameInput.reportValidity() ||
      !setupEmailInput.reportValidity() ||
      !setupPasswordInput.reportValidity() ||
      !setupConfirmPasswordInput.reportValidity()
    ) {
      return;
    }
    if (password.length < 8) {
      setMessage(adminSetupMessage, "Password must be at least 8 characters long.", "error");
      return;
    }
    if (password !== confirmPassword) {
      setMessage(adminSetupMessage, "Passwords do not match.", "error");
      return;
    }
    if (!document.getElementById("setup-dpa-consent").checked) {
      setMessage(
        adminSetupMessage,
        "Please agree to the Data Privacy Act notice to continue.",
        "error",
      );
      return;
    }

    try {
      if (loadAdmins().length > 0) {
        renderLoginOrSetup();
        setMessage(adminLoginMessage, "An admin account already exists. Sign in with that account.", "error");
        return;
      }
      const existingAdmins = loadAdmins();
      const employeeId = nextEmployeeId(
        "admin",
        existingEmployeeAccounts(existingAdmins),
      );
      const salt = makeSalt();
      const admin = {
        id: `admin-${Date.now()}`,
        employeeId,
        firstName,
        lastName,
        email,
        role: "admin",
        passwordSalt: salt,
        passwordHash: await hashPassword(password, salt),
      };
      window.backendMemoryStorage.setItem(ADMIN_USERS_KEY, JSON.stringify([admin]));
      beginAdminOtp(admin, "setup");
    } catch (error) {
      console.error("Could not create the local admin account.", error);
      setMessage(
        adminSetupMessage,
        error instanceof Error
          ? `Could not create the admin account: ${error.message}`
          : "Could not create the admin account. Please try again.",
        "error",
      );
    }
  }

  async function submitAdminLogin(event) {
    event.preventDefault();
    setMessage(adminLoginMessage, "");
    if (!emailField.reportValidity() || !passwordField.reportValidity()) return;

    const email = emailField.value.trim().toLowerCase();
    const password = passwordField.value;
    if (!document.getElementById("admin-dpa-consent").checked) {
      setMessage(
        adminLoginMessage,
        "Please agree to the Data Privacy Act notice to continue.",
        "error",
      );
      return;
    }

    try {
      const accounts = [...loadAdmins(), ...loadStaffAccounts()];
      const account = accounts.find(
        (entry) => entry.email.trim().toLowerCase() === email,
      );
      if (
        !account ||
        (await hashPassword(password, account.passwordSalt)) !==
          account.passwordHash
      ) {
        setMessage(adminLoginMessage, "Email or password is incorrect.", "error");
        return;
      }
      const accountStatus = String(
        account.accountStatus || account.status || "",
      ).toLowerCase();
      if (
        account.isActive === false ||
        account.active === false ||
        account.isBanned === true ||
        ["inactive", "deactivated", "banned", "blocked", "suspended"].includes(
          accountStatus,
        )
      ) {
        setMessage(
          adminLoginMessage,
          "This account is inactive. Contact an administrator.",
          "error",
        );
        return;
      }
      if (rememberCheck.checked) {
        window.backendMemoryStorage.setItem(ADMIN_REMEMBER_KEY, email);
      } else {
        window.backendMemoryStorage.removeItem(ADMIN_REMEMBER_KEY);
      }
      if (!account.employeeId) {
        account.employeeId = nextEmployeeId(
          account.role || "admin",
          existingEmployeeAccounts(loadAdmins()),
        );
        const admins = loadAdmins();
        const adminIndex = admins.findIndex(
          (entry) => entry.email.toLowerCase() === email,
        );
        if (adminIndex >= 0) {
          admins[adminIndex] = account;
          window.backendMemoryStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(admins));
        } else {
          const staff = loadStaffAccounts();
          const staffIndex = staff.findIndex(
            (entry) => entry.email.toLowerCase() === email,
          );
          if (staffIndex < 0) {
            throw new Error("The signed-in account could not be located.");
          }
          staff[staffIndex] = account;
          window.backendMemoryStorage.setItem(STAFF_ACCOUNTS_KEY, JSON.stringify(staff));
        }
      }
      const authenticatedAccount = {
        ...account,
        firstName:
          account.firstName ||
          (typeof account.name === "string" ? account.name.split(/\s+/)[0] : ""),
      };
      beginAdminOtp(authenticatedAccount);
    } catch (error) {
      console.error("Could not sign in to the local admin account.", error);
      setMessage(
        adminLoginMessage,
        error instanceof Error
          ? `Could not sign in: ${error.message}`
          : "Could not sign in. Please try again.",
        "error",
      );
    }
  }

  async function verifyAdminOtp(event) {
    event.preventDefault();
    setMessage(adminOtpMessage, "");
    if (!pendingLoginAccount || !pendingOtp) {
      setMessage(
        adminOtpMessage,
        "Request a verification code before signing in.",
        "error",
      );
      return;
    }
    for (const input of adminOtpCodeInputs) {
      if (!input.reportValidity()) return;
    }
    const submittedCode = adminOtpCodeInputs
      .map((input) => input.value)
      .join("");
    if (Date.now() > pendingOtp.expiresAt) {
      pendingOtp = null;
      setMessage(
        adminOtpMessage,
        "Your verification code has expired. Request a new code.",
        "error",
      );
      return;
    }
    if (submittedCode !== pendingOtp.code) {
      setMessage(
        adminOtpMessage,
        "That verification code is incorrect. Check your email and try again.",
        "error",
      );
      return;
    }
    const account = pendingLoginAccount;
    pendingLoginAccount = null;
    pendingOtp = null;
    try {
      persistAdminSession(account);
      redirectToDashboard();
    } catch (error) {
      console.error("Could not establish the verified admin session.", error);
      pendingLoginAccount = account;
      setMessage(
        adminOtpMessage,
        error instanceof Error
          ? `Could not complete sign in: ${error.message}`
          : "Could not complete sign in. Please try again.",
        "error",
      );
    }
  }

  try {
    if (window.backendMemoryStorage.getItem(ADMIN_SESSION_KEY)) {
      redirectToDashboard();
    } else {
      renderLoginOrSetup();
      const rememberedEmail = window.backendMemoryStorage.getItem(ADMIN_REMEMBER_KEY);
      if (rememberedEmail) {
        emailField.value = rememberedEmail;
        rememberCheck.checked = true;
      }
      document.querySelectorAll("[data-toggle-password]").forEach((toggle) => {
        toggle.addEventListener("click", handlePasswordVisibilityToggle);
      });
      adminSetupForm.addEventListener("submit", submitAdminSetup);
      adminLoginForm.addEventListener("submit", submitAdminLogin);
      adminOtpForm.addEventListener("submit", verifyAdminOtp);
      adminOtpResendButton.addEventListener("click", () => {
        pendingOtp = null;
        void sendAdminOtp();
      });
      adminOtpCodeInputs.forEach((input, index) => {
        input.addEventListener("input", () => {
          const digits = input.value.replace(/\D/g, "");
          input.value = digits.slice(-1);
          if (digits.length > 1) {
            digits
              .slice(1)
              .split("")
              .forEach((digit, offset) => {
                const nextInput = adminOtpCodeInputs[index + offset + 1];
                if (nextInput) nextInput.value = digit;
              });
          }
          if (input.value && adminOtpCodeInputs[index + 1]) {
            adminOtpCodeInputs[index + 1].focus();
          }
        });
        input.addEventListener("keydown", (event) => {
          if (
            event.key === "Backspace" &&
            !input.value &&
            adminOtpCodeInputs[index - 1]
          ) {
            adminOtpCodeInputs[index - 1].focus();
          }
          if (event.key === "ArrowLeft" && adminOtpCodeInputs[index - 1]) {
            adminOtpCodeInputs[index - 1].focus();
          }
          if (event.key === "ArrowRight" && adminOtpCodeInputs[index + 1]) {
            adminOtpCodeInputs[index + 1].focus();
          }
        });
        input.addEventListener("paste", (event) => {
          event.preventDefault();
          const pastedDigits = event.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, adminOtpCodeInputs.length);
          pastedDigits.split("").forEach((digit, digitIndex) => {
            adminOtpCodeInputs[digitIndex].value = digit;
          });
          adminOtpCodeInputs[
            Math.min(pastedDigits.length, adminOtpCodeInputs.length - 1)
          ].focus();
        });
      });
      document.getElementById("admin-otp-back").addEventListener("click", () => {
        pendingLoginAccount = null;
        pendingOtp = null;
        adminOtpPanel.classList.add("hidden");
        adminLoginPanel.classList.remove("hidden");
        document.querySelector(".auth-kicker").textContent = "Secure entry";
        document.querySelector(".auth-title").textContent = "Sign in";
        setMessage(adminLoginMessage, "");
      });
    }
  } catch (error) {
    console.error("Could not initialize admin authentication.", error);
    adminLoginPanel.classList.add("hidden");
    adminSetupPanel.classList.remove("hidden");
    setMessage(
      adminSetupMessage,
      "Could not load the saved admin account. Check browser storage before continuing.",
      "error",
    );
  }
}
