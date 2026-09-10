const fieldsElement = document.querySelector("#fields");
const fillButton = document.querySelector("#fill");
const statusElement = document.querySelector("#status");
let proposals = [];

document.querySelector("#connect").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CONNECT_APP" });
  statusElement.textContent = "Application Prep opened. Enable the bridge there, then scan this page.";
});
document.querySelector("#scan").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "SCAN_ACTIVE" });
  renderScan(result);
});
fillButton.addEventListener("click", async () => {
  const selectedIds = new Set(
    Array.from(fieldsElement.querySelectorAll("input:checked"), (input) => input.getAttribute("data-field-id")),
  );
  const selected = proposals.filter((proposal) => selectedIds.has(proposal.fieldId));
  const result = await chrome.runtime.sendMessage({ type: "FILL_SELECTED", proposals: selected });
  statusElement.textContent = result?.ok
    ? "Selected fields filled. Review the page before continuing."
    : "Nothing was filled; review the page and try again.";
});
document.querySelector("#cancel").addEventListener("click", () => window.close());

chrome.runtime.sendMessage({ type: "GET_BRIDGE_STATE" }).then((state) => {
  document.querySelector("#site").textContent = `Current site: ${state?.domain || "not connected"}`;
});

function renderScan(result) {
  fieldsElement.replaceChildren();
  proposals = result?.proposals || [];
  if (!result?.ok) {
    statusElement.textContent =
      result?.error === "UNSUPPORTED_PAGE" ? "This page cannot be scanned." : "No fields were detected.";
    fillButton.disabled = true;
    return;
  }
  result.fields.forEach((field) => {
    const item = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.fieldId = field.fieldId;
    checkbox.disabled = !proposals.some((proposal) => proposal.fieldId === field.fieldId);
    checkbox.addEventListener("change", updateFillState);
    const copy = document.createElement("span");
    copy.textContent = field.label || field.fieldId;
    const meta = document.createElement("small");
    meta.textContent = `${field.mappingStatus.replace("_", " ")}${field.normalizedIntent ? ` · ${field.normalizedIntent}` : ""}`;
    copy.append(meta);
    const proposal = proposals.find((item) => item.fieldId === field.fieldId);
    if (proposal) {
      const proposedValue = document.createElement("small");
      proposedValue.textContent = `Proposed: ${proposal.value}`;
      copy.append(proposedValue);
    }
    label.append(checkbox, copy);
    item.append(label);
    fieldsElement.append(item);
  });
  statusElement.textContent = `${result.fields.length} fields detected. Review each proposal before filling.`;
  updateFillState();
}

function updateFillState() {
  fillButton.disabled = !fieldsElement.querySelector("input:checked");
}
