// Manages cashier profile settings.

const STAFF_ACCOUNTS_KEY = "jorjetteangel-staff-accounts";
const ADMIN_SESSION_KEY = "jorjetteangel-admin-session";

const profileFields = {
  name: document.getElementById("profile-name"),
  email: document.getElementById("profile-email"),
  role: document.getElementById("profile-role"),
  employeeId: document.getElementById("profile-employee-id"),
};
const passwordForm = document.getElementById("password-form");
const passwordMessage = document.getElementById("password-message");
const profilePictureInput = document.getElementById("profile-picture-input");
const profilePicturePreview = document.getElementById(
  "profile-picture-preview",
);
const profilePicturePlaceholder = document.getElementById(
  "profile-picture-placeholder",
);
const profilePictureMessage = document.getElementById(
  "profile-picture-message",
);
const saveProfilePictureButton = document.getElementById(
  "save-profile-picture",
);
let currentStaffAccount;
let pendingProfilePicture = null;

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const showingPassword = input.type === "password";
    input.type = showingPassword ? "text" : "password";
    button.textContent = showingPassword ? "Hide" : "Show";
    button.setAttribute(
      "aria-label",
      `${showingPassword ? "Hide" : "Show"} ${button.dataset.passwordLabel || "password"}`,
    );
  });
});

function readStaffAccounts() {
  const savedAccounts = window.backendMemoryStorage.getItem(STAFF_ACCOUNTS_KEY);
  if (!savedAccounts) return [];
  const accounts = JSON.parse(savedAccounts);
  if (!Array.isArray(accounts)) {
    throw new Error("Saved staff accounts must be a list.");
  }
  return accounts;
}

function hexToBytes(hex) {
  if (typeof hex !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    throw new Error("The saved password credential is invalid.");
  }
  return Uint8Array.from(hex.match(/.{2}/g), (byte) =>
    Number.parseInt(byte, 16),
  );
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  if (!window.crypto?.subtle) {
    throw new Error(
      "Secure password verification is unavailable. Open the admin system through localhost or HTTPS.",
    );
  }
  const key = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(hash));
}

function loadCurrentStaffAccount() {
  const savedSession = window.backendMemoryStorage.getItem(ADMIN_SESSION_KEY);
  if (!savedSession) throw new Error("No signed-in staff session was found.");
  const session = JSON.parse(savedSession);
  if (!session || typeof session !== "object") {
    throw new Error("The signed-in staff session is invalid.");
  }
  const role = String(session.role || "").trim().toLowerCase();
  if (
    ![
      "cashier",
      "acc-csh",
      "warehouse",
      "warehouse manager",
      "acc-whs",
      "production",
      "atelier staff",
      "acc-prd",
    ].includes(role) &&
    !/^acc-(?:csh|whs|prd)-/.test(String(session.employeeId || "").toLowerCase())
  ) {
    throw new Error(
      "This profile page is only available to staff accounts.",
    );
  }
  if (
    ["production", "atelier staff", "acc-prd"].includes(role) ||
    /^acc-prd-/.test(String(session.employeeId || "").toLowerCase())
  ) {
    document.getElementById("cashier-profile-picture").hidden = true;
  }
  const accounts = readStaffAccounts();
  const account = accounts.find(
    (entry) =>
      String(entry.email || "").toLowerCase() ===
      String(session.email || "").toLowerCase(),
  );
  if (!account) throw new Error("Your staff account could not be found.");
  currentStaffAccount = account;
  profileFields.name.textContent =
    [account.firstName, account.lastName].filter(Boolean).join(" ") ||
    account.name ||
    "Name not provided";
  profileFields.email.textContent = account.email;
  profileFields.role.textContent = account.role || "Cashier";
  profileFields.employeeId.textContent = account.employeeId || "Not available";
  const existingPicture =
    typeof account.profilePictureDataUrl === "string"
      ? account.profilePictureDataUrl
      : "";
  if (existingPicture) {
    profilePicturePreview.src = existingPicture;
    profilePicturePreview.hidden = false;
    profilePicturePlaceholder.hidden = true;
  }
}

profilePictureInput.addEventListener("change", () => {
  const file = profilePictureInput.files?.[0];
  profilePictureMessage.textContent = "";
  pendingProfilePicture = null;
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    profilePictureMessage.textContent = "Choose an image file.";
    profilePictureInput.value = "";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    profilePictureMessage.textContent =
      "Choose an image smaller than 2 MB.";
    profilePictureInput.value = "";
    return;
  }
  pendingProfilePicture = file;
  profilePicturePreview.src = URL.createObjectURL(file);
  profilePicturePreview.hidden = false;
  profilePicturePlaceholder.hidden = true;
});

saveProfilePictureButton.addEventListener("click", () => {
  if (!pendingProfilePicture || !currentStaffAccount) {
    profilePictureMessage.textContent = "Choose a profile picture first.";
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (typeof reader.result !== "string") {
      profilePictureMessage.textContent =
        "The selected profile picture could not be read.";
      return;
    }
    try {
      const accounts = readStaffAccounts();
      const index = accounts.findIndex(
        (entry) =>
          String(entry.email || "").toLowerCase() ===
          String(currentStaffAccount.email).toLowerCase(),
      );
      if (index < 0) throw new Error("Your staff account could not be found.");
      currentStaffAccount.profilePictureDataUrl = reader.result;
      accounts[index] = currentStaffAccount;
      window.backendMemoryStorage.setItem(STAFF_ACCOUNTS_KEY, JSON.stringify(accounts));
      pendingProfilePicture = null;
      profilePictureInput.value = "";
      profilePictureMessage.textContent = "Profile picture updated.";
      profilePictureMessage.classList.add("success");
      profilePicturePlaceholder.hidden = true;
    } catch (error) {
      console.error("Could not save the staff profile picture.", error);
      profilePictureMessage.textContent =
        error instanceof Error
          ? error.message
          : "Profile picture could not be saved.";
    }
  });
  reader.addEventListener("error", () => {
    profilePictureMessage.textContent =
      "The selected profile picture could not be read.";
  });
  reader.readAsDataURL(pendingProfilePicture);
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  passwordMessage.textContent = "";
  passwordMessage.classList.remove("success");
  if (!passwordForm.reportValidity()) return;

  const currentPassword = document.getElementById("current-password").value;
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  if (newPassword !== confirmPassword) {
    passwordMessage.textContent = "The new passwords do not match.";
    return;
  }
  if (newPassword.length < 8) {
    passwordMessage.textContent =
      "The new password must be at least 8 characters long.";
    return;
  }

  const submitButton = passwordForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    if (!currentStaffAccount?.passwordSalt || !currentStaffAccount.passwordHash) {
      throw new Error("Your account has no verifiable password credential.");
    }
    const existingHash = await hashPassword(
      currentPassword,
      hexToBytes(currentStaffAccount.passwordSalt),
    );
    if (existingHash !== currentStaffAccount.passwordHash) {
      passwordMessage.textContent = "The current password is incorrect.";
      return;
    }

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    currentStaffAccount.passwordSalt = bytesToHex(salt);
    currentStaffAccount.passwordHash = await hashPassword(newPassword, salt);
    currentStaffAccount.mustChangePassword = false;
    const accounts = readStaffAccounts();
    const index = accounts.findIndex(
      (entry) =>
        String(entry.email || "").toLowerCase() ===
        String(currentStaffAccount.email).toLowerCase(),
    );
    if (index < 0) throw new Error("Your staff account could not be found.");
    accounts[index] = currentStaffAccount;
    window.backendMemoryStorage.setItem(STAFF_ACCOUNTS_KEY, JSON.stringify(accounts));
    passwordForm.reset();
    passwordMessage.textContent = "Your password has been updated.";
    passwordMessage.classList.add("success");
  } catch (error) {
    console.error("Could not update the staff password.", error);
    passwordMessage.textContent =
      error instanceof Error
        ? error.message
        : "Your password could not be updated.";
  } finally {
    submitButton.disabled = false;
  }
});

try {
  loadCurrentStaffAccount();
} catch (error) {
  console.error("Could not load the cashier profile.", error);
  passwordForm.hidden = true;
  passwordMessage.textContent =
    error instanceof Error ? error.message : "Your profile could not be loaded.";
}
