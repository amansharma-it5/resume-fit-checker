import { describe, expect, it } from "vitest";
import {
  jobMatchesLocation,
  normalizeJob,
  normalizeJobs,
  saveDiscoveredJobAsTarget,
  safeJobUrl,
  toTargetDraft,
  type NormalizedJob,
} from "./job-discovery";
import { createGuestResume } from "./guest-db";

const job: NormalizedJob = {
  source: "remotive",
  sourceJobId: "123",
  sourceUrl: "https://remotive.com/remote-jobs/example-123",
  title: "Platform Engineer",
  company: "Example Labs",
  location: "Worldwide",
  workplaceType: "remote",
  description: "Build reliable services.",
  requirements: [],
  skills: [],
  fetchedAt: "2026-09-10T00:00:00.000Z",
};

describe("job discovery normalization", () => {
  it("normalizes supported source fields and strips HTML", () => {
    expect(
      normalizeJob(
        {
          id: 123,
          url: job.sourceUrl,
          title: job.title,
          company_name: job.company,
          candidate_required_location: job.location,
          job_type: "full_time",
          description: "<p>Build <strong>reliable</strong> services.</p><script>nope</script>",
          publication_date: "2026-09-09T00:00:00Z",
        },
        job.fetchedAt,
      ),
    ).toMatchObject({ ...job, employmentType: "full_time", description: "Build reliable services." });
  });

  it("rejects missing identity and non-HTTPS source URLs", () => {
    expect(normalizeJob({ id: 1, title: "Role", company_name: "Company", url: "javascript:alert(1)" })).toBeUndefined();
    expect(safeJobUrl("http://example.com/job")).toBeUndefined();
    expect(safeJobUrl(job.sourceUrl)).toBe(job.sourceUrl);
  });

  it("keeps malformed provider items out of normalized results", () => {
    expect(normalizeJobs({ jobs: [job, { title: "Missing URL" }] }, job.fetchedAt)).toHaveLength(0);
  });

  it("matches supported remote locations without treating the JD as candidate evidence", () => {
    expect(jobMatchesLocation(job, "worldwide")).toBe(true);
    expect(jobMatchesLocation({ ...job, location: "United States" }, "canada")).toBe(false);
    expect(toTargetDraft(job, "resume-1")).toMatchObject({
      source: "remotive",
      sourceJobId: "123",
      baseResumeId: "resume-1",
      jobDescription: job.description,
    });
  });

  it("saves a listing once and preserves source identity for target deduplication", async () => {
    const resume = await createGuestResume("Local base");
    const first = await saveDiscoveredJobAsTarget(job, resume.id);
    const second = await saveDiscoveredJobAsTarget(job, resume.id);
    expect(first.existed).toBe(false);
    expect(second.existed).toBe(true);
    expect(second.target.id).toBe(first.target.id);
    expect(second.target.sourceJobId).toBe(job.sourceJobId);
  });
});
