import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

const url = process.env.STAGING_SUPABASE_URL;
const publishableKey = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceRoleKey) throw new Error("Staging test environment is incomplete.");
if (url !== "https://qrmowfxpsbtgwfmqseef.supabase.co") throw new Error("Refusing to test a non-staging project.");

const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const password = `T3st-${randomBytes(18).toString("base64url")}!`;
const emails = [`rl-test-a-${suffix}@example.invalid`, `rl-test-b-${suffix}@example.invalid`];
const createdUsers = [];

async function request(path, { method = "GET", key = publishableKey, token = key, body, prefer } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { response, data };
}

async function admin(path, options = {}) {
  return request(path, { ...options, key: serviceRoleKey, token: serviceRoleKey });
}

async function createUser(email) {
  const { response, data } = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: { email, password, email_confirm: true },
  });
  assert.equal(response.status, 200, "temporary staging user creation failed");
  createdUsers.push(data.id);
  return data;
}

async function signIn(email) {
  const { response, data } = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(response.status, 200, "password authentication failed");
  assert.ok(data.access_token && data.refresh_token, "authentication tokens were not returned");
  return data;
}

try {
  const [userA, userB] = await Promise.all(emails.map(createUser));
  const [sessionA, sessionB] = await Promise.all(emails.map(signIn));

  const refresh = await request("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: sessionA.refresh_token },
  });
  assert.equal(refresh.response.status, 200, "session restoration/refresh failed");

  const anonymousInsert = await request("/rest/v1/resumes", { method: "POST", body: { title: "Anonymous write" } });
  assert.ok([401, 403].includes(anonymousInsert.response.status), "anonymous resume insert was not rejected");

  const created = await request("/rest/v1/resumes", {
    method: "POST",
    token: sessionA.access_token,
    prefer: "return=representation",
    body: { title: "Staging RLS resume", structured_data: { sections: [] } },
  });
  assert.equal(created.response.status, 201, "owner resume creation failed");
  const resume = created.data[0];
  assert.equal(resume.owner_id, userA.id, "resume owner did not default to the authenticated user");

  const renamed = await request(`/rest/v1/resumes?id=eq.${resume.id}`, {
    method: "PATCH",
    token: sessionA.access_token,
    prefer: "return=representation",
    body: { title: "Renamed staging resume" },
  });
  assert.equal(renamed.response.status, 200, "owner rename failed");
  assert.equal(renamed.data[0].title, "Renamed staging resume");

  const duplicate = await request("/rest/v1/resumes", {
    method: "POST",
    token: sessionA.access_token,
    prefer: "return=representation",
    body: { title: "Renamed staging resume copy", structured_data: resume.structured_data },
  });
  assert.equal(duplicate.response.status, 201, "owner duplication failed");

  const guestId = randomUUID();
  const importBody = {
    guest_resumes: [{ source_guest_id: guestId, title: "Imported guest resume", structured_data: { sections: [] } }],
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const imported = await request("/rest/v1/rpc/import_guest_resumes", {
      method: "POST",
      token: sessionA.access_token,
      body: importBody,
    });
    assert.equal(imported.response.status, 200, "guest import RPC failed");
  }
  const importedRows = await request(`/rest/v1/resumes?source_guest_id=eq.${guestId}&select=id`, {
    token: sessionA.access_token,
  });
  assert.equal(importedRows.data.length, 1, "retry-safe guest import created a duplicate");

  const crossRead = await request(`/rest/v1/resumes?id=eq.${resume.id}&select=id,title`, {
    token: sessionB.access_token,
  });
  assert.equal(crossRead.response.status, 200);
  assert.deepEqual(crossRead.data, [], "user B could read user A's resume");

  const crossUpdate = await request(`/rest/v1/resumes?id=eq.${resume.id}`, {
    method: "PATCH",
    token: sessionB.access_token,
    prefer: "return=representation",
    body: { title: "Unauthorized change" },
  });
  assert.equal(crossUpdate.response.status, 200);
  assert.deepEqual(crossUpdate.data, [], "user B could update user A's resume");

  const crossParent = await request("/rest/v1/resume_sections", {
    method: "POST",
    token: sessionB.access_token,
    body: { resume_id: resume.id, section_type: "skills", heading: "Skills", position: 0, content: {} },
  });
  assert.ok([400, 409].includes(crossParent.response.status), "user B could attach a child record to user A's resume");

  const forged = await request("/rest/v1/resumes", {
    method: "POST",
    token: sessionB.access_token,
    body: { owner_id: userA.id, title: "Forged owner" },
  });
  assert.ok([401, 403].includes(forged.response.status), "forged ownership was not rejected");

  for (const status of ["archived", "active", "deleted"]) {
    const changed = await request(`/rest/v1/resumes?id=eq.${resume.id}`, {
      method: "PATCH",
      token: sessionA.access_token,
      prefer: "return=representation",
      body: { status, ...(status === "deleted" ? { deleted_at: new Date().toISOString() } : {}) },
    });
    assert.equal(changed.response.status, 200, `owner ${status} transition failed`);
  }
  const removed = await request("/rest/v1/rpc/permanently_delete_resume", {
    method: "POST",
    token: sessionA.access_token,
    body: { target_resume_id: resume.id },
  });
  assert.equal(removed.response.status, 204, "owned permanent deletion failed");

  const profileA = await request(`/rest/v1/profiles?id=eq.${userA.id}&select=id`, { token: sessionA.access_token });
  const profileB = await request(`/rest/v1/profiles?id=eq.${userB.id}&select=id`, { token: sessionA.access_token });
  assert.equal(profileA.data.length, 1, "owner profile was not visible");
  assert.equal(profileB.data.length, 0, "another user's profile was visible");

  console.log(
    "Staging live checks passed: auth, refresh, owner CRUD, guest import idempotency, anonymous denial, and two-user RLS isolation.",
  );
} finally {
  await Promise.all(createdUsers.map((id) => admin(`/auth/v1/admin/users/${id}`, { method: "DELETE" })));
}
