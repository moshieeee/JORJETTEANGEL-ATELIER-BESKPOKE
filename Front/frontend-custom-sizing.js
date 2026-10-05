// Validate required measurements and enforce configured minimum/maximum limits.
window.validateCustomMeasurements = function (
  fields,
  measurements,
  container,
) {
  const missing = [];
  const errors = [];
  fields.forEach((field) => {
    const input = window.findArrayItem(
      Array.from(container.querySelectorAll("[data-custom-field]")),
      field.name,
      (element) => element.dataset.customField,
    );
    if (!input) return;
    const row = input.closest(".custom-measurement-row");
    const feedback = row.querySelector("[data-custom-feedback]");
    const rawValue = (measurements[field.name] || "").trim();
    const value = rawValue === "" ? NaN : Number(rawValue);
    const minimum = Number(field.minimum);
    const maximum = Number(field.maximum);
    const hasLimits =
      field.minimum !== "" &&
      field.maximum !== "" &&
      Number.isFinite(minimum) &&
      Number.isFinite(maximum);

    input.setCustomValidity("");
    feedback.classList.add("hidden");
    if (!rawValue) {
      missing.push(field.name);
      return;
    }
    if (!Number.isFinite(value)) {
      input.setCustomValidity("Enter a valid numeric measurement.");
      feedback.textContent = "Enter a valid numeric measurement.";
      feedback.classList.remove("hidden");
      errors.push({ field, input });
      return;
    }
    if (!hasLimits) return;

    if (value < minimum) {
      feedback.textContent = `This entry is below the valid minimum (${minimum} ${field.unit}). Please enter a correct measurement.`;
      feedback.classList.remove("hidden");
      input.setCustomValidity(feedback.textContent);
      errors.push({ field, input });
      return;
    }
    if (value > maximum) {
      feedback.textContent = `This entry exceeds the valid maximum (${maximum} ${field.unit}). Please enter a correct measurement.`;
      feedback.classList.remove("hidden");
      input.setCustomValidity(feedback.textContent);
      errors.push({ field, input });
      return;
    }
  });
  return { missing, errors };
};

