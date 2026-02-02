export async function onRequestGet(context) {
  const { params, env, request } = context;
  const code = String(params.code || "").trim().toUpperCase();

  const value = await env.VC_KV.get(code);
  if (!value) return html(pageNotFound(code), 404);

  let record;
  try { record = JSON.parse(value); }
  catch { return html(pageCorrupt(code), 500); }

  const now = Date.now();
  const expiresAt = record.expiresAt ? Date.parse(record.expiresAt) : null;
  const revoked = !!record.revokedAt;

  let status = "valid";
  if (revoked) status = "revoked";
  else if (expiresAt && now > expiresAt) status = "expired";

  const origin = new URL(request.url).origin;
  return html(pageCredential(origin, status, record), 200);
}

function esc(s){ return String(s||"").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

function badge(status){
  if (status === "valid") return `<span class="b ok">HỢP LỆ</span>`;
  if (status === "revoked") return `<span class="b bad">THU HỒI</span>`;
  if (status === "expired") return `<span class="b warn">HẾT HẠN</span>`;
  return `<span class="b muted">KHÔNG RÕ</span>`;
}

function pageCredential(origin, status, r){
  const title = `${r.code} | ${r.name}`;
  const verifyLink = `${origin}/verify/?code=${encodeURIComponent(r.code)}`;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="Trang xác minh chứng chỉ: ${esc(r.code)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="Xác minh chứng chỉ số nhanh, minh bạch vừa đủ." />
<meta property="og:type" content="website" />
<link rel="stylesheet" href="/assets/styles.css" />
<style>
  .wrap{max-width:760px;margin:0 auto;padding:28px 18px}
  .card{border:1px solid rgba(255,255,255,.08);background:rgba(16,24,35,.75);border-radius:16px;padding:18px}
  .b{display:inline-block;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.5px;border:1px solid rgba(255,255,255,.08)}
  .ok{background:rgba(34,197,94,.12);color:#86efac;border-color:rgba(34,197,94,.35)}
  .warn{background:rgba(251,191,36,.12);color:#fde68a;border-color:rgba(251,191,36,.35)}
  .bad{background:rgba(239,68,68,.12);color:#fca5a5;border-color:rgba(239,68,68,.35)}
  .muted{background:rgba(148,163,184,.10);color:#a9b4c3}
  .row{display:flex;justify-content:space-between;gap:12px;border-top:1px dashed rgba(255,255,255,.08);padding-top:10px;margin-top:10px}
  .k{color:#a9b4c3}
  .v{font-weight:800;text-align:right;word-break:break-word}
  .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  a.btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.03);color:#e9eef6;text-decoration:none}
</style>
</head>
<body>
  <div class="wrap">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <div>${badge(status)}</div>
      <div style="color:#a9b4c3;font-weight:700">Vetuonglai VC</div>
    </div>

    <h1 style="margin:12px 0 6px;">${esc(r.name || "Chứng chỉ")}</h1>

    <div class="card">
      <div class="row"><div class="k">Mã</div><div class="v">${esc(r.code)}</div></div>
      <div class="row"><div class="k">Đơn vị cấp</div><div class="v">${esc(r.issuer || "—")}</div></div>
      <div class="row"><div class="k">Ngày cấp</div><div class="v">${esc(r.issuedAt || "—")}</div></div>
      <div class="row"><div class="k">Hết hạn</div><div class="v">${esc(r.expiresAt || "Không")}</div></div>
      ${r.note ? `<div class="row"><div class="k">Ghi chú</div><div class="v">${esc(r.note)}</div></div>` : ""}

      <div class="actions">
        <a class="btn" href="${verifyLink}">Mở trang xác minh</a>
        <a class="btn" href="${origin}/">Trang VC</a>
        <a class="btn" href="https://vetuonglai.com/vi/">Về Tương Lai</a>
      </div>
    </div>

    <p style="color:#a9b4c3;margin-top:14px;">
      Link chia sẻ: <span style="font-weight:800">${esc(origin)}/v/${esc(r.code)}</span>
    </p>
  </div>
</body>
</html>`;
}

function pageNotFound(code){
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Không tìm thấy</title><link rel="stylesheet" href="/assets/styles.css"/></head>
  <body><main class="center"><h1>Không tìm thấy chứng chỉ</h1><p>Mã: <b>${esc(code)}</b></p><p><a href="/verify/">Đi tới trang xác minh</a></p></main></body></html>`;
}
function pageCorrupt(code){
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Dữ liệu lỗi</title><link rel="stylesheet" href="/assets/styles.css"/></head>
  <body><main class="center"><h1>Dữ liệu chứng chỉ bị lỗi</h1><p>Mã: <b>${esc(code)}</b></p></main></body></html>`;
}

function html(content, status=200){
  return new Response(content, { status, headers: { "content-type":"text/html; charset=utf-8", "cache-control":"no-store" } });
}
