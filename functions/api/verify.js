export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const codeRaw = (url.searchParams.get("code") || "").trim();

  // Chuẩn hóa code (tránh lỗi khoảng trắng)
  const code = codeRaw.toUpperCase();

  if (!code) {
    return json({ ok: false, error: "missing_code", message_vi: "Vui lòng nhập mã chứng chỉ.", message_en: "Please provide a credential code." }, 400);
  }

  // Đọc từ KV: nếu không có -> null
  const value = await env.VC_KV.get(code);

  if (!value) {
    return json({
      ok: true,
      status: "not_found",
      code,
      message_vi: "Không tìm thấy chứng chỉ.",
      message_en: "Credential not found."
    }, 200);
  }

  // value lưu dạng JSON string
  let record;
  try {
    record = JSON.parse(value);
  } catch (e) {
    return json({ ok: false, error: "bad_record", message_vi: "Dữ liệu chứng chỉ bị lỗi.", message_en: "Credential record is corrupted." }, 500);
  }

  // Các trạng thái chuẩn
  // record = { code, name, issuer, issuedAt, expiresAt, revokedAt, note }
  const now = Date.now();
  const expiresAt = record.expiresAt ? Date.parse(record.expiresAt) : null;
  const revoked = !!record.revokedAt;

  if (revoked) {
    return json({
      ok: true,
      status: "revoked",
      code,
      record: publicView(record),
      message_vi: "Chứng chỉ đã bị thu hồi.",
      message_en: "Credential has been revoked."
    }, 200);
  }

  if (expiresAt && now > expiresAt) {
    return json({
      ok: true,
      status: "expired",
      code,
      record: publicView(record),
      message_vi: "Chứng chỉ đã hết hạn.",
      message_en: "Credential has expired."
    }, 200);
  }

  return json({
    ok: true,
    status: "valid",
    code,
    record: publicView(record),
    message_vi: "Chứng chỉ hợp lệ.",
    message_en: "Credential is valid."
  }, 200);
}

function publicView(record) {
  // Chỉ trả về thông tin cần thiết, tránh lộ dữ liệu thừa
  return {
    code: record.code,
    name: record.name,
    issuer: record.issuer,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt || null,
    note: record.note || null
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
