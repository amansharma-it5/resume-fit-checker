import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const protocol = "resume-fit-checker.assisted-apply.v1";

test("fixture previews supported fields and fills only after explicit confirmation", async ({ page }) => {
  await page.setContent(`<form id="fixture">
    <label for="email">Work email</label><input id="email" autocomplete="email">
    <label for="location">Current location</label><input id="location">
    <label for="password">Password</label><input id="password" type="password">
    <label for="certify">I certify this information is true</label><input id="certify" type="checkbox">
    <button id="submit" type="submit">Submit application</button>
  </form>`);
  await page.evaluate(() => {
    Object.defineProperty(window, "__assistedListeners", { value: [], configurable: true, writable: true });
    const runtime = {
      onMessage: { addListener: (listener) => window.__assistedListeners.push(listener) },
      sendMessage: () => Promise.resolve(),
    };
    Object.defineProperty(window, "chrome", { value: { runtime }, configurable: true, writable: true });
  });
  await page.addScriptTag({ path: resolve("dist-extension/content.js") });

  const scanned = await page.evaluate(
    ({ protocol }) => new Promise((resolve) => window.__assistedListeners[0]({ protocol, type: "SCAN" }, {}, resolve)),
    { protocol },
  );
  expect(scanned).toMatchObject({ ok: true });
  expect(scanned.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ fieldId: "email", mappingStatus: "matched", normalizedIntent: "email" }),
      expect.objectContaining({ fieldId: "location", mappingStatus: "needs_review" }),
      expect.objectContaining({ fieldId: "password", mappingStatus: "manual_only" }),
      expect.objectContaining({ fieldId: "certify", mappingStatus: "manual_only" }),
    ]),
  );

  const before = await page.locator("#email").inputValue();
  expect(before).toBe("");
  const built = await page.evaluate(
    ({ protocol, fields }) =>
      new Promise((resolve) =>
        window.__assistedListeners[0](
          {
            protocol,
            type: "BUILD_PROPOSALS",
            fields,
            snapshot: { profile: { email: "sam@example.test" }, answers: [] },
          },
          {},
          resolve,
        ),
      ),
    { protocol, fields: scanned.fields },
  );
  expect(built.proposals).toEqual([expect.objectContaining({ fieldId: "email", value: "sam@example.test" })]);

  await page.evaluate(
    ({ protocol, proposals }) =>
      new Promise((resolve) =>
        window.__assistedListeners[0]({ protocol, type: "FILL_SELECTED", proposals }, {}, resolve),
      ),
    { protocol, proposals: built.proposals },
  );
  await expect(page.locator("#email")).toHaveValue("sam@example.test");
  await expect(page.locator("#password")).toHaveValue("");
  await expect(page.locator("#certify")).not.toBeChecked();
  await expect(page.locator("#submit")).toBeVisible();
});
