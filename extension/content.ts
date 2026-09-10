import {
  buildApplicationFillProposals,
  detectApplicationFields,
  isFillSafeField,
  type ApplicationBridgeSnapshot,
  type ApplicationFillProposal,
  type DetectedApplicationField,
} from "../src/lib/assisted-apply";

declare const chrome: {
  runtime: {
    sendMessage(message: unknown, callback?: (response: unknown) => void): Promise<unknown>;
    onMessage: {
      addListener(
        listener: (message: ExtensionMessage, sender: unknown, sendResponse: (response: unknown) => void) => void,
      ): void;
    };
  };
};

type ExtensionMessage = {
  protocol?: unknown;
  type?: unknown;
  nonce?: unknown;
  fields?: unknown;
  snapshot?: unknown;
  proposals?: unknown;
};

const PROTOCOL = "resume-fit-checker.assisted-apply.v1";
const appOrigins = new Set([
  "https://resume-fit-checker.pages.dev",
  "http://localhost:5173",
  "http://localhost:4174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4174",
]);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.protocol !== PROTOCOL) return;
  if (message.type === "SCAN") {
    const fields = detectApplicationFields(document);
    sendResponse({ ok: true, fields, proposals: [] });
    return;
  }
  if (message.type === "BUILD_PROPOSALS" && Array.isArray(message.fields) && isSafeSnapshot(message.snapshot)) {
    const fields = message.fields as DetectedApplicationField[];
    sendResponse({ ok: true, fields, proposals: buildApplicationFillProposals(fields, message.snapshot.profile) });
    return;
  }
  if (message.type === "BRIDGE_PROFILE_REQUEST" && appOrigins.has(window.location.origin)) {
    window.postMessage(
      { protocol: PROTOCOL, type: "BRIDGE_PROFILE_REQUEST", nonce: message.nonce },
      window.location.origin,
    );
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "FILL_SELECTED" && Array.isArray(message.proposals)) {
    const applied = message.proposals.filter((proposal: ApplicationFillProposal) => applyProposal(proposal));
    sendResponse({ ok: true, applied: applied.length });
  }
});

window.addEventListener("message", (event) => {
  if (event.source !== window || !appOrigins.has(event.origin) || event.data?.protocol !== PROTOCOL) return;
  if (event.data.type === "BRIDGE_READY") {
    void chrome.runtime.sendMessage({ type: "APP_BRIDGE_READY", nonce: event.data.nonce });
  }
  if (event.data.type === "BRIDGE_PROFILE_RESPONSE") {
    void chrome.runtime.sendMessage({
      type: "APP_BRIDGE_PROFILE",
      nonce: event.data.nonce,
      snapshot: event.data.snapshot,
    });
  }
});

function applyProposal(proposal: ApplicationFillProposal) {
  const element =
    document.getElementById(proposal.fieldId) || document.querySelector(`[name="${CSS.escape(proposal.fieldId)}"]`);
  if (!(
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ))
    return false;
  const field = {
    ...proposal,
    disabled: element.disabled,
    readOnly: "readOnly" in element ? element.readOnly : false,
    hidden: element.getClientRects().length === 0,
  };
  if (!isFillSafeField(field)) return false;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  setter?.call(element, proposal.value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function isSafeSnapshot(value: unknown): value is ApplicationBridgeSnapshot {
  return Boolean(
    value &&
    typeof value === "object" &&
    "profile" in value &&
    "answers" in value &&
    Array.isArray((value as ApplicationBridgeSnapshot).answers),
  );
}
