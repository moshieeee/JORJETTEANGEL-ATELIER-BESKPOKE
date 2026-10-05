// Manages system settings.

(() => {
  const SETTINGS_KEY = "jorjetteangel-system-settings";
  const form = document.querySelector("#settings-form");
  const feedback = document.querySelector("#settings-feedback");
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-panel]"));

  const defaults = {
    businessName: "JorjetteAngel Atelier",
    taxId: "000-123-456-000",
    contactNumber: "+63 917 123 4567",
    officialEmail: "admin@jorjetteangel.com",
    street: "123 Fashion Blvd",
    cityProvince: "Malolos, Bulacan",
    postalCode: "3000",
    vatEnabled: true,
    vatRate: 12,
    rawMaterialThreshold: 15,
    finishedGoodsThreshold: 5,
    inventoryEditAlertValue: 5000,
    failedLoginLimit: 3,
    emailCriticalAlerts: true,
  };

  function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = "settings-feedback" + (type ? " " + type : "");
  }

  function loadSettings() {
    let saved;
    try {
      const raw = window.backendMemoryStorage.getItem(SETTINGS_KEY);
      saved = raw === null ? {} : JSON.parse(raw);
    } catch (error) {
      console.error("Could not load saved system settings.", error);
      showFeedback("Saved settings could not be read. Correct or clear the stored settings before saving.", "error");
      saved = {};
    }
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      showFeedback("Saved settings have an invalid format.", "error");
      saved = {};
    }

    const settings = { ...defaults, ...saved };
    Object.keys(settings).forEach((name) => {
      const input = form.elements.namedItem(name);
      if (!input) return;
      if (input.type === "checkbox") {
        input.checked = settings[name] === true;
      } else {
        input.value = settings[name] == null ? "" : String(settings[name]);
      }
    });
  }

  function activateTab(tab) {
    const target = tab.dataset.tab;
    tabs.forEach((candidate) => {
      const active = candidate === tab;
      candidate.classList.toggle("active", active);
      candidate.setAttribute("aria-selected", String(active));
      candidate.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== target;
    });
  }

  function readFormSettings() {
    const settings = {};
    Object.keys(defaults).forEach((name) => {
      const input = form.elements.namedItem(name);
      if (input.type === "checkbox") {
        settings[name] = input.checked;
      } else if (input.type === "number") {
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < Number(input.min) || value > Number(input.max || 100)) {
          throw new Error("Enter a valid value for " + name + ".");
        }
        settings[name] = value;
      } else {
        settings[name] = input.value.trim();
      }
    });

    if (!settings.businessName) {
      throw new Error("Business name is required.");
    }
    if (settings.officialEmail && !form.elements.namedItem("officialEmail").validity.valid) {
      throw new Error("Enter a valid official email address.");
    }
    return settings;
  }

  function saveSettings(event) {
    event.preventDefault();
    try {
      const settings = readFormSettings();
      window.backendMemoryStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      window.dispatchEvent(
        new CustomEvent("systemSettingsUpdated", { detail: settings }),
      );
      showFeedback("Settings saved in this browser.", "success");
    } catch (error) {
      console.error("Could not save system settings.", error);
      showFeedback(error instanceof Error ? error.message : "Settings could not be saved.", "error");
    }
  }

  tabs.forEach((tab, index) => {
    tab.tabIndex = index === 0 ? 0 : -1;
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (tabs.indexOf(tab) + direction + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      activateTab(tabs[nextIndex]);
    });
  });

  form.addEventListener("submit", saveSettings);
  document.querySelector("#discard-settings").addEventListener("click", () => {
    loadSettings();
    showFeedback("Unsaved changes were discarded.");
  });
  loadSettings();
})();
