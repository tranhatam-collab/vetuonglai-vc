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
  if (!code) return json({ ok:false, error:"missing_code", message_vi:"Thiếu mã chứng chỉ." }, 400);

  const value = await env.VC_KV.get(code);
  if (!value) {
    return json({ ok:true, status:"not_found", code, message_vi:"Không tìm thấy chứng chỉ.", message_en:"Credential not found." }, 200);
  }

  let record;
  try { record = JSON.parse(value); }
  catch { return json({ ok:false, error:"bad_record", message_vi:"Dữ liệu chứng chỉ bị lỗi." }, 500); }

  record.revokedAt = new Date().toISOString().slice(0,10); // YYYY-MM-DD
  await env.VC_KV.put(code, JSON.stringify(record));

  return json({
    ok:true,
    status:"revoked",
    code,
    record: publicView(record),
    message_vi:"Đã thu hồi chứng chỉ.",
    message_en:"Credential revoked."
  }, 200);
}

function publicView(r){
  return { code:r.code, name:r.name, issuer:r.issuer, issuedAt:r.issuedAt, expiresAt:r.expiresAt || null, note:r.note || null };
}
function json(obj, status=200){
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
  });
}
