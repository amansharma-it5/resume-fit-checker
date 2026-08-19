import test from "node:test";
import assert from "node:assert/strict";
import {
  applyUserConfirmation,
  buildVerificationResult,
  canCopyOrApply,
  createSafeVerifiedVersion,
  deterministicVerify,
  removeClaimFromVerification,
} from "./rewrite-verification.js";

test("marks supported metrics as verified and copy/apply ready", () => {
  const result = buildVerificationResult({
    originalBullet: "Increased activation by 24% across 8 product squads.",
    rewrittenBullet: "Increased activation by 24% across 8 product squads.",
    factCheck: {
      claims: [
        { claim: "24% activation increase", status: "VERIFIED", evidence: "Increased activation by 24%", rationale: "" },
        { claim: "8 product squads", status: "VERIFIED", evidence: "8 product squads", rationale: "" },
      ],
    },
  });
  assert.equal(result.verificationStatus, "FACT_CHECKED");
  assert.equal(canCopyOrApply(result), true);
  assert.equal(result.verifiedClaims.length, 2);
});

test("reports unsupported metric and blocks copy/apply", () => {
  const result = buildVerificationResult({
    originalBullet: "Improved onboarding flows.",
    rewrittenBullet: "Improved onboarding flows by 31%.",
    factCheck: { claims: [{ claim: "31% improvement", status: "UNSUPPORTED", evidence: "", rationale: "No source metric." }] },
  });
  assert.equal(result.verificationStatus, "NEEDS_REVIEW");
  assert.equal(canCopyOrApply(result), false);
  assert.match(JSON.stringify(result.localVerification.differences), /31%/);
});

test("does not treat JD technology as candidate experience", () => {
  const differences = deterministicVerify({
    sourceText: "Built onboarding flows with React.",
    jdText: "Preferred: Python and AWS.",
    rewrittenBullet: "Built onboarding flows with React, Python, and AWS.",
  });
  assert.match(JSON.stringify(differences), /JD requirement appears as candidate experience/);
  assert.match(JSON.stringify(differences), /python/);
  assert.match(JSON.stringify(differences), /aws/);
});

test("safe verified version removes unsupported and unclear claims", () => {
  const safe = createSafeVerifiedVersion("Improved onboarding by 31% for Acme Inc.", [
    { text: "31%", status: "UNSUPPORTED" },
    { text: "Acme Inc", status: "UNCLEAR" },
  ]);
  assert.doesNotMatch(safe, /31%|Acme/i);
  assert.match(safe, /Improved onboarding/);
});

test("safe verified version cleans dangling conjunctions", () => {
  const safe = createSafeVerifiedVersion("Migrated 12 flows, improving quality and reducing defects.", [
    { text: "improving quality", status: "UNSUPPORTED" },
    { text: "reducing defects", status: "UNSUPPORTED" },
  ]);
  assert.doesNotMatch(safe, /and\./i);
});

test("user confirmation unblocks copy/apply for current verification object", () => {
  const result = buildVerificationResult({
    originalBullet: "Improved onboarding flows.",
    rewrittenBullet: "Improved onboarding flows by 31%.",
    factCheck: { claims: [{ claim: "31%", status: "UNSUPPORTED", evidence: "", rationale: "" }] },
  });
  assert.equal(canCopyOrApply(result), false);
  const confirmed = applyUserConfirmation(result, result.claims.find((claim) => claim.status === "UNSUPPORTED").id);
  assert.equal(confirmed.claims.some((claim) => claim.status === "USER CONFIRMED"), true);
  assert.equal(canCopyOrApply(confirmed), true);
});

test("removing an unsupported claim removes its text before copy/apply", () => {
  const result = buildVerificationResult({
    originalBullet: "Improved onboarding flows.",
    rewrittenBullet: "Improved onboarding flows by 31%.",
    factCheck: { claims: [{ claim: "31%", status: "UNSUPPORTED", evidence: "", rationale: "" }] },
  });
  const removed = removeClaimFromVerification(result, result.claims.find((claim) => claim.status === "UNSUPPORTED").id);
  assert.equal(canCopyOrApply(removed), true);
  assert.doesNotMatch(removed.rewrittenBullet, /31%/);
});

test("conflicting verified claim without exact source evidence becomes unclear", () => {
  const result = buildVerificationResult({
    originalBullet: "Managed 12 onboarding flows.",
    rewrittenBullet: "Managed 99 onboarding flows.",
    factCheck: { claims: [{ claim: "99 onboarding flows", status: "VERIFIED", evidence: "12 onboarding flows", rationale: "" }] },
  });
  assert.equal(result.verificationStatus, "NEEDS_REVIEW");
  assert.equal(result.unclearClaims.length + result.unsupportedClaims.length > 0, true);
});
