// Handles customer accounts, sign-in, and verification.

const PROFILE_STORAGE_KEY = "jorjetteangel-client-profiles";
const REMEMBERED_EMAIL_KEY = "jorjetteangel-remembered-email";
const SIGNED_IN_EMAIL_KEY = "jorjetteangel-signed-in-email";
const SIGNUP_EMAIL_OTP_ENABLED = true;
const SIGN_IN_EMAIL_OTP_ENABLED = false;
const ACCOUNT_PASSWORD_FORM = document.getElementById("account-password-form");
const ACCOUNT_PROFILE_FORM = document.getElementById("account-profile-form");
const profileFirstNameInput = document.getElementById(
  "account-profile-first-name",
);
const profileLastNameInput = document.getElementById(
  "account-profile-last-name",
);
const profileEmailInput = document.getElementById("account-profile-email");
const profileMobileInput = document.getElementById("account-profile-mobile");
const profilePreferenceInput = document.getElementById(
  "account-profile-preference",
);
const profilePasswordInput = document.getElementById(
  "account-profile-password",
);
const accountProfileMessage = document.getElementById(
  "account-profile-message",
);
const currentPasswordInput = document.getElementById(
  "account-current-password",
);
const newPasswordInput = document.getElementById("account-new-password");
const confirmNewPasswordInput = document.getElementById(
  "account-confirm-password",
);
const accountPasswordMessage = document.getElementById(
  "account-password-message",
);
const EMAILJS_SERVICE_ID = "jorgetteangel";
const EMAILJS_TEMPLATE_ID = "template_n2qinxl";
const EMAILJS_SIGN_IN_TEMPLATE_ID = "template_rpofcdw";
const EMAILJS_PUBLIC_KEY = "babfxp13g9RIpKj4W";
const VERIFICATION_CODE_LIFETIME_MS = 15 * 60 * 1000;
const savedProfiles = window.backendMemoryStorage.getItem(PROFILE_STORAGE_KEY);
let profiles = savedProfiles ? JSON.parse(savedProfiles) : [];
const verificationCodes = new Map();
let sendingVerificationEmail = false;

if (!Array.isArray(profiles)) {
  throw new Error("Saved client profiles must be an array.");
}

function nextCustomerId(customerProfiles) {
  const highestId = customerProfiles.reduce((highest, profile) => {
    const existingId = [profile.customerId, profile.accountId, profile.id].find(
      (id) => typeof id === "string" && /^ACC-CSTM-\d{3,}$/.test(id),
    );
    const match = existingId && /^ACC-CSTM-(\d{3,})$/.exec(existingId);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `ACC-CSTM-${String(highestId + 1).padStart(3, "0")}`;
}

function ensureCustomerIds(customerProfiles) {
  const usedIds = new Set();
  let changed = false;

  customerProfiles.forEach((profile) => {
    const customerId = [
      profile.customerId,
      profile.accountId,
      profile.id,
    ].find(
      (id) =>
        typeof id === "string" &&
        /^ACC-CSTM-\d{3,}$/.test(id) &&
        !usedIds.has(id),
    );
    if (
      typeof customerId === "string" &&
      /^ACC-CSTM-\d{3,}$/.test(customerId)
    ) {
      if (profile.customerId !== customerId) {
        profile.customerId = customerId;
        changed = true;
      }
      usedIds.add(customerId);
      return;
    }

    let newCustomerId = nextCustomerId(customerProfiles);
    while (usedIds.has(newCustomerId)) {
      const nextNumber = Number(newCustomerId.slice("ACC-CSTM-".length)) + 1;
      newCustomerId = `ACC-CSTM-${String(nextNumber).padStart(3, "0")}`;
    }
    profile.customerId = newCustomerId;
    usedIds.add(newCustomerId);
    changed = true;
  });

  return changed;
}

if (ensureCustomerIds(profiles)) {
  window.backendMemoryStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

const signedInEmail = window.backendMemoryStorage.getItem(SIGNED_IN_EMAIL_KEY);
let activeProfile =
  window.findArrayItem(
    profiles,
    signedInEmail?.toLowerCase(),
    (profile) => profile.email.toLowerCase(),
  );
if (signedInEmail && !activeProfile) {
  window.backendMemoryStorage.removeItem(SIGNED_IN_EMAIL_KEY);
}

const openAccountButton = document.getElementById("open-account-modal");
const closeAccountButton = document.getElementById("close-account-modal");
const accountOverlay = document.getElementById("account-modal-overlay");
const accountModal = document.getElementById("account-modal-container");
const accountTitle = document.getElementById("account-modal-title");
const createPanel = document.getElementById("modal-create-panel");
const signInPanel = document.getElementById("modal-signin-panel");
const createTab = document.getElementById("modal-tab-create");
const signInTab = document.getElementById("modal-tab-signin");
const signInEmail = document.getElementById("signin-email");
const signInPassword = document.getElementById("signin-password");
const signInConsent = document.getElementById("signin-dpa-consent");
const rememberSignIn = document.getElementById("remember-signin");
const signInMessage = document.getElementById("signin-message");
const firstNameInput = document.getElementById("create-first-name");
const lastNameInput = document.getElementById("create-last-name");
const mobileInput = document.getElementById("create-mobile");
const createEmailInput = document.getElementById("create-email");
const createPasswordInput = document.getElementById("create-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const createConsent = document.getElementById("modal-dpa-consent");
const createMessage = document.getElementById("signup-message");
const createButton = document.getElementById("signup-submit-btn");
const signInButton = document.getElementById("signin-submit-btn");
const verificationOverlay = document.getElementById("verification-overlay");
const verificationEmail = document.getElementById("verification-email");
const verificationDescription = document.querySelector(
  ".verification-description",
);
const verificationTitle = document.getElementById("verification-title");
const verificationCodeInputs = Array.from(
  document.querySelectorAll("#verification-code-inputs input"),
);
const verificationMessage = document.getElementById("verification-message");
const verifyEmailButton = document.getElementById("verify-email-button");
const resendVerificationButton = document.getElementById("resend-verification");
const changeVerificationEmailButton = document.getElementById(
  "change-verification-email",
);
const welcomeLanding = document.getElementById("account-welcome");
const welcomeName = document.getElementById("account-welcome-name");
const welcomeCopy = welcomeLanding.querySelector(".welcome-landing-copy");
const accountDetailsOverlay = document.getElementById(
  "account-details-overlay",
);
const accountHubOverlay = document.getElementById("account-hub-overlay");
const accountOrdersOverlay = document.getElementById("account-orders-overlay");
let pendingProfile = null;
let pendingVerificationMode = null;
let pendingPasswordChange = null;
let pendingCheckout = false;

document.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const passwordInput = document.getElementById(
      toggle.getAttribute("data-password-toggle"),
    );
    const isVisible = passwordInput.type === "text";
    passwordInput.type = isVisible ? "password" : "text";
    toggle.textContent = isVisible ? "Show" : "Hide";
    toggle.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} password`);
    toggle.setAttribute("aria-pressed", String(!isVisible));
  });
});


async function hashPassword(password, salt) {
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


function selectAccountMode(mode) {
  const creatingAccount = mode === "create";
  createPanel.classList.toggle("hidden", !creatingAccount);
  signInPanel.classList.toggle("hidden", creatingAccount);
  createTab.classList.toggle("border-b-2", creatingAccount);
  createTab.classList.toggle("border-[#0C0907]", creatingAccount);
  createTab.classList.toggle("bg-white", creatingAccount);
  createTab.classList.toggle("text-[#0C0907]", creatingAccount);
  createTab.classList.toggle("text-neutral-400", !creatingAccount);
  signInTab.classList.toggle("border-b-2", !creatingAccount);
  signInTab.classList.toggle("border-[#0C0907]", !creatingAccount);
  signInTab.classList.toggle("bg-white", !creatingAccount);
  signInTab.classList.toggle("text-[#0C0907]", !creatingAccount);
  signInTab.classList.toggle("text-neutral-400", creatingAccount);
  accountTitle.textContent = creatingAccount ? "Create Account" : "Sign In";
  changeVerificationEmailButton.classList.toggle("hidden", !creatingAccount);
}


function prepareVerificationPrompt(email, mode) {
  verificationEmail.textContent = email;
  verificationDescription.replaceChildren(
    document.createTextNode("Enter the 6-digit verification code sent to "),
    verificationEmail,
    document.createTextNode(
      mode === "signin"
        ? " to finish signing in."
        : mode === "password-change"
          ? " to confirm your password change."
          : " to complete your account setup.",
    ),
  );
  verificationTitle.textContent =
    mode === "signin"
      ? "Verify Your Sign-In"
      : mode === "password-change"
        ? "Confirm Password Change"
        : "Verify Your Email Address";
  verifyEmailButton.textContent =
    mode === "signin"
      ? "Verify & Sign In"
      : mode === "password-change"
        ? "Confirm Password Change"
        : "Verify Email";
  changeVerificationEmailButton.classList.toggle("hidden", mode !== "signup");
}


function openAccountModal() {
  accountOverlay.classList.remove("opacity-0", "pointer-events-none");
  accountOverlay.classList.add("opacity-100");
  accountModal.classList.remove("scale-95");
  accountModal.classList.add("scale-100");
  document.body.style.overflow = "hidden";
}


function closeAccountModal() {
  accountOverlay.classList.add("opacity-0", "pointer-events-none");
  accountOverlay.classList.remove("opacity-100");
  accountModal.classList.add("scale-95");
  accountModal.classList.remove("scale-100");
  document.body.style.overflow = "";
}


function showWelcomeLanding(profile) {
  setActiveProfile(profile);
  welcomeName.textContent = `${profile.firstName} ${profile.lastName}`;
  welcomeCopy.textContent =
    "You are signed in. We’re delighted to welcome you to the atelier.";
  welcomeLanding.classList.remove("hidden");
  welcomeLanding.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.getElementById("welcome-continue").focus();
}


function closeWelcomeLanding() {
  welcomeLanding.classList.add("hidden");
  welcomeLanding.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}


function authorizePendingCheckout() {
  if (!pendingCheckout || !activeProfile) return;
  pendingCheckout = false;
  window.dispatchEvent(
    new CustomEvent("jorjetteangel:checkout-authorized", {
      detail: {
        customer: {
          firstName: activeProfile.firstName,
          lastName: activeProfile.lastName,
          email: activeProfile.email,
          mobile: activeProfile.mobile,
        },
      },
    }),
  );
}


function setActiveProfile(profile) {
  activeProfile = profile;
  window.backendMemoryStorage.setItem(SIGNED_IN_EMAIL_KEY, profile.email);
  openAccountButton.setAttribute(
    "aria-label",
    `Account options for ${profile.firstName} ${profile.lastName}`,
  );
  openAccountButton.title = "View account options";
}


function openAccountHub() {
  if (!activeProfile) return;
  const fullName = `${activeProfile.firstName} ${activeProfile.lastName}`.trim();
  document.getElementById("account-hub-greeting").textContent = fullName
    ? `Welcome, ${fullName}. What would you like to view?`
    : "What would you like to view?";
  accountHubOverlay.classList.remove("hidden");
  accountHubOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.getElementById("open-account-orders").focus();
}


function closeAccountHub() {
  accountHubOverlay.classList.add("hidden");
  accountHubOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}


function openAccountDetails() {
  if (!activeProfile) return;
  profileFirstNameInput.value = activeProfile.firstName;
  profileLastNameInput.value = activeProfile.lastName;
  profileEmailInput.value = activeProfile.email;
  profileMobileInput.value = (activeProfile.mobile || "").replace(/^\+63/, "");
  profilePreferenceInput.value = activeProfile.preference || "";
  profilePasswordInput.value = "";
  accountProfileMessage.textContent = "";
  ACCOUNT_PROFILE_FORM.classList.remove("hidden");
  ACCOUNT_PASSWORD_FORM.classList.remove("hidden");
  accountPasswordMessage.textContent = "";
  currentPasswordInput.value = "";
  newPasswordInput.value = "";
  confirmNewPasswordInput.value = "";
  accountDetailsOverlay.classList.remove("hidden");
  accountDetailsOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.getElementById("close-account-details").focus();
}


function closeAccountDetails() {
  accountDetailsOverlay.classList.add("hidden");
  accountDetailsOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  authorizePendingCheckout();
}


function formatOrderPrice(price) {
  return `PHP ${Number(price).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;
}


function renderAccountOrders() {
  const ordersList = document.getElementById("account-orders-list");
  if (!activeProfile || !ordersList) return;

  try {
    const savedOrders = window.backendMemoryStorage.getItem("jorjetteangel-orders");
    const allOrders = savedOrders ? JSON.parse(savedOrders) : [];
    if (!Array.isArray(allOrders)) {
      throw new Error("Saved orders must be an array.");
    }
    const orders = window.manualSortArray(
      allOrders.filter(
        (order) => {
          if (!order || typeof order !== "object") return false;
          const orderEmail = order.accountEmail || order.customer?.email;
          return (
            typeof orderEmail === "string" &&
            orderEmail.toLowerCase() === activeProfile.email.toLowerCase()
          );
        },
      ),
      (
        (first, second) =>
          new Date(second.createdAt || 0).getTime() -
          new Date(first.createdAt || 0).getTime()
      ),
    );

    if (!orders.length) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "text-[12px] leading-6 text-[#756D65]";
      emptyMessage.textContent =
        "You do not have any orders yet. Orders placed while signed in will appear here.";
      ordersList.replaceChildren(emptyMessage);
      return;
    }

    const orderCards = orders.map((order) => {
      const card = document.createElement("article");
      card.className = "account-order";
      const header = document.createElement("div");
      header.className = "account-order-header";
      const reference = document.createElement("span");
      reference.className = "account-order-reference";
      reference.textContent = order.reference || "Order";
      const status = document.createElement("span");
      status.className = "account-order-status";
      status.textContent = order.status || "Received";
      header.append(reference, status);
      card.append(header);

      const date = document.createElement("p");
      date.className = "account-order-meta";
      const parsedDate = new Date(order.createdAt || "");
      date.textContent = Number.isNaN(parsedDate.getTime())
        ? "Date unavailable"
        : parsedDate.toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          });
      card.append(date);

      const items = document.createElement("p");
      items.className = "account-order-items";
      items.textContent = Array.isArray(order.items)
        ? order.items
            .map(
              (item) =>
                `${item.orderId ? `${item.orderId} · ` : ""}${item.name || "Item"}${item.size ? ` · ${item.size}` : ""} × ${Number(item.quantity) || 1}`,
            )
            .join(", ")
        : "Order items unavailable";
      card.append(items);

      const address = order.deliveryAddress;
      if (address && typeof address === "object") {
        const delivery = document.createElement("p");
        delivery.className = "account-order-address";
        delivery.textContent = [
          address.street,
          address.city,
          address.province,
          address.postalCode,
        ]
          .filter((part) => typeof part === "string" && part.trim())
          .join(", ");
        card.append(delivery);
      }

      const deliveryFee = document.createElement("div");
      deliveryFee.className = "account-order-meta";
      deliveryFee.textContent = `Standard delivery: ${formatOrderPrice(
        Number(order.deliveryFee) || 0,
      )}`;
      card.append(deliveryFee);

      const total = document.createElement("div");
      total.className = "account-order-total";
      const payment = document.createElement("span");
      payment.textContent = order.paymentMethod || "Payment not specified";
      const amount = document.createElement("strong");
      amount.textContent = formatOrderPrice(order.total || 0);
      total.append(payment, amount);
      card.append(total);
      return card;
    });
    ordersList.replaceChildren(...orderCards);
  } catch (error) {
    console.error("Could not load the customer's orders.", error);
    const errorMessage = document.createElement("p");
    errorMessage.className = "text-[12px] leading-6 text-[#756D65]";
    errorMessage.textContent =
      "We could not load your order history. Please try again later.";
    ordersList.replaceChildren(errorMessage);
  }
}


function openAccountOrders() {
  if (!activeProfile) return;
  closeAccountHub();
  renderAccountOrders();
  accountOrdersOverlay.classList.remove("hidden");
  accountOrdersOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.getElementById("close-account-orders").focus();
}


function closeAccountOrders() {
  accountOrdersOverlay.classList.add("hidden");
  accountOrdersOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}


function openAccountPortal() {
  if (activeProfile) {
    openAccountHub();
    return;
  }
  selectAccountMode("create");
  openAccountModal();
}

openAccountButton.addEventListener("click", openAccountPortal);
document
  .getElementById("close-account-hub")
  .addEventListener("click", closeAccountHub);
document
  .getElementById("open-account-orders")
  .addEventListener("click", openAccountOrders);
document
  .getElementById("open-account-details")
  .addEventListener("click", () => {
    closeAccountHub();
    openAccountDetails();
  });
document
  .getElementById("close-account-orders")
  .addEventListener("click", closeAccountOrders);
accountHubOverlay.addEventListener("click", (event) => {
  if (event.target === accountHubOverlay) closeAccountHub();
});
accountOrdersOverlay.addEventListener("click", (event) => {
  if (event.target === accountOrdersOverlay) closeAccountOrders();
});


function requestCheckout() {
  if (!window.cartStore.read().length) {
    window.location.hash = "bag";
    return;
  }
  if (activeProfile) {
    window.dispatchEvent(
      new CustomEvent("jorjetteangel:checkout-authorized", {
        detail: {
          customer: {
            firstName: activeProfile.firstName,
            lastName: activeProfile.lastName,
            email: activeProfile.email,
            mobile: activeProfile.mobile,
          },
        },
      }),
    );
    return;
  }

  pendingCheckout = true;
  selectAccountMode("signin");
  signInMessage.textContent =
    "Sign in or create an account to continue to checkout.";
  openAccountModal();
  signInEmail.focus();
}

window.addEventListener("jorjetteangel:checkout-requested", requestCheckout);
closeAccountButton.addEventListener("click", () => {
  pendingCheckout = false;
  closeAccountModal();
  if (window.location.hash === "#checkout") window.location.hash = "bag";
});
createTab.addEventListener("click", () => selectAccountMode("create"));
signInTab.addEventListener("click", () => selectAccountMode("signin"));
document
  .getElementById("welcome-continue")
  .addEventListener("click", () => {
    closeWelcomeLanding();
    authorizePendingCheckout();
  });
document
  .getElementById("welcome-account-details")
  .addEventListener("click", () => {
    closeWelcomeLanding();
    openAccountDetails();
  });
document
  .getElementById("close-account-details")
  .addEventListener("click", closeAccountDetails);
profileMobileInput.addEventListener("input", () => {
  profileMobileInput.value = profileMobileInput.value
    .replace(/\D/g, "")
    .slice(0, 10);
});
document.getElementById("account-sign-out").addEventListener("click", () => {
  activeProfile = null;
  window.backendMemoryStorage.removeItem(SIGNED_IN_EMAIL_KEY);
  openAccountButton.setAttribute("aria-label", "Client Account Portal");
  openAccountButton.title = "Client Account & Atelier Portal";
  closeAccountHub();
  closeAccountOrders();
  closeAccountDetails();
  selectAccountMode("signin");
  openAccountModal();
});
window.addEventListener("storage", (event) => {
  if (event.key !== PROFILE_STORAGE_KEY) return;
  const latestProfiles = JSON.parse(event.newValue || "[]");
  if (!Array.isArray(latestProfiles)) {
    throw new Error("Saved client profiles must be an array.");
  }
  profiles = latestProfiles;
  if (ensureCustomerIds(profiles)) {
    window.backendMemoryStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  }
  if (!activeProfile) return;

  const latestProfile = window.findArrayItem(
    profiles,
    activeProfile.email.toLowerCase(),
    (profile) => profile.email.toLowerCase(),
  );
  if (latestProfile) {
    setActiveProfile(latestProfile);
    return;
  }

  activeProfile = null;
  window.backendMemoryStorage.removeItem(SIGNED_IN_EMAIL_KEY);
  openAccountButton.setAttribute("aria-label", "Client Account Portal");
  openAccountButton.title = "Client Account & Atelier Portal";
  closeWelcomeLanding();
  closeAccountHub();
  closeAccountOrders();
  closeAccountDetails();
  window.dispatchEvent(new CustomEvent("jorjetteangel:account-reset"));
  if (window.location.hash === "#checkout") {
    window.dispatchEvent(new CustomEvent("jorjetteangel:checkout-requested"));
  }
});
accountDetailsOverlay.addEventListener("click", (event) => {
  if (event.target === accountDetailsOverlay) closeAccountDetails();
});

accountOverlay.addEventListener("click", (event) => {
  if (event.target === accountOverlay) {
    pendingCheckout = false;
    closeAccountModal();
    if (window.location.hash === "#checkout") window.location.hash = "bag";
  }
});

window.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !verificationOverlay.classList.contains("hidden")
  ) {
    cancelVerification();
  } else if (event.key === "Escape") {
    if (!accountDetailsOverlay.classList.contains("hidden")) {
      closeAccountDetails();
    } else if (!accountOrdersOverlay.classList.contains("hidden")) {
      closeAccountOrders();
    } else if (!accountHubOverlay.classList.contains("hidden")) {
      closeAccountHub();
    } else {
      pendingCheckout = false;
      closeAccountModal();
      if (window.location.hash === "#checkout") window.location.hash = "bag";
    }
  }
});

mobileInput.addEventListener("input", () => {
  mobileInput.value = mobileInput.value.replace(/\D/g, "").slice(0, 10);
});

document.querySelectorAll('input[name="preference"]').forEach((input) => {
  input.addEventListener("change", () => {
    document.querySelectorAll('input[name="preference"]').forEach((option) => {
      const label = option.closest("label");
      label.classList.toggle("border-2", option.checked);
      label.classList.toggle("border-[#0C0907]", option.checked);
      label.classList.toggle("bg-[#FAF9F7]", option.checked);
      label.classList.toggle("font-semibold", option.checked);
      label.classList.toggle("border", !option.checked);
      label.classList.toggle("border-[#E5DFD7]", !option.checked);
    });
  });
});

createButton.addEventListener("click", async () => {
  createMessage.textContent = "";
  if (
    !firstNameInput.reportValidity() ||
    !lastNameInput.reportValidity() ||
    !mobileInput.reportValidity() ||
    !createEmailInput.reportValidity() ||
    !createPasswordInput.reportValidity() ||
    !confirmPasswordInput.reportValidity() ||
    !createConsent.reportValidity()
  ) {
    return;
  }

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const email = createEmailInput.value.trim().toLowerCase();
  const password = createPasswordInput.value;
  const preference =
    document.querySelector('input[name="preference"]:checked')?.value || "";

  if (!/^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>])(?=.{8,})/.test(password)) {
    createPasswordInput.setCustomValidity(
      "Use at least 8 characters, including an uppercase letter and a special character.",
    );
    createPasswordInput.reportValidity();
    createPasswordInput.setCustomValidity("");
    return;
  }

  if (password !== confirmPasswordInput.value) {
    confirmPasswordInput.setCustomValidity("Passwords do not match.");
    confirmPasswordInput.reportValidity();
    confirmPasswordInput.setCustomValidity("");
    return;
  }

  for (const profile of profiles) {
    if (profile.email.toLowerCase() === email) {
      createEmailInput.setCustomValidity(
        "An account with this email already exists.",
      );
      createEmailInput.reportValidity();
      createEmailInput.setCustomValidity("");
      return;
    }
  }

  const salt = Array.from(
    window.crypto.getRandomValues(new Uint8Array(16)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

  try {
    pendingVerificationMode = "signup";
    pendingProfile = {
      firstName,
      lastName,
      mobile: `+63${mobileInput.value}`,
      email,
      passwordSalt: salt,
      passwordHash: await hashPassword(password, salt),
      preference,
    };
    if (!SIGNUP_EMAIL_OTP_ENABLED) {
      saveVerifiedProfile();
      return;
    }
    prepareVerificationPrompt(email, "signup");
    verificationCodeInputs.forEach((input) => {
      input.value = "";
    });
    verificationMessage.textContent = "";
    verificationOverlay.classList.remove("hidden");
    verificationOverlay.classList.add("flex");
    verificationOverlay.setAttribute("aria-hidden", "false");
    verificationCodeInputs[0].focus();
    window.dispatchEvent(
      new CustomEvent("jorjetteangel:verification-requested", {
        detail: { email },
      }),
    );
  } catch (error) {
    pendingProfile = null;
    console.error(
      "Could not prepare the client profile for verification.",
      error,
    );
    createMessage.textContent =
      "We could not create your account. Please try again.";
  }
});


function closeVerificationPopup() {
  verificationOverlay.classList.add("hidden");
  verificationOverlay.classList.remove("flex");
  verificationOverlay.setAttribute("aria-hidden", "true");
  verificationCodeInputs.forEach((input) => {
    input.value = "";
  });
}


function cancelVerification() {
  if (pendingProfile) verificationCodes.delete(pendingProfile.email);
  const restoreAccountDetails = pendingVerificationMode === "password-change";
  pendingProfile = null;
  pendingVerificationMode = null;
  pendingPasswordChange = null;
  closeVerificationPopup();
  verificationMessage.textContent = "";
  if (restoreAccountDetails) openAccountDetails();
}


function makeVerificationCode() {
  const value = new Uint32Array(1);
  window.crypto.getRandomValues(value);
  return String(value[0] % 1000000).padStart(6, "0");
}


function reportVerificationEmail(email, sent, message) {
  window.dispatchEvent(
    new CustomEvent("jorjetteangel:verification-email-status", {
      detail: { email, sent, message },
    }),
  );
}


async function sendVerificationEmail(email) {
  if (sendingVerificationEmail) return;
  const templateId =
    pendingVerificationMode === "signin" ||
    pendingVerificationMode === "password-change"
      ? EMAILJS_SIGN_IN_TEMPLATE_ID
      : EMAILJS_TEMPLATE_ID;
  let hasMissingEmailConfiguration = false;
  for (const value of [
    EMAILJS_SERVICE_ID,
    templateId,
    EMAILJS_PUBLIC_KEY,
  ]) {
    if (!value.trim() || value.startsWith("YOUR_")) {
      hasMissingEmailConfiguration = true;
      break;
    }
  }
  if (hasMissingEmailConfiguration) {
    reportVerificationEmail(
      email,
      false,
      "Add your EmailJS Service ID, Template ID, and Public Key in frontend-login.js.",
    );
    return;
  }
  if (!window.emailjs) {
    reportVerificationEmail(
      email,
      false,
      "Email verification is unavailable because the EmailJS SDK did not load.",
    );
    return;
  }

  sendingVerificationEmail = true;
  resendVerificationButton.disabled = true;
  const code = makeVerificationCode();
  const expiresAt = Date.now() + VERIFICATION_CODE_LIFETIME_MS;
  try {
    await window.emailjs.send(
      EMAILJS_SERVICE_ID,
      templateId,
      {
        to_email: email,
        customer_name:
          pendingProfile?.email === email
            ? `${pendingProfile.firstName} ${pendingProfile.lastName}`
            : "",
        passcode: code,
        time: `${new Date(expiresAt).toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
        })} ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
        website_link: window.location.href.split("#")[0],
      },
      { publicKey: EMAILJS_PUBLIC_KEY },
    );
    verificationCodes.set(email, {
      code,
      expiresAt,
    });
    reportVerificationEmail(
      email,
      true,
      "Verification email sent. Check your inbox.",
    );
  } catch (error) {
    console.error("EmailJS could not send the verification email.", error);
    const emailJsErrorDetails =
      error && typeof error === "object"
        ? [error.status, error.text, error.message]
            .filter(
              (detail) =>
                typeof detail === "string" || typeof detail === "number",
            )
            .join(" ")
        : String(error);
    reportVerificationEmail(
      email,
      false,
      `EmailJS could not send the message${emailJsErrorDetails ? `: ${emailJsErrorDetails.slice(0, 220)}` : ". Check your service, template, and public key."}`,
    );
  } finally {
    sendingVerificationEmail = false;
    window.setTimeout(() => {
      resendVerificationButton.disabled = false;
    }, 1100);
  }
}


function completeSignIn(profile) {
  if (rememberSignIn.checked) {
    window.backendMemoryStorage.setItem(REMEMBERED_EMAIL_KEY, profile.email);
  } else {
    window.backendMemoryStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }
  signInPassword.value = "";
  closeAccountModal();
  showWelcomeLanding(profile);
}


function saveVerifiedProfile() {
  if (!pendingProfile) return;
  const verifiedProfile = pendingProfile;
  if (pendingVerificationMode === "password-change") {
    if (!pendingPasswordChange) {
      throw new Error("Pending password change data is missing.");
    }
    const latestSavedProfiles = window.backendMemoryStorage.getItem(PROFILE_STORAGE_KEY);
    let latestProfiles = latestSavedProfiles
      ? JSON.parse(latestSavedProfiles)
      : [];
    if (!Array.isArray(latestProfiles)) {
      throw new Error("Saved client profiles must be an array.");
    }
    const profileIndex = window.findArrayItemIndex(
      latestProfiles,
      verifiedProfile.email.toLowerCase(),
      (profile) => profile.email.toLowerCase(),
    );
    if (profileIndex === -1) {
      throw new Error("The client account could not be found.");
    }
    latestProfiles[profileIndex] = {
      ...latestProfiles[profileIndex],
      ...pendingPasswordChange,
    };
    window.backendMemoryStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(latestProfiles));
    profiles = latestProfiles;
    activeProfile = latestProfiles[profileIndex];
    pendingProfile = null;
    pendingVerificationMode = null;
    pendingPasswordChange = null;
    closeVerificationPopup();
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmNewPasswordInput.value = "";
    accountPasswordMessage.textContent =
      "Your password was changed successfully.";
    openAccountDetails();
    accountPasswordMessage.textContent =
      "Your password was changed successfully.";
    return;
  }
  if (pendingVerificationMode === "signin") {
    pendingProfile = null;
    pendingVerificationMode = null;
    closeVerificationPopup();
    completeSignIn(verifiedProfile);
    return;
  }

  const latestSavedProfiles = window.backendMemoryStorage.getItem(PROFILE_STORAGE_KEY);
  let latestProfiles = latestSavedProfiles
    ? JSON.parse(latestSavedProfiles)
    : [];
  if (!Array.isArray(latestProfiles)) {
    throw new Error("Saved client profiles must be an array.");
  }
  if (
    window.findArrayItem(
      latestProfiles,
      verifiedProfile.email.toLowerCase(),
      (profile) => profile.email.toLowerCase(),
    )
  ) {
    throw new Error("An account with this email already exists.");
  }
  ensureCustomerIds(latestProfiles);
  verifiedProfile.customerId = nextCustomerId(latestProfiles);
  latestProfiles = window.arrayWithAppended(latestProfiles, verifiedProfile);
  window.backendMemoryStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(latestProfiles));
  profiles = latestProfiles;
  pendingProfile = null;
  pendingVerificationMode = null;
  closeVerificationPopup();
  createPasswordInput.value = "";
  confirmPasswordInput.value = "";
  closeAccountModal();
  showWelcomeLanding(verifiedProfile);
}

verificationCodeInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "");
    input.value = digits.slice(-1);
    if (digits.length > 1) {
      digits
        .slice(1)
        .split("")
        .forEach((digit, offset) => {
          const nextInput = verificationCodeInputs[index + offset + 1];
          if (nextInput) nextInput.value = digit;
        });
    }
    if (input.value && verificationCodeInputs[index + 1]) {
      verificationCodeInputs[index + 1].focus();
    }
  });
  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Backspace" &&
      !input.value &&
      verificationCodeInputs[index - 1]
    ) {
      verificationCodeInputs[index - 1].focus();
    }
    if (event.key === "ArrowLeft" && verificationCodeInputs[index - 1]) {
      verificationCodeInputs[index - 1].focus();
    }
    if (event.key === "ArrowRight" && verificationCodeInputs[index + 1]) {
      verificationCodeInputs[index + 1].focus();
    }
  });
  input.addEventListener("paste", (event) => {
    event.preventDefault();
    const pastedDigits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, verificationCodeInputs.length);
    pastedDigits.split("").forEach((digit, digitIndex) => {
      verificationCodeInputs[digitIndex].value = digit;
    });
    verificationCodeInputs[
      Math.min(pastedDigits.length, verificationCodeInputs.length - 1)
    ].focus();
  });
});

resendVerificationButton.addEventListener("click", () => {
  if (!pendingProfile) return;
  verificationMessage.textContent = "";
  window.dispatchEvent(
    new CustomEvent("jorjetteangel:verification-requested", {
      detail: { email: pendingProfile.email },
    }),
  );
});

window.addEventListener("jorjetteangel:verification-requested", (event) => {
  const { email } = event.detail || {};
  if (!pendingProfile || email !== pendingProfile.email) return;
  void sendVerificationEmail(email);
});

verifyEmailButton.addEventListener("click", () => {
  if (!pendingProfile) return;
  for (const input of verificationCodeInputs) {
    if (!input.reportValidity()) return;
  }
  const code = verificationCodeInputs.map((input) => input.value).join("");
  verificationMessage.textContent = "Checking your verification code...";
  window.dispatchEvent(
    new CustomEvent("jorjetteangel:verification-code-submitted", {
      detail: {
        email: pendingProfile.email,
        code,
      },
    }),
  );
});

window.addEventListener("jorjetteangel:verification-email-status", (event) => {
  const { email, sent, message } = event.detail || {};
  if (!pendingProfile || email !== pendingProfile.email) return;
  verificationMessage.textContent =
    message ||
    (sent
      ? "Verification email sent. Check your inbox."
      : "We could not send the verification email. Please try again.");
});

window.addEventListener(
  "jorjetteangel:verification-code-submitted",
  (event) => {
    const { email, code } = event.detail || {};
    if (!pendingProfile || email !== pendingProfile.email) return;
    const savedCode = verificationCodes.get(email);
    if (!savedCode || Date.now() > savedCode.expiresAt) {
      verificationCodes.delete(email);
      window.dispatchEvent(
        new CustomEvent("jorjetteangel:verification-result", {
          detail: {
            email,
            verified: false,
            message: "Your code has expired. Resend a new code and try again.",
          },
        }),
      );
      return;
    }

    const verified = code === savedCode.code;
    if (verified) verificationCodes.delete(email);
    window.dispatchEvent(
      new CustomEvent("jorjetteangel:verification-result", {
        detail: {
          email,
          verified,
          message: verified
            ? ""
            : "That code is incorrect. Please check it and try again.",
        },
      }),
    );
  },
);

window.addEventListener("jorjetteangel:verification-result", (event) => {
  const { email, verified, message } = event.detail || {};
  if (!pendingProfile || email !== pendingProfile.email) return;
  if (!verified) {
    verificationMessage.textContent =
      message || "That code is incorrect or has expired. Try again.";
    return;
  }
  try {
    saveVerifiedProfile();
  } catch (error) {
    console.error("Could not complete the verified account action.", error);
    verificationMessage.textContent =
      "Verification succeeded, but we could not save the change. Please try again.";
  }
});

ACCOUNT_PASSWORD_FORM.addEventListener("submit", async (event) => {
  event.preventDefault();
  accountPasswordMessage.textContent = "";
  if (!activeProfile) return;
  if (
    !currentPasswordInput.reportValidity() ||
    !newPasswordInput.reportValidity() ||
    !confirmNewPasswordInput.reportValidity()
  ) {
    return;
  }

  const newPassword = newPasswordInput.value;
  if (!/^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>])(?=.{8,})/.test(newPassword)) {
    newPasswordInput.setCustomValidity(
      "Use at least 8 characters, including an uppercase letter and a special character.",
    );
    newPasswordInput.reportValidity();
    newPasswordInput.setCustomValidity("");
    return;
  }
  if (newPassword !== confirmNewPasswordInput.value) {
    confirmNewPasswordInput.setCustomValidity("Passwords do not match.");
    confirmNewPasswordInput.reportValidity();
    confirmNewPasswordInput.setCustomValidity("");
    return;
  }

  try {
    const currentPasswordHash = await hashPassword(
      currentPasswordInput.value,
      activeProfile.passwordSalt,
    );
    if (currentPasswordHash !== activeProfile.passwordHash) {
      accountPasswordMessage.textContent = "Current password is incorrect.";
      return;
    }
    if (newPassword === currentPasswordInput.value) {
      accountPasswordMessage.textContent =
        "Choose a new password different from your current password.";
      return;
    }

    const salt = Array.from(
      window.crypto.getRandomValues(new Uint8Array(16)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    pendingPasswordChange = {
      passwordSalt: salt,
      passwordHash: await hashPassword(newPassword, salt),
    };
    pendingProfile = activeProfile;
    pendingVerificationMode = "password-change";
    prepareVerificationPrompt(activeProfile.email, "password-change");
    verificationCodeInputs.forEach((input) => {
      input.value = "";
    });
    verificationMessage.textContent = "";
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmNewPasswordInput.value = "";
    closeAccountDetails();
    verificationOverlay.classList.remove("hidden");
    verificationOverlay.classList.add("flex");
    verificationOverlay.setAttribute("aria-hidden", "false");
    verificationCodeInputs[0].focus();
    window.dispatchEvent(
      new CustomEvent("jorjetteangel:verification-requested", {
        detail: { email: activeProfile.email },
      }),
    );
  } catch (error) {
    pendingProfile = null;
    pendingVerificationMode = null;
    pendingPasswordChange = null;
    console.error("Could not start the password change.", error);
    accountPasswordMessage.textContent =
      "We could not start the password change. Please try again.";
  }
});

ACCOUNT_PROFILE_FORM.addEventListener("submit", async (event) => {
  event.preventDefault();
  accountProfileMessage.textContent = "";
  if (!activeProfile) return;
  if (
    !profileFirstNameInput.reportValidity() ||
    !profileLastNameInput.reportValidity() ||
    !profileEmailInput.reportValidity() ||
    !profileMobileInput.reportValidity() ||
    !profilePreferenceInput.reportValidity() ||
    !profilePasswordInput.reportValidity()
  ) {
    return;
  }

  const updatedProfile = {
    firstName: profileFirstNameInput.value.trim(),
    lastName: profileLastNameInput.value.trim(),
    email: profileEmailInput.value.trim().toLowerCase(),
    mobile: `+63${profileMobileInput.value}`,
    preference: profilePreferenceInput.value,
  };

  try {
    const enteredPasswordHash = await hashPassword(
      profilePasswordInput.value,
      activeProfile.passwordSalt,
    );
    if (enteredPasswordHash !== activeProfile.passwordHash) {
      accountProfileMessage.textContent = "Account password is incorrect.";
      return;
    }

    if (
      updatedProfile.email !== activeProfile.email.toLowerCase() &&
      window.findArrayItem(
        profiles,
        updatedProfile.email,
        (profile) => profile.email.toLowerCase(),
      )
    ) {
      accountProfileMessage.textContent =
        "An account with this email address already exists.";
      return;
    }

    const previousEmail = activeProfile.email;
    const latestSavedProfiles = window.backendMemoryStorage.getItem(PROFILE_STORAGE_KEY);
    const latestProfiles = latestSavedProfiles
      ? JSON.parse(latestSavedProfiles)
      : [];
    if (!Array.isArray(latestProfiles)) {
      throw new Error("Saved client profiles must be an array.");
    }
    const profileIndex = window.findArrayItemIndex(
      latestProfiles,
      previousEmail.toLowerCase(),
      (profile) => profile.email.toLowerCase(),
    );
    if (profileIndex === -1) {
      throw new Error("The client account could not be found.");
    }

    latestProfiles[profileIndex] = {
      ...latestProfiles[profileIndex],
      ...updatedProfile,
    };
    window.backendMemoryStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(latestProfiles));
    profiles = latestProfiles;
    profilePasswordInput.value = "";
    setActiveProfile(latestProfiles[profileIndex]);
    if (window.backendMemoryStorage.getItem(REMEMBERED_EMAIL_KEY) === previousEmail) {
      window.backendMemoryStorage.setItem(REMEMBERED_EMAIL_KEY, updatedProfile.email);
    }
    accountProfileMessage.textContent =
      "Your account details were updated successfully.";
  } catch (error) {
    console.error("Could not update the client account details.", error);
    accountProfileMessage.textContent =
      "We could not update your account details. Please try again.";
  }
});

document
  .getElementById("close-verification")
  .addEventListener("click", cancelVerification);
document
  .getElementById("change-verification-email")
  .addEventListener("click", () => {
    cancelVerification();
    selectAccountMode("create");
    createEmailInput.focus();
  });
verificationOverlay.addEventListener("click", (event) => {
  if (event.target === verificationOverlay) cancelVerification();
});

signInEmail.value = window.backendMemoryStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
rememberSignIn.checked = Boolean(signInEmail.value);
if (activeProfile) {
  openAccountButton.setAttribute(
    "aria-label",
    `Account options for ${activeProfile.firstName} ${activeProfile.lastName}`,
  );
  openAccountButton.title = "View account options";
}

signInButton.addEventListener("click", async () => {
  signInMessage.textContent = "";
  const email = signInEmail.value.trim().toLowerCase();
  if (
    !signInEmail.reportValidity() ||
    !signInPassword.reportValidity() ||
    !signInConsent.reportValidity()
  ) {
    return;
  }

  const matchingProfile = window.findArrayItem(
    profiles,
    email,
    (profile) => profile.email.toLowerCase(),
  );

  if (!matchingProfile) {
    signInMessage.textContent = "Email or password is incorrect.";
    return;
  }

  try {
    const enteredPasswordHash = await hashPassword(
      signInPassword.value,
      matchingProfile.passwordSalt,
    );
    if (enteredPasswordHash !== matchingProfile.passwordHash) {
      signInMessage.textContent = "Email or password is incorrect.";
      return;
    }
    const accountStatus = String(
      matchingProfile.accountStatus || matchingProfile.status || "",
    ).toLowerCase();
    if (
      matchingProfile.isActive === false ||
      matchingProfile.active === false ||
      matchingProfile.isBanned === true ||
      ["inactive", "deactivated", "banned", "blocked", "suspended"].includes(
        accountStatus,
      )
    ) {
      signInMessage.textContent =
        "This account is inactive or restricted. Contact support for assistance.";
      return;
    }

    if (!SIGN_IN_EMAIL_OTP_ENABLED) {
      completeSignIn(matchingProfile);
      return;
    }

    pendingProfile = matchingProfile;
    pendingVerificationMode = "signin";
    verificationEmail.textContent = email;
    verificationDescription.innerHTML = `Enter the 6-digit verification code sent to <strong id="verification-email">${email}</strong> to finish signing in.`;
    verificationCodeInputs.forEach((input) => {
      input.value = "";
    });
    verificationMessage.textContent = "";
    prepareVerificationPrompt(email, "signin");
    verificationOverlay.classList.remove("hidden");
    verificationOverlay.classList.add("flex");
    verificationOverlay.setAttribute("aria-hidden", "false");
    verificationCodeInputs[0].focus();
    window.dispatchEvent(
      new CustomEvent("jorjetteangel:verification-requested", {
        detail: { email },
      }),
    );
  } catch (error) {
    console.error("Could not verify the client profile.", error);
    signInMessage.textContent =
      "We could not verify your account. Please try again.";
  }
});

selectAccountMode("create");
if (window.location.hash === "#checkout") requestCheckout();
