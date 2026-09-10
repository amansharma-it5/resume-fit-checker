const APP_ORIGINS = new Set([
  "https://resume-fit-checker.pages.dev",
  "http://localhost:5173",
  "http://localhost:4174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4174",
]);
const PROTOCOL = "resume-fit-checker.assisted-apply.v1";
let bridge = { tabId: null, nonce: null, snapshot: null };

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return undefined;
  if (message.type === "CONNECT_APP") {
    chrome.tabs.create({ url: "https://resume-fit-checker.pages.dev/profile#assisted-apply" });
    sendResponse({ ok: true });
    return true;
  }
  if (
    message.type === "APP_BRIDGE_READY" &&
    sender.tab?.id &&
    isAllowedAppUrl(sender.tab.url) &&
    typeof message.nonce === "string"
  ) {
    bridge = { tabId: sender.tab.id, nonce: message.nonce.slice(0, 120), snapshot: null };
    chrome.tabs.sendMessage(sender.tab.id, { protocol: PROTOCOL, type: "BRIDGE_PROFILE_REQUEST", nonce: bridge.nonce });
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "APP_BRIDGE_PROFILE" && sender.tab?.id === bridge.tabId && isAllowedAppUrl(sender.tab.url)) {
    if (message.nonce !== bridge.nonce || !isSafeSnapshot(message.snapshot)) {
      sendResponse({ ok: false, error: "BRIDGE_REJECTED" });
      return true;
    }
    bridge.snapshot = message.snapshot;
    sendResponse({ ok: true, connected: true });
    return true;
  }
  if (message.type === "GET_BRIDGE_STATE") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse({ connected: Boolean(bridge.snapshot), domain: safeDisplayDomain(tab?.url) });
    });
    return true;
  }
  if (message.type === "SCAN_ACTIVE") {
    scanActiveTab().then(sendResponse);
    return true;
  }
  if (message.type === "FILL_SELECTED") {
    if (!Array.isArray(message.proposals) || message.proposals.length > 50) {
      sendResponse({ ok: false, error: "INVALID_SELECTION" });
      return true;
    }
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id) return sendResponse({ ok: false, error: "NO_ACTIVE_TAB" });
      chrome.tabs.sendMessage(tab.id, { protocol: PROTOCOL, type: "FILL_SELECTED", proposals: message.proposals }).then(
        () => sendResponse({ ok: true }),
        () => sendResponse({ ok: false, error: "PAGE_UNAVAILABLE" }),
      );
    });
    return true;
  }
  return undefined;
});

async function scanActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let pageUrl;
  try {
    pageUrl = new URL(tab?.url || "");
  } catch {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  if (!tab?.id || !/^https?:$/.test(pageUrl.protocol)) return { ok: false, error: "UNSUPPORTED_PAGE" };
  let scan = await sendTabMessage(tab.id, { protocol: PROTOCOL, type: "SCAN" });
  if (!scan?.ok) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    scan = await sendTabMessage(tab.id, { protocol: PROTOCOL, type: "SCAN" });
  }
  scan ||= { ok: false, error: "PAGE_UNAVAILABLE" };
  if (!scan?.ok || !bridge.snapshot) return scan;
  return (
    (await sendTabMessage(tab.id, {
      protocol: PROTOCOL,
      type: "BUILD_PROPOSALS",
      fields: scan.fields,
      snapshot: bridge.snapshot,
    })) || scan
  );
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => resolve(response));
  });
}

function isAllowedAppUrl(url) {
  try {
    return APP_ORIGINS.has(new URL(url || "").origin);
  } catch {
    return false;
  }
}

function safeDisplayDomain(url) {
  try {
    const parsed = new URL(url || "");
    return /^https?:$/.test(parsed.protocol) ? parsed.host : null;
  } catch {
    return null;
  }
}

function isSafeSnapshot(snapshot) {
  return Boolean(
    snapshot &&
    typeof snapshot === "object" &&
    snapshot.profile &&
    Array.isArray(snapshot.answers) &&
    JSON.stringify(snapshot).length <= 120000,
  );
}
