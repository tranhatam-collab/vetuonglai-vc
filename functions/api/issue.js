export async function onRequestPost(context) {
  const { request, env } = context;

  const expect = (env.ISSUE_SECRET || "").trim();
  if (!expect) return json({ ok:false, error:"missing_env", message_vi:"Chưa cấu hình ISSUE_SECRET." }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ ok:false, error:"bad_json", message_vi:"Body không hợp lệ." }, 400); }

  const secret = (body.secret || "").trim();
  if (!secret || secret !== expect) {
    return json({ ok:false, error:"unauthorized", message_vi:"Mã phát hành không đúng." }, 401);
  }

  const code = String(body.code || "").trim().toUpperCase();
  const name = String(body.name || "").trim();
  const issuer = String(body.issuer || env.ISSUER_NAME || "Về Tương Lai").trim();
  const issuedAt = String(body.issuedAt || "").trim();
  const expiresAt = body.expiresAt ? String(body.expiresAt).trim() : null;
  const note = body.note ? String(body.note).trim() : null;

  if (!code || !name || !issuer || !issuedAt) {
    return json({ ok:false, error:"missing_fields", message_vi:"Thiếu code/name/issuer/issuedAt." }, 400);
  }

  // ✅ KHÓA: không cho ghi đè nếu đã tồn tại
  const existing = await env.VC_KV.get(code);
  if (existing) {
    return json({
      ok: false,
      error: "already_exists",
      code,
      message_vi: "Mã chứng chỉ đã tồn tại. Không thể phát hành lại để tránh chỉnh sửa chứng chỉ cũ.",
      message_en: "Code already exists. Overwrite is locked."
    }, 409);
  }

  // Lưu đúng "minh bạch vừa đủ" (không dữ liệu cá nhân)
  const record = {
    code,
    name,
    issuer,
    issuedAt,
    expiresAt,
    revokedAt: null,
    note
  };

  await env.VC_KV.put(code, JSON.stringify(record));

  // ✅ Append-only audit log (không lộ dữ liệu thừa)
  await appendAudit(env, {
    action: "issue",
    code,
    issuer,
    issuedAt
  });

  return json({
    ok: true,
    status: "issued",
    code,
    record: publicView(record),
    message_vi: "Đã phát hành chứng chỉ.",
    message_en: "Credential issued."
  });
}

function publicView(r){
  return { code:r.code, name:r.name, issuer:r.issuer, issuedAt:r.issuedAt, expiresAt:r.expiresAt || null, note:r.note || null };
}

// ===== Audit (append-only) =====
// Lưu mỗi action thành 1 key riêng, không ghi đè.
// Key format: AUDIT:<code>:<timestamp>:<rand>
async function appendAudit(env, data){
  const ts = new Date().toISOString(); // UTC ISO
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `AUDIT:${data.code}:${ts}:${rand}`;
  const entry = {
    v: 1,
    at: ts,
    action: data.action,
    code: data.code,
    issuer: data.issuer || null,
    issuedAt: data.issuedAt || null
  };
  await env.VC_KV.put(key, JSON.stringify(entry));
}

function json(obj, status=200){
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
  });
}
