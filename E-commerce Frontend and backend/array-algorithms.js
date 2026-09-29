(function () {


  // Compare two values and return an ordering result for the search algorithms.
  function compareValues(first, second) {
    if (first < second) return -1;
    if (first > second) return 1;
    return 0;
  }


  // Bubble-sort a copy of the array so callers keep their original order.
  function bubbleSortArray(values, compare = compareValues) {
    if (!Array.isArray(values)) {
      throw new TypeError("Bubble sort requires an array.");
    }

    const sorted = [...values];
    for (let end = sorted.length - 1; end > 0; end -= 1) {
      let swapped = false;
      for (let index = 0; index < end; index += 1) {
        if (compare(sorted[index], sorted[index + 1]) > 0) {
          [sorted[index], sorted[index + 1]] = [
            sorted[index + 1],
            sorted[index],
          ];
          swapped = true;
        }
      }
      if (!swapped) break;
    }
    return sorted;
  }


  // Binary-search a sorted array and return the matching index, or -1.
  function binarySearchArray(
    sortedValues,
    target,
    getKey = (value) => value,
    compare = compareValues,
  ) {
    if (!Array.isArray(sortedValues)) {
      throw new TypeError("Binary search requires an array.");
    }

    let low = 0;
    let high = sortedValues.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const comparison = compare(getKey(sortedValues[middle]), target);
      if (comparison === 0) return middle;
      if (comparison < 0) {
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return -1;
  }


  // Find an item by key after sorting a copy and applying binary search.
  function findArrayItem(values, target, getKey, compare = compareValues) {
    if (target === null || target === undefined) return null;
    const sorted = bubbleSortArray(values, (first, second) =>
      compare(getKey(first), getKey(second)),
    );
    const index = binarySearchArray(sorted, target, getKey, compare);
    return index === -1 ? null : sorted[index];
  }


  // Find the original array index for a key-based binary-search match.
  function findArrayItemIndex(values, target, getKey, compare = compareValues) {
    if (target === null || target === undefined) return -1;
    const sorted = bubbleSortArray(values, (first, second) =>
      compare(getKey(first), getKey(second)),
    );
    const sortedIndex = binarySearchArray(sorted, target, getKey, compare);
    if (sortedIndex === -1) return -1;

    const matchedItem = sorted[sortedIndex];
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] === matchedItem) return index;
    }
    return -1;
  }

  window.bubbleSortArray = bubbleSortArray;
  window.binarySearchArray = binarySearchArray;
  window.findArrayItem = findArrayItem;
  window.findArrayItemIndex = findArrayItemIndex;
})();

