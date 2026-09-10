# Phase 20: Profile Import Foundation

Phase 20 adds a user-controlled, deterministic profile import preview to the existing Application Profile page.

## Supported sources

- Pasted, explicitly labeled profile text.
- Local TXT, MD, RTF, PDF, and DOCX files through the existing browser-local extractor.

The first version does not scrape LinkedIn or access private pages. Proprietary export formats are treated as ordinary
text unless their values use the supported explicit labels. No official external API is assumed.

## Safe staging flow

`IMPORT -> PARSE -> NORMALIZE -> PREVIEW DIFF -> USER DECIDES -> SAVE`

Only these existing Application Profile fields are eligible: names, email, phone, city, region, country, postal code,
HTTPS LinkedIn/portfolio/GitHub URLs, work authorization when explicitly labeled, availability, and notice period.
Values are shown as Current versus Imported. New fields default to Skip, and conflicting fields require an explicit
Use imported decision. The existing `saveApplicationProfile` path remains the only persistence boundary.

## Privacy and parser boundaries

Parsing is local and deterministic. Resume/JD contents, AI provider data, application history, and profile references
are not sent to any server. The import source is not retained after the preview is canceled or accepted. Unknown,
prohibited, sensitive, demographic, credential, secret, and financial fields are excluded from the preview. Strings,
URLs, file bytes, extracted text, and list sizes remain bounded by existing parser/profile limits.

Imported text is treated as data. HTML, script-like text, prompt instructions, archive paths, and malformed documents do
not execute or write to arbitrary paths. Unsafe URLs are rejected; only HTTPS profile URLs can be accepted.

## Deliberate limitations

There is no LinkedIn scraping, CAPTCHA/login bypass, AI extraction, cloud sync, new database, automatic overwrite, or
profile/resume duplicate creation in this phase. Resume-like work history remains in the existing explicit Resume
Editor import workflow and is not inferred into the Application Profile.
