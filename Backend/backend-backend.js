// Provides non-mutating array helpers and manual sorting.

(function () {
  const memoryHost = window.top;
  const memoryKey = "__jorjetteangelBackendMemory";
  if (!Array.isArray(memoryHost[memoryKey])) {
    memoryHost[memoryKey] = [];
  }

  function notifyStorageChange(key, oldValue, newValue) {
    memoryHost.setTimeout(() => {
      function notify(windowTarget) {
        windowTarget.dispatchEvent(
          new windowTarget.StorageEvent("storage", {
            key,
            oldValue,
            newValue,
          }),
        );
        let frameIndex = 0;
        while (frameIndex < windowTarget.frames.length) {
          notify(windowTarget.frames[frameIndex]);
          frameIndex += 1;
        }
      }
      notify(memoryHost);
    }, 0);
  }

  const memoryStore = {
    getItem(key) {
      const normalizedKey = String(key);
      const entries = memoryHost[memoryKey];
      let index = 0;
      while (index < entries.length) {
        if (entries[index][0] === normalizedKey) return entries[index][1];
        index += 1;
      }
      return null;
    },
    setItem(key, value) {
      const normalizedKey = String(key);
      const normalizedValue = String(value);
      const entries = memoryHost[memoryKey];
      let index = 0;
      while (index < entries.length) {
        if (entries[index][0] === normalizedKey) {
          const oldValue = entries[index][1];
          memoryHost[memoryKey] = entries
            .slice(0, index)
            .concat([[normalizedKey, normalizedValue]], entries.slice(index + 1));
          notifyStorageChange(normalizedKey, oldValue, normalizedValue);
          return;
        }
        index += 1;
      }
      memoryHost[memoryKey] = entries.concat([[normalizedKey, normalizedValue]]);
      notifyStorageChange(normalizedKey, null, normalizedValue);
    },
    removeItem(key) {
      const normalizedKey = String(key);
      const entries = memoryHost[memoryKey];
      let index = 0;
      while (index < entries.length) {
        if (entries[index][0] === normalizedKey) {
          const oldValue = entries[index][1];
          memoryHost[memoryKey] = entries
            .slice(0, index)
            .concat(entries.slice(index + 1));
          notifyStorageChange(normalizedKey, oldValue, null);
          return;
        }
        index += 1;
      }
    },
  };

  window.backendMemoryStorage = memoryStore;

  function compareStrings(first, second) {
    const firstValue = String(first);
    const secondValue = String(second);
    if (firstValue < secondValue) return -1;
    if (firstValue > secondValue) return 1;
    return 0;
  }

  function manualSortArray(values, compare = compareStrings) {
    const length = values.length;
    let source = values.slice();
    let target = new Array(length);

    for (let width = 1; width < length; width *= 2) {
      for (let start = 0; start < length; start += width * 2) {
        const middle = Math.min(start + width, length);
        const end = Math.min(start + width * 2, length);
        let left = start;
        let right = middle;
        let output = start;

        while (left < middle && right < end) {
          const result = compare(source[left], source[right]);
          if (result <= 0 || Number.isNaN(result)) {
            target[output] = source[left];
            left += 1;
          } else {
            target[output] = source[right];
            right += 1;
          }
          output += 1;
        }

        while (left < middle) {
          target[output] = source[left];
          left += 1;
          output += 1;
        }
        while (right < end) {
          target[output] = source[right];
          right += 1;
          output += 1;
        }
      }

      const previousSource = source;
      source = target;
      target = previousSource;
    }

    return source;
  }

  function arrayWithAppended(values, ...items) {
    return values.concat(items);
  }

  function arrayWithPrepended(values, ...items) {
    return items.concat(values);
  }

  function arrayWithoutRange(values, start, deleteCount = 1) {
    const length = values.length;
    const numericStart = Number(start);
    const normalizedStart = Number.isNaN(numericStart)
      ? 0
      : numericStart < 0
        ? Math.max(length + Math.trunc(numericStart), 0)
        : Math.min(Math.trunc(numericStart), length);
    const numericDeleteCount = Number(deleteCount);
    const normalizedDeleteCount = Number.isNaN(numericDeleteCount)
      ? 0
      : Math.min(Math.max(Math.trunc(numericDeleteCount), 0), length - normalizedStart);
    return values
      .slice(0, normalizedStart)
      .concat(values.slice(normalizedStart + normalizedDeleteCount));
  }

  function arrayWithInserted(values, start, ...items) {
    const length = values.length;
    const numericStart = Number(start);
    const normalizedStart = Number.isNaN(numericStart)
      ? 0
      : numericStart < 0
        ? Math.max(length + Math.trunc(numericStart), 0)
        : Math.min(Math.trunc(numericStart), length);
    return values
      .slice(0, normalizedStart)
      .concat(items, values.slice(normalizedStart));
  }

  function arrayWithoutLast(values) {
    return values.slice(0, -1);
  }

  function arrayWithoutFirst(values) {
    return values.slice(1);
  }

  window.manualSortArray = manualSortArray;
  window.arrayWithAppended = arrayWithAppended;
  window.arrayWithPrepended = arrayWithPrepended;
  window.arrayWithoutRange = arrayWithoutRange;
  window.arrayWithInserted = arrayWithInserted;
  window.arrayWithoutLast = arrayWithoutLast;
  window.arrayWithoutFirst = arrayWithoutFirst;
})();
