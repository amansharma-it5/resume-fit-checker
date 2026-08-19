const CLAIM_STATUSES = {
  VERIFIED: "VERIFIED",
  UNSUPPORTED: "UNSUPPORTED",
  UNCLEAR: "UNCLEAR",
  USER_CONFIRMED: "USER CONFIRMED",
};

const TECHNOLOGY_TERMS = [
  "react", "sql", "aws", "python", "javascript", "typescript", "node", "node.js", "java", "kubernetes",
  "docker", "terraform", "azure", "gcp", "postgresql", "mysql", "mongodb", "redis", "graphql", "rest",
  "salesforce", "tableau", "power bi", "excel", "snowflake", "databricks", "spark", "pandas",
];

const CERTIFICATION_PATTERN = /\b(?:aws|azure|google|gcp|pmp|cissp|cisa|cism|scrum|safe|comptia|ccna|cfa|cpa|shrm)[\w\s-]{0,50}\b(?:certified|certification|certificate|professional|associate|practitioner|architect|administrator)?/gi;
const DEGREE_PATTERN = /\b(?:bachelor(?:'s)?|master(?:'s)?|ph\.?d\.?|mba|b\.s\.|m\.s\.|ba|bs|ma|ms)\s+(?:degree\s+)?(?:in\s+[a-z][a-z\s-]{2,40})?/gi;

function buildVerificationResult({ originalBullet = "", approvedContext = "", jdExcerpt = "", rewrittenBullet = "", factCheck = {} }) {
  const sourceText = clean(`${originalBullet}\n${approvedContext}`);
  const jdText = clean(jdExcerpt);
  const claims = normalizeClaims(factCheck.claims);
  const localDifferences = deterministicVerify({ sourceText, jdText, rewrittenBullet });
  const mergedClaims = reconcileClaims({ claims, sourceText, localDifferences });
  const counts = countClaims(mergedClaims);
  const hasUnresolved = mergedClaims.some((claim) => claim.status === CLAIM_STATUSES.UNSUPPORTED || claim.status === CLAIM_STATUSES.UNCLEAR);
  return {
    rewrittenBullet,
    verificationStatus: hasUnresolved ? "NEEDS_REVIEW" : "FACT_CHECKED",
    notice: "AI verification can make mistakes. Final accuracy depends on the information you provide and confirm.",
    claims: mergedClaims,
    verifiedClaims: mergedClaims.filter((claim) => claim.status === CLAIM_STATUSES.VERIFIED),
    unsupportedClaims: mergedClaims.filter((claim) => claim.status === CLAIM_STATUSES.UNSUPPORTED),
    unclearClaims: mergedClaims.filter((claim) => claim.status === CLAIM_STATUSES.UNCLEAR),
    localVerification: {
      differences: localDifferences,
      checkedTypes: ["numbers", "percentages", "currency", "dates", "durations", "employers", "clients", "degrees", "certifications", "technologies"],
    },
    canCopyApply: !hasUnresolved,
    safeVerifiedBullet: createSafeVerifiedVersion(rewrittenBullet, mergedClaims),
    counts,
  };
}

function deterministicVerify({ sourceText = "", jdText = "", rewrittenBullet = "" }) {
  const sourceFacts = extractFactualClaims(sourceText);
  const jdFacts = extractFactualClaims(jdText);
  const outputFacts = extractFactualClaims(rewrittenBullet);
  const differences = [];
  for (const fact of outputFacts) {
    const inSource = hasFact(sourceFacts, fact);
    const inJdOnly = hasFact(jdFacts, fact) && !inSource;
    if (!inSource) {
      differences.push({
        type: fact.type,
        value: fact.value,
        status: CLAIM_STATUSES.UNSUPPORTED,
        reason: inJdOnly ? "JD requirement appears as candidate experience" : "Not found in selected text or approved context",
      });
    }
  }
  return uniqueDifferences(differences);
}

function normalizeClaims(rawClaims) {
  if (!Array.isArray(rawClaims)) return [];
  return rawClaims.map((claim, index) => {
    const status = normalizeStatus(claim?.status);
    return {
      id: `claim-${index + 1}`,
      text: clean(claim?.claim || claim?.text || ""),
      status,
      evidence: clean(claim?.evidence || ""),
      rationale: clean(claim?.rationale || claim?.reason || ""),
    };
  }).filter((claim) => claim.text);
}

function reconcileClaims({ claims, sourceText, localDifferences }) {
  const sourceNormalized = normalize(sourceText);
  const reconciled = claims.map((claim) => {
    if (claim.status === CLAIM_STATUSES.VERIFIED && (!claim.evidence || !sourceNormalized.includes(normalize(claim.evidence)))) {
      return { ...claim, status: CLAIM_STATUSES.UNCLEAR, rationale: claim.rationale || "Verified claim did not include exact source evidence." };
    }
    return claim;
  });

  for (const difference of localDifferences) {
    const matching = reconciled.find((claim) => normalize(claim.text).includes(normalize(difference.value)));
    if (matching) {
      if (matching.status === CLAIM_STATUSES.VERIFIED) {
        matching.status = CLAIM_STATUSES.UNSUPPORTED;
        matching.rationale = difference.reason;
      }
    } else {
      reconciled.push({
        id: `local-${reconciled.length + 1}`,
        text: difference.value,
        status: CLAIM_STATUSES.UNSUPPORTED,
        evidence: "",
        rationale: difference.reason,
      });
    }
  }
  return reconciled;
}

function applyUserConfirmation(verification, claimId) {
  return mapClaims(verification, (claim) => claim.id === claimId ? { ...claim, status: CLAIM_STATUSES.USER_CONFIRMED } : claim);
}

function removeClaimFromVerification(verification, claimId) {
  const target = (verification?.claims || []).find((claim) => claim.id === claimId);
  const rewrittenBullet = target?.text
    ? createSafeVerifiedVersion(verification?.rewrittenBullet || "", [{ ...target, status: CLAIM_STATUSES.UNSUPPORTED }])
    : verification?.rewrittenBullet || "";
  return mapClaims({ ...verification, rewrittenBullet }, (claim) => claim.id === claimId ? { ...claim, status: CLAIM_STATUSES.UNSUPPORTED, removed: true } : claim);
}

function mapClaims(verification, mapper) {
  const claims = (verification?.claims || []).map(mapper).filter((claim) => !claim.removed);
  const hasUnresolved = claims.some((claim) => claim.status === CLAIM_STATUSES.UNSUPPORTED || claim.status === CLAIM_STATUSES.UNCLEAR);
  return {
    ...verification,
    claims,
    verifiedClaims: claims.filter((claim) => claim.status === CLAIM_STATUSES.VERIFIED),
    unsupportedClaims: claims.filter((claim) => claim.status === CLAIM_STATUSES.UNSUPPORTED),
    unclearClaims: claims.filter((claim) => claim.status === CLAIM_STATUSES.UNCLEAR),
    verificationStatus: hasUnresolved ? "NEEDS_REVIEW" : "FACT_CHECKED",
    canCopyApply: !hasUnresolved,
    safeVerifiedBullet: createSafeVerifiedVersion(verification?.rewrittenBullet || "", claims),
    counts: countClaims(claims),
  };
}

function createSafeVerifiedVersion(rewrittenBullet = "", claims = []) {
  let safe = clean(rewrittenBullet);
  const removable = claims.filter((claim) => claim.status === CLAIM_STATUSES.UNSUPPORTED || claim.status === CLAIM_STATUSES.UNCLEAR);
  for (const claim of removable) {
    const target = clean(claim.text);
    if (!target) continue;
    safe = safe.replace(new RegExp(escapeRegExp(target), "gi"), "").replace(/\s+([,.;:])/g, "$1");
  }
  return clean(safe.replace(/\s{2,}/g, " ").replace(/\s*,\s*(?:\.|$)/g, "."));
}

function canCopyOrApply(verification) {
  return Boolean(verification?.canCopyApply);
}

function countClaims(claims) {
  return {
    verified: claims.filter((claim) => claim.status === CLAIM_STATUSES.VERIFIED).length,
    userConfirmed: claims.filter((claim) => claim.status === CLAIM_STATUSES.USER_CONFIRMED).length,
    unsupported: claims.filter((claim) => claim.status === CLAIM_STATUSES.UNSUPPORTED).length,
    unclear: claims.filter((claim) => claim.status === CLAIM_STATUSES.UNCLEAR).length,
  };
}

function extractFactualClaims(text) {
  const cleanText = stripPlaceholders(text);
  const facts = [];
  collect(cleanText, /[$€£]\s?\d[\d,.]*(?:\s?[kmb])?|\b(?:usd|eur|gbp)\s?\d[\d,.]*(?:\s?[kmb])?/gi, "currency", facts);
  collect(cleanText, /\b\d+(?:\.\d+)?\s?%/g, "percentage", facts);
  collect(cleanText, /\b\d+(?:\.\d+)?\+?\s+(?:years?|yrs?|months?|mos?)\b/gi, "duration", facts);
  collect(cleanText, /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi, "date", facts);
  collect(cleanText, /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(?:19|20)\d{2}\b/gi, "date", facts);
  collect(cleanText, /\bq[1-4]\s+(?:19|20)\d{2}\b/gi, "date", facts);
  collect(cleanText, /\b(?:19|20)\d{2}\b/g, "date", facts);
  collect(cleanText, /\b\d[\d,]*(?:\.\d+)?\+?\b/g, "number", facts);
  collect(cleanText, DEGREE_PATTERN, "degree", facts);
  collect(cleanText, CERTIFICATION_PATTERN, "certification", facts);
  collectEmployerClientFacts(cleanText, facts);
  collectTechnologies(cleanText, facts);
  return uniqueFacts(facts);
}

function collect(text, pattern, type, facts) {
  for (const match of text.matchAll(pattern)) facts.push({ type, value: clean(match[0]) });
}

function collectTechnologies(text, facts) {
  const normalizedText = normalize(text);
  for (const term of TECHNOLOGY_TERMS) {
    if (new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(normalizedText)) facts.push({ type: "technology", value: term });
  }
}

function collectEmployerClientFacts(text, facts) {
  const suffixPattern = /\b(?:[A-Z][a-zA-Z&.-]{1,}|[A-Z]{2,})(?:\s+(?:[A-Z][a-zA-Z&.-]{1,}|[A-Z]{2,})){0,3}\s+(?:inc|llc|ltd|corp(?:oration)?|company|co|group|bank|university|hospital|systems|technologies|labs|partners|consulting|agency)\b/gi;
  collect(text, suffixPattern, "employer_client", facts);
  const contextPattern = /\b(?:at|for|with|client|customer|employer|account)\s+((?:[A-Z][a-zA-Z&.-]{1,}|[A-Z]{2,})(?:\s+(?:[A-Z][a-zA-Z&.-]{1,}|[A-Z]{2,})){0,3})\b/g;
  for (const match of text.matchAll(contextPattern)) {
    const value = clean(match[1]);
    if (!isLikelyRoleTitle(value)) facts.push({ type: "employer_client", value });
  }
}

function isLikelyRoleTitle(value) {
  const titleWords = new Set(["engineer", "developer", "manager", "director", "lead", "specialist", "analyst", "designer", "architect", "consultant", "frontend", "backend", "software", "product", "project", "program", "data", "security", "cloud", "devops"]);
  return normalize(value).split(" ").some((token) => titleWords.has(token));
}

function hasFact(facts, fact) {
  return facts.some((candidate) => candidate.type === fact.type && normalize(candidate.value) === normalize(fact.value));
}

function uniqueFacts(facts) {
  const seen = new Set();
  return facts.filter((fact) => {
    const key = `${fact.type}:${normalize(fact.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return fact.value;
  });
}

function uniqueDifferences(differences) {
  const seen = new Set();
  return differences.filter((difference) => {
    const key = `${difference.type}:${normalize(difference.value)}:${difference.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeStatus(status) {
  const value = String(status || "").toUpperCase().replace(/_/g, " ");
  if (value === CLAIM_STATUSES.VERIFIED) return CLAIM_STATUSES.VERIFIED;
  if (value === CLAIM_STATUSES.UNSUPPORTED) return CLAIM_STATUSES.UNSUPPORTED;
  if (value === CLAIM_STATUSES.UNCLEAR) return CLAIM_STATUSES.UNCLEAR;
  if (value === CLAIM_STATUSES.USER_CONFIRMED) return CLAIM_STATUSES.USER_CONFIRMED;
  return CLAIM_STATUSES.UNCLEAR;
}

function stripPlaceholders(text) {
  return String(text || "").replace(/\[[^\]]+\]/g, " ");
}

function clean(value) {
  return String(value || "").replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[,.;:()]/g, "").replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export {
  CLAIM_STATUSES,
  applyUserConfirmation,
  buildVerificationResult,
  canCopyOrApply,
  createSafeVerifiedVersion,
  deterministicVerify,
  extractFactualClaims,
  removeClaimFromVerification,
};
