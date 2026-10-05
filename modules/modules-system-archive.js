// Stores shared archive and restore data.

(() => {
  const STORAGE_KEY = "jorjetteangel-system-archive";
  const RESTORED_STORAGE_KEY = "jorjetteangel-system-restored-records";

  function readRecords(storageKey, message) {
    const raw = window.backendMemoryStorage.getItem(storageKey);
    const records = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(records)) {
      throw new Error(message);
    }
    return records;
  }

  function writeRecords(storageKey, records) {
    window.backendMemoryStorage.setItem(storageKey, JSON.stringify(records));
  }

  const api = {
    getAll() {
      return readRecords(
        STORAGE_KEY,
        "Saved system archive data must be an array.",
      );
    },
    getRestored(type) {
      return readRecords(
        RESTORED_STORAGE_KEY,
        "Saved restored records data must be an array.",
      )
        .filter((entry) => entry && entry.type === type)
        .map((entry) => entry.record);
    },
    isArchived(type, recordId) {
      return this.getAll().some(
        (entry) =>
          entry &&
          entry.type === type &&
          String(entry.recordId) === String(recordId),
      );
    },
    archive(type, recordId, label, detail, record) {
      if (!type || recordId == null || String(recordId) === "") {
        throw new Error("The record needs a valid identifier before archiving.");
      }
      let entries = this.getAll();
      const duplicate = entries.some(
        (entry) =>
          entry &&
          entry.type === type &&
          String(entry.recordId) === String(recordId),
      );
      const restored = readRecords(
        RESTORED_STORAGE_KEY,
        "Saved restored records data must be an array.",
      ).filter(
        (entry) =>
          !entry ||
          entry.type !== type ||
          String(entry.recordId) !== String(recordId),
      );
      writeRecords(RESTORED_STORAGE_KEY, restored);
      if (!duplicate) {
        entries = window.arrayWithPrepended(entries, {
          id: type + "::" + String(recordId),
          type,
          recordId: String(recordId),
          label: String(label || type),
          detail: String(detail || ""),
          archivedAt: new Date().toISOString(),
          record: JSON.parse(JSON.stringify(record)),
        });
        writeRecords(STORAGE_KEY, entries);
      }
      window.dispatchEvent(new CustomEvent("systemArchiveChanged"));
    },
    restore(id) {
      const entries = this.getAll();
      const restoredEntry = entries.find((entry) => entry && entry.id === id);
      if (!restoredEntry) {
        throw new Error("The archived record is no longer available.");
      }
      let restored = readRecords(
        RESTORED_STORAGE_KEY,
        "Saved restored records data must be an array.",
      ).filter(
        (entry) =>
          !entry ||
          entry.type !== restoredEntry.type ||
          String(entry.recordId) !== String(restoredEntry.recordId),
      );
      restored = window.arrayWithPrepended(restored, restoredEntry);
      writeRecords(RESTORED_STORAGE_KEY, restored);
      const remaining = entries.filter((entry) => entry && entry.id !== id);
      writeRecords(STORAGE_KEY, remaining);
      window.dispatchEvent(new CustomEvent("systemArchiveChanged"));
    },
  };
  window.systemArchive = api;
})();
