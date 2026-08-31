export function contentRuleIds(resume: Record<string, unknown>) {
  const rules: string[] = [];
  if (Array.isArray(resume.missingSections) && resume.missingSections.length) rules.push("content.missing-sections");
  if (!resume.hasContact) rules.push("content.missing-contact");
  if (Array.isArray(resume.longBullets) && resume.longBullets.length) rules.push("content.long-bullets");
  if (Array.isArray(resume.shortBullets) && resume.shortBullets.length) rules.push("content.short-bullets");
  if (Array.isArray(resume.responsibilityBullets) && resume.responsibilityBullets.length)
    rules.push("content.responsibility-language");
  if (Array.isArray(resume.stuffing) && resume.stuffing.length) rules.push("content.keyword-repetition");
  return rules;
}
