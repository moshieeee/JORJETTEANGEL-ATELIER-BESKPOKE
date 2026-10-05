// Manages staff and customer accounts.

const CUSTOMER_PROFILES_KEY = "jorjetteangel-client-profiles";
const STAFF_ACCOUNTS_KEY = "jorjetteangel-staff-accounts";
const ADMIN_SESSION_KEY = "jorjetteangel-admin-session";
const ADMIN_USERS_KEY = "jorjetteangel-admin-users";
const ADMIN_REMEMBER_KEY = "jorjetteangel-admin-remember";
const STAFF_ROLES = ["Admin", "Cashier", "Warehouse", "Production"];

const accountsTableBody = document.getElementById("accountsTableBody");
const customerAccountsTableBody = document.getElementById(
  "customerAccountsTableBody",
);
const accountsSearch = document.getElementById("accountSearch");
const accountsEmpty = document.getElementById("accountsEmpty");
const customerAccountsEmpty = document.getElementById("customerAccountsEmpty");
const accountsError = document.getElementById("accountsError");
const accountStatusTabs = Array.from(
  document.querySelectorAll(".account-status-tab"),
);
const accountsStatusPanel = document.getElementById("accountsStatusPanel");
const profileDialog = document.getElementById("profileDialog");
const accountViewDialog = document.getElementById("accountViewDialog");
const staffDialog = document.getElementById("staffDialog");
const staffForm = document.getElementById("staffForm");
const staffFormMessage = document.getElementById("staffFormMessage");
let customerProfiles = [];
let staffAccounts = [];
let renderedAccounts = new Map();
let selectedAccountStatus = "active";

function readArrayStorage(key, label) {
  const saved = window.backendMemoryStorage.getItem(key);
  if (!saved) return [];
  const value = JSON.parse(saved);
  if (!Array.isArray(value)) {
    throw new Error(`Saved ${label} must be a list.`);
  }
  return value;
}

function nextCustomerId(profiles) {
  const highestId = profiles.reduce((highest, profile) => {
    const existingId = [profile.customerId, profile.accountId, profile.id].find(
      (id) => typeof id === "string" && /^ACC-CSTM-\d{3,}$/.test(id),
    );
    const match = existingId && /^ACC-CSTM-(\d{3,})$/.exec(existingId);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `ACC-CSTM-${String(highestId + 1).padStart(3, "0")}`;
}

function ensureCustomerIds(profiles) {
  const usedIds = new Set();
  let changed = false;

  profiles.forEach((profile) => {
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

    let newCustomerId = nextCustomerId(profiles);
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

function getFullName(profile) {
  return [profile.firstName, profile.lastName]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ") || profile.name || "Name not provided";
}

function getStatus(account) {
  const status = String(account.accountStatus || account.status || "").toLowerCase();
  if (
    account.isBanned === true ||
    ["banned", "blocked", "suspended"].includes(status)
  ) {
    return "Banned";
  }
  if (
    account.isActive === false ||
    account.active === false ||
    ["inactive", "deactivated"].includes(status)
  ) {
    return "Inactive";
  }
  return "Active";
}

function formatRegisteredDate(account) {
  const value =
    account.registeredAt || account.createdAt || account.dateRegistered;
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function createCell(className, content) {
  const cell = document.createElement("td");
  cell.className = className;
  cell.textContent = content;
  return cell;
}

function appendAccountRow(account, accountKey, tableBody) {
  const { id, name, email, registered, status, role, type, source } = account;
  const row = document.createElement("tr");
  row.dataset.search = [id, name, email, status, role].join(" ").toLowerCase();
  row.dataset.accountStatus = status === "Active" ? "active" : "inactive";
  row.append(createCell("account-id", id));

  const nameLabel = document.createElement("span");
  nameLabel.className = "account-name";
  nameLabel.textContent = name;
  const nameCell = document.createElement("td");
  nameCell.append(nameLabel);
  row.append(nameCell);
  if (account.showRole !== false) {
    row.append(
      createCell(
        "account-role",
        role || (type === "customer" ? "Customer" : "Staff"),
      ),
    );
  }
  row.append(
    createCell("account-email", email || "—"),
    createCell("account-date", registered),
  );

  const statusCell = document.createElement("td");
  const statusBadge = document.createElement("span");
  statusBadge.className = `status-badge status-${status.toLowerCase()}`;
  const statusDot = document.createElement("span");
  statusDot.className = "status-dot";
  statusDot.setAttribute("aria-hidden", "true");
  const statusText = document.createElement("span");
  statusText.textContent = status;
  statusBadge.append(statusDot, statusText);
  statusCell.append(statusBadge);
  row.append(statusCell);

  const actionCell = document.createElement("td");
  const actionGroup = document.createElement("div");
  actionGroup.className = "account-row-actions";
  const viewButton = document.createElement("button");
  viewButton.className = "account-action";
  viewButton.type = "button";
  viewButton.dataset.accountAction = "view";
  viewButton.dataset.accountKey = accountKey;
  viewButton.textContent = "View";
  const statusButton = document.createElement("button");
  statusButton.className = `account-action ${
    status === "Active" ? "deactivate" : "activate"
  }`;
  statusButton.type = "button";
  statusButton.dataset.accountAction =
    status === "Active" ? "deactivate" : "activate";
  statusButton.dataset.accountKey = accountKey;
  statusButton.textContent = status === "Active" ? "Deactivate" : "Activate";
  const isCurrentAdmin = source === "admin" && isSignedInAdmin(account.sourceEmail);
  const hasStableReference = Boolean(account.sourceId || account.sourceEmail);
  if (isCurrentAdmin || !hasStableReference) {
    statusButton.disabled = true;
    statusButton.title = isCurrentAdmin
      ? "You cannot deactivate your signed-in admin account."
      : "This account has no stable identifier and cannot be updated.";
  }
  actionGroup.append(viewButton, statusButton);
  actionCell.append(actionGroup);
  row.append(actionCell);
  renderedAccounts.set(accountKey, account);
  tableBody.append(row);
}

function renderAccounts() {
  accountsTableBody.replaceChildren();
  customerAccountsTableBody.replaceChildren();
  renderedAccounts = new Map();

  const customerRows = customerProfiles.map((profile) => ({
    id: profile.customerId,
    name: getFullName(profile),
    email: typeof profile.email === "string" ? profile.email : "",
    registered: formatRegisteredDate(profile),
    status: getStatus(profile),
    type: "customer",
    source: "customer",
    showRole: false,
    sourceId: profile.customerId,
    sourceEmail: typeof profile.email === "string" ? profile.email : "",
    account: profile,
  }));
  const staffRows = staffAccounts.map((staff) => ({
    id: staff.employeeId,
    name: staff.name,
    email: staff.email,
    registered: formatRegisteredDate(staff),
    status: getStatus(staff),
    role: staff.role,
    type: "staff",
    source: staff.isAdminLogin ? "admin" : "staff",
    sourceId: staff.employeeId,
    sourceEmail: staff.email,
    account: staff,
  }));

  staffRows.forEach((account, index) =>
    appendAccountRow(account, `staff-${index}`, accountsTableBody),
  );
  customerRows.forEach((account, index) =>
    appendAccountRow(
      account,
      `customer-${index}`,
      customerAccountsTableBody,
    ),
  );
  filterAccounts();
}

function updateAccountStatusTabs() {
  const allAccounts = [...customerProfiles, ...staffAccounts];
  const activeCount = allAccounts.filter(
    (account) => getStatus(account) === "Active",
  ).length;
  document.getElementById("activeAccountsCount").textContent =
    String(activeCount);
  document.getElementById("inactiveAccountsCount").textContent =
    String(allAccounts.length - activeCount);

  accountStatusTabs.forEach((tab) => {
    const isSelected = tab.dataset.accountStatus === selectedAccountStatus;
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
    tab.classList.toggle("is-selected", isSelected);
  });
  accountsStatusPanel.setAttribute(
    "aria-labelledby",
    selectedAccountStatus === "active"
      ? "activeAccountsTab"
      : "inactiveAccountsTab",
  );
}

function filterAccounts() {
  const query = accountsSearch.value.trim().toLowerCase();
  const statusLabel =
    selectedAccountStatus === "active" ? "active" : "inactive";
  const filterTable = (tableBody, emptyElement, label) => {
    let visibleCount = 0;
    tableBody.querySelectorAll("tr").forEach((row) => {
      const matchesStatus =
        row.dataset.accountStatus === selectedAccountStatus;
      const matchesSearch = !query || row.dataset.search.includes(query);
      const matches = matchesStatus && matchesSearch;
      row.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    emptyElement.hidden = visibleCount > 0;
    emptyElement.textContent = query
      ? `No ${statusLabel} ${label} accounts match this search.`
      : `No ${statusLabel} ${label} accounts have been added yet.`;
  };
  filterTable(accountsTableBody, accountsEmpty, "staff");
  filterTable(
    customerAccountsTableBody,
    customerAccountsEmpty,
    "registered customer",
  );
  updateAccountStatusTabs();
}

function refreshAccounts() {
  try {
    customerProfiles = readArrayStorage(
      CUSTOMER_PROFILES_KEY,
      "customer profiles",
    ).filter((profile) => profile && typeof profile === "object");
    if (ensureCustomerIds(customerProfiles)) {
      window.backendMemoryStorage.setItem(
        CUSTOMER_PROFILES_KEY,
        JSON.stringify(customerProfiles),
      );
    }
    const directoryStaff = readArrayStorage(
      STAFF_ACCOUNTS_KEY,
      "staff accounts",
    ).filter(
      (account) =>
        account &&
        typeof account === "object" &&
        typeof account.employeeId === "string",
    );
    const adminAccounts = readArrayStorage(
      ADMIN_USERS_KEY,
      "admin accounts",
    ).filter((account) => account && typeof account === "object");
    const needsAdminIdMigration = adminAccounts.some(
      (account) => !account.employeeId,
    );
    adminAccounts.forEach((admin) => {
      if (!admin.employeeId) {
        admin.employeeId = nextEmployeeId(
          "Admin",
          [...adminAccounts, ...directoryStaff],
        );
      }
    });
    if (needsAdminIdMigration) {
      window.backendMemoryStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(adminAccounts));
    }
    staffAccounts = [
      ...adminAccounts.map((admin, sourceIndex) => ({
        ...admin,
        name: getFullName(admin),
        role: "Admin",
        status: getStatus(admin),
        createdAt: admin.createdAt || admin.signedInAt,
        isAdminLogin: true,
        sourceIndex,
      })),
      ...directoryStaff.map((staff, sourceIndex) => ({
        ...staff,
        sourceIndex,
      })),
    ];
    accountsError.hidden = true;
    renderAccounts();
  } catch (error) {
    customerProfiles = [];
    staffAccounts = [];
    accountsTableBody.replaceChildren();
    customerAccountsTableBody.replaceChildren();
    accountsEmpty.hidden = true;
    customerAccountsEmpty.hidden = true;
    accountsError.textContent = `Accounts could not be loaded: ${error.message}`;
    accountsError.hidden = false;
  }
}

function isSignedInAdmin(email) {
  if (!email) return false;
  const savedSession = window.backendMemoryStorage.getItem(ADMIN_SESSION_KEY);
  if (!savedSession) return false;
  try {
    const session = JSON.parse(savedSession);
    return String(session.email || "").toLowerCase() === email.toLowerCase();
  } catch (error) {
    console.warn("Could not check the signed-in admin account.", error);
    return false;
  }
}

function showAccountDetails(account) {
  const details = document.getElementById("accountDetails");
  details.replaceChildren();
  let rows = [
    ["Account ID", account.id],
    ["Name", account.name],
    ["Email", account.email || "—"],
    ["Registered", account.registered],
    ["Status", account.status],
    ["Phone", account.account.phone || account.account.mobile || "—"],
  ];
  if (account.type !== "customer") {
    rows = window.arrayWithInserted(rows, 2, ["Role", account.role || "Staff"]);
  }
  rows.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value || "—";
    details.append(term, description);
  });
  accountViewDialog.showModal();
}

function updateStoredAccountStatus(account, isActive) {
  if (account.source === "admin" && isSignedInAdmin(account.sourceEmail)) {
    throw new Error("You cannot deactivate your signed-in admin account.");
  }

  const storageKey = {
    admin: ADMIN_USERS_KEY,
    staff: STAFF_ACCOUNTS_KEY,
    customer: CUSTOMER_PROFILES_KEY,
  }[account.source];
  if (!storageKey) throw new Error("This account type cannot be updated.");

  const records = readArrayStorage(storageKey, "accounts");
  const matchIndex = records.findIndex((record) => {
    if (!record || typeof record !== "object") return false;
    const recordIds = [
      record.employeeId,
      record.customerId,
      record.accountId,
      record.id,
    ].filter(Boolean).map(String);
    const matchesId = account.sourceId && recordIds.includes(String(account.sourceId));
    const matchesEmail =
      account.sourceEmail &&
      String(record.email || "").toLowerCase() === account.sourceEmail.toLowerCase();
    return matchesId || matchesEmail;
  });
  if (matchIndex < 0) {
    throw new Error("This account is no longer available. Refresh the directory and try again.");
  }

  records[matchIndex] = {
    ...records[matchIndex],
    status: isActive ? "Active" : "Inactive",
    accountStatus: isActive ? "Active" : "Inactive",
    isActive,
    active: isActive,
    isBanned: false,
    disabledByAdmin: !isActive,
    adminDisabled: !isActive,
    disabledBy: isActive ? null : "admin",
    disabledAt: isActive ? null : new Date().toISOString(),
  };
  window.backendMemoryStorage.setItem(storageKey, JSON.stringify(records));
}

function getCurrentAdmin() {
  const savedSession = window.backendMemoryStorage.getItem(ADMIN_SESSION_KEY);
  if (!savedSession) {
    throw new Error("Sign in to an administrator account to edit its profile.");
  }
  const session = JSON.parse(savedSession);
  const adminAccounts = readArrayStorage(ADMIN_USERS_KEY, "admin accounts");
  const adminIndex = adminAccounts.findIndex(
    (account) =>
      typeof account.email === "string" &&
      account.email.toLowerCase() === String(session.email || "").toLowerCase(),
  );
  if (adminIndex === -1) {
    throw new Error("The signed-in administrator account could not be found.");
  }
  return { session, adminAccounts, adminIndex, admin: adminAccounts[adminIndex] };
}

function populateAdminProfile() {
  const { session, admin } = getCurrentAdmin();
  document.getElementById("profileFirstName").value =
    admin.firstName || session.firstName || "";
  document.getElementById("profileLastName").value =
    admin.lastName || session.lastName || "";
  document.getElementById("profileEmail").value = admin.email || session.email || "";
  document.getElementById("profilePhone").value =
    admin.phone || admin.mobile || "";
  document.getElementById("profileEmployeeId").textContent =
    admin.employeeId || session.employeeId || "Not available";
  document.getElementById("profileCurrentPassword").value = "";
  document.getElementById("profileNewPassword").value = "";
  document.getElementById("profileFormMessage").textContent = "";
  document.getElementById("profileFormMessage").classList.remove("success");
  document.getElementById("saveProfileButton").disabled = false;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashAdminPassword(password, saltHex) {
  if (!window.crypto?.subtle) {
    throw new Error(
      "Secure password verification is unavailable. Open this admin system through localhost or HTTPS.",
    );
  }
  const salt = Uint8Array.from(
    saltHex.match(/.{2}/g) || [],
    (byte) => Number.parseInt(byte, 16),
  );
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

function makeAdminPasswordSalt() {
  if (!window.crypto?.getRandomValues) {
    throw new Error("Secure password generation is unavailable in this browser.");
  }
  return bytesToHex(window.crypto.getRandomValues(new Uint8Array(16)));
}

async function saveAdminProfile(event) {
  event.preventDefault();
  const form = document.getElementById("profileForm");
  const message = document.getElementById("profileFormMessage");
  const saveButton = document.getElementById("saveProfileButton");
  message.textContent = "";
  message.classList.remove("success");

  if (!form.reportValidity()) return;
  const firstName = document.getElementById("profileFirstName").value.trim();
  const lastName = document.getElementById("profileLastName").value.trim();
  const email = document.getElementById("profileEmail").value.trim().toLowerCase();
  const phone = document.getElementById("profilePhone").value.trim();
  const currentPassword = document.getElementById(
    "profileCurrentPassword",
  ).value;
  const newPassword = document.getElementById("profileNewPassword").value;
  if (!firstName || !lastName || !email) {
    message.textContent = "First name, last name, and admin email are required.";
    return;
  }
  if (newPassword && newPassword.length < 8) {
    message.textContent = "New password must be at least 8 characters.";
    return;
  }

  saveButton.disabled = true;
  try {
    const { session, adminAccounts, adminIndex, admin } = getCurrentAdmin();
    if (!admin.passwordSalt || !admin.passwordHash) {
      throw new Error("The admin account has no verifiable password credential.");
    }
    const currentPasswordHash = await hashAdminPassword(
      currentPassword,
      admin.passwordSalt,
    );
    if (currentPasswordHash !== admin.passwordHash) {
      message.textContent = "Current password is incorrect.";
      document.getElementById("profileCurrentPassword").focus();
      return;
    }
    const emailInUse = adminAccounts.some(
      (account, index) =>
        index !== adminIndex &&
        typeof account.email === "string" &&
        account.email.toLowerCase() === email,
    );
    if (emailInUse) {
      message.textContent = "Another admin account already uses this email.";
      document.getElementById("profileEmail").focus();
      return;
    }

    const updatedAdmin = {
      ...admin,
      firstName,
      lastName,
      email,
      phone,
      mobile: phone,
    };
    if (newPassword) {
      const passwordSalt = makeAdminPasswordSalt();
      updatedAdmin.passwordSalt = passwordSalt;
      updatedAdmin.passwordHash = await hashAdminPassword(
        newPassword,
        passwordSalt,
      );
    }
    adminAccounts[adminIndex] = updatedAdmin;
    const updatedSession = {
      ...session,
      firstName,
      lastName,
      email,
      phone,
      employeeId: updatedAdmin.employeeId || session.employeeId,
    };
    window.backendMemoryStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(adminAccounts));
    window.backendMemoryStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(updatedSession));
    if (
      window.backendMemoryStorage.getItem(ADMIN_REMEMBER_KEY)?.toLowerCase() ===
      String(session.email).toLowerCase()
    ) {
      window.backendMemoryStorage.setItem(ADMIN_REMEMBER_KEY, email);
    }

    message.textContent = "Your admin profile has been saved.";
    message.classList.add("success");
    document.getElementById("profileCurrentPassword").value = "";
    document.getElementById("profileNewPassword").value = "";
    document.getElementById("profileEmployeeId").textContent =
      updatedAdmin.employeeId || "Not available";
    accountsError.hidden = true;
    refreshAccounts();
  } catch (error) {
    message.textContent = `Could not save the admin profile: ${error.message}`;
  } finally {
    saveButton.disabled = false;
  }
}

function nextEmployeeId(role, accounts) {
  const prefixes = {
    Admin: "ACC-EMP",
    Cashier: "ACC-CSH",
    Warehouse: "ACC-WHS",
    Production: "ACC-PRD",
  };
  const prefix = prefixes[role];
  if (!prefix) throw new Error(`Unsupported employee role: ${role}`);
  const idPattern = new RegExp(`^${prefix}-(\\d+)$`);
  const highest = accounts.reduce((max, account) => {
    const match = idPattern.exec(account.employeeId || "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

function secureRandomBytes(length) {
  if (!window.crypto?.getRandomValues) {
    throw new Error("Secure credential generation is unavailable in this browser.");
  }
  return window.crypto.getRandomValues(new Uint8Array(length));
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = secureRandomBytes(14);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function hashTemporaryPassword(password) {
  if (!window.crypto?.subtle) {
    throw new Error(
      "Secure password hashing is unavailable. Open the admin system through localhost or HTTPS.",
    );
  }
  const salt = secureRandomBytes(16);
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
  return {
    passwordSalt: Array.from(salt, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    passwordHash: Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
  };
}

function updateStaffCredentialPreview() {
  const role = document.getElementById("staffRole").value;
  const employeeId = document.getElementById("staffEmployeeId");
  if (!role) {
    employeeId.textContent = "Select a role";
    return;
  }
  try {
    const allStaffAccounts = [
      ...staffAccounts,
      ...readArrayStorage(ADMIN_USERS_KEY, "admin accounts"),
    ];
    employeeId.textContent = nextEmployeeId(role, allStaffAccounts);
  } catch (error) {
    employeeId.textContent = "Unavailable";
    staffFormMessage.textContent = `Could not generate employee ID: ${error.message}`;
  }
}

function selectAccountStatus(status) {
  selectedAccountStatus = status;
  filterAccounts();
}

accountStatusTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    selectAccountStatus(tab.dataset.accountStatus);
  });
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      (index + direction + accountStatusTabs.length) %
      accountStatusTabs.length;
    const nextTab = accountStatusTabs[nextIndex];
    selectAccountStatus(nextTab.dataset.accountStatus);
    nextTab.focus();
  });
});

accountsSearch.addEventListener("input", filterAccounts);

function handleAccountAction(event) {
  const button = event.target.closest("button[data-account-action]");
  if (!button) return;
  const account = renderedAccounts.get(button.dataset.accountKey);
  if (!account) {
    accountsError.textContent = "This account is no longer available. Refresh the directory.";
    accountsError.hidden = false;
    return;
  }

  if (button.dataset.accountAction === "view") {
    showAccountDetails(account);
    return;
  }

  try {
    const isActivating = button.dataset.accountAction === "activate";
    updateStoredAccountStatus(account, isActivating);
    selectAccountStatus(isActivating ? "active" : "inactive");
    accountsError.hidden = true;
    refreshAccounts();
  } catch (error) {
    accountsError.textContent = `Could not update account status: ${error.message}`;
    accountsError.hidden = false;
  }
}

accountsTableBody.addEventListener("click", handleAccountAction);
customerAccountsTableBody.addEventListener("click", handleAccountAction);

document.getElementById("closeAccountView").addEventListener("click", () => {
  accountViewDialog.close();
});

document.getElementById("profileButton").addEventListener("click", () => {
  try {
    populateAdminProfile();
    profileDialog.showModal();
    document.getElementById("profileFirstName").focus();
  } catch (error) {
    accountsError.textContent = `Admin profile could not be loaded: ${error.message}`;
    accountsError.hidden = false;
  }
});

document.getElementById("profileForm").addEventListener("submit", saveAdminProfile);
document.getElementById("closeProfileDialog").addEventListener("click", () => {
  profileDialog.close();
});
document.getElementById("discardProfileButton").addEventListener("click", () => {
  profileDialog.close();
});
profileDialog.addEventListener("close", () => {
  document.getElementById("profileCurrentPassword").value = "";
  document.getElementById("profileNewPassword").value = "";
});

document.getElementById("createStaffButton").addEventListener("click", () => {
  staffForm.reset();
  document.getElementById("staffEmployeeId").textContent = "Select a role";
  staffFormMessage.textContent = "";
  staffFormMessage.classList.remove("success");
  try {
    document.getElementById("staffTemporaryPassword").value =
      generateTemporaryPassword();
  } catch (error) {
    document.getElementById("staffTemporaryPassword").value = "";
    staffFormMessage.textContent = `Could not generate a temporary password: ${error.message}`;
  }
  document.getElementById("saveStaffButton").disabled = false;
  document.getElementById("saveStaffButton").textContent = "Create Staff Account";
  document.getElementById("copyTemporaryPassword").textContent = "Copy";
  staffDialog.showModal();
  document.getElementById("staffFirstName").focus();
});

document.getElementById("staffRole").addEventListener(
  "change",
  updateStaffCredentialPreview,
);

document
  .getElementById("copyTemporaryPassword")
  .addEventListener("click", async () => {
    const password = document.getElementById("staffTemporaryPassword").value;
    try {
      await navigator.clipboard.writeText(password);
      document.getElementById("copyTemporaryPassword").textContent = "Copied";
    } catch (error) {
      const passwordInput = document.getElementById("staffTemporaryPassword");
      passwordInput.select();
      staffFormMessage.textContent =
        "Clipboard access is unavailable; the temporary password is selected for copying.";
      staffFormMessage.classList.remove("success");
      console.warn("Could not copy the temporary staff password.", error);
    }
  });

document.getElementById("closeStaffDialog").addEventListener("click", () => {
  staffDialog.close();
});
document.getElementById("cancelStaffButton").addEventListener("click", () => {
  staffDialog.close();
});
staffDialog.addEventListener("close", () => {
  document.getElementById("staffTemporaryPassword").value = "";
  staffForm.reset();
});

staffForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  staffFormMessage.textContent = "";
  const firstName = document.getElementById("staffFirstName").value.trim();
  const lastName = document.getElementById("staffLastName").value.trim();
  const name = `${firstName} ${lastName}`.trim();
  const email = document.getElementById("staffEmail").value.trim().toLowerCase();
  const role = document.getElementById("staffRole").value;
  const temporaryPassword = document.getElementById(
    "staffTemporaryPassword",
  ).value;

  if (!firstName || !lastName || !email || !STAFF_ROLES.includes(role)) {
    staffFormMessage.textContent =
      "Enter first and last names, a valid work email, and an account type.";
    return;
  }
  if (!staffForm.reportValidity()) return;
  if (!temporaryPassword) {
    staffFormMessage.textContent =
      "A secure temporary password could not be generated. Please close and reopen this form.";
    return;
  }

  const saveButton = document.getElementById("saveStaffButton");
  saveButton.disabled = true;
  try {
    const latestStaff = readArrayStorage(STAFF_ACCOUNTS_KEY, "staff accounts");
    const adminAccounts = readArrayStorage(ADMIN_USERS_KEY, "admin accounts");
    const emailInUse = [
      ...customerProfiles,
      ...latestStaff,
      ...adminAccounts,
    ].some(
      (account) =>
        typeof account.email === "string" &&
        account.email.toLowerCase() === email,
    );
    if (emailInUse) {
      staffFormMessage.textContent =
        "An account with this email address already exists.";
      saveButton.disabled = false;
      return;
    }

    const roleAccounts = [...latestStaff, ...adminAccounts];
    const staffAccount = {
      employeeId: nextEmployeeId(role, roleAccounts),
      firstName,
      lastName,
      name,
      email,
      role,
      status: "Active",
      createdAt: new Date().toISOString(),
      mustChangePassword: true,
      ...(await hashTemporaryPassword(temporaryPassword)),
    };
    document.getElementById("staffEmployeeId").textContent =
      staffAccount.employeeId;
    window.backendMemoryStorage.setItem(
      STAFF_ACCOUNTS_KEY,
      JSON.stringify([...latestStaff, staffAccount]),
    );
    refreshAccounts();
    staffFormMessage.textContent =
      `${staffAccount.employeeId} created. Copy and securely share the temporary password; it is shown only in this form.`;
    staffFormMessage.classList.add("success");
    saveButton.textContent = "Account Created";
    accountsSearch.value = "";
  } catch (error) {
    staffFormMessage.textContent = `Could not save staff directory entry: ${error.message}`;
    saveButton.disabled = false;
  }
});

window.addEventListener("storage", (event) => {
  if (
    event.key === CUSTOMER_PROFILES_KEY ||
    event.key === STAFF_ACCOUNTS_KEY ||
    event.key === ADMIN_USERS_KEY
  ) {
    refreshAccounts();
  }
});

refreshAccounts();
