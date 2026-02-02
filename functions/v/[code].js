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

function statusLine(status, r){
  if (status === "valid") return `Chứng chỉ hợp lệ. Có thể xác minh ngay.`;
  if (status === "revoked") return `Chứng chỉ đã bị thu hồi${r.revokedAt ? ` (${esc(r.revokedAt)})` : ""}.`;
  if (status === "expired") return `Chứng chỉ đã hết hạn${r.expiresAt ? ` (${esc(r.expiresAt)})` : ""}.`;
  return `Trạng thái không xác định.`;
}

function pageCredential(origin, status, r){
  const title = `${r.code} | ${r.name}`;
  const shareLink = `${origin}/v/${encodeURIComponent(r.code)}`;      // ✅ QR trỏ về link đẹp
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
  .wrap{max-width:860px;margin:0 auto;padding:28px 18px}
  .top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .card{border:1px solid rgba(255,255,255,.08);background:rgba(16,24,35,.75);border-radius:16px;padding:18px}
  .b{display:inline-block;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.5px;border:1px solid rgba(255,255,255,.08)}
  .ok{background:rgba(34,197,94,.12);color:#86efac;border-color:rgba(34,197,94,.35)}
  .warn{background:rgba(251,191,36,.12);color:#fde68a;border-color:rgba(251,191,36,.35)}
  .bad{background:rgba(239,68,68,.12);color:#fca5a5;border-color:rgba(239,68,68,.35)}
  .muted{background:rgba(148,163,184,.10);color:#a9b4c3}
  .row{display:flex;justify-content:space-between;gap:12px;border-top:1px dashed rgba(255,255,255,.08);padding-top:10px;margin-top:10px}
  .k{color:#a9b4c3}
  .v{font-weight:800;text-align:right;word-break:break-word}
  .grid{display:grid;grid-template-columns: 1.2fr .8fr; gap:14px}
  @media (max-width: 860px){ .grid{grid-template-columns:1fr; } }
  .qrBox{border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px;background:rgba(255,255,255,.02);text-align:center}
  .qrMeta{color:#a9b4c3;margin-top:10px;font-size:13px}
  .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  a.btn, button.btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.03);color:#e9eef6;text-decoration:none;cursor:pointer}
  button.btn{font:inherit}
  code.small{font-size:12px;color:#a9b4c3}
  .hint{color:#a9b4c3;margin-top:10px}
  @media print{
    .noPrint{display:none !important}
    body{background:#fff;color:#000}
    .card,.qrBox{background:#fff;border:1px solid #ddd}
    .k{color:#333}
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>${badge(status)}</div>
      <div style="color:#a9b4c3;font-weight:700">Vetuonglai VC</div>
    </div>

    <h1 style="margin:12px 0 6px;">${esc(r.name || "Chứng chỉ")}</h1>
    <div class="hint">${esc(statusLine(status, r))}</div>

    <div class="grid" style="margin-top:14px;">
      <div class="card">
        <div class="row"><div class="k">Mã</div><div class="v">${esc(r.code)}</div></div>
        <div class="row"><div class="k">Đơn vị cấp</div><div class="v">${esc(r.issuer || "—")}</div></div>
        <div class="row"><div class="k">Ngày cấp</div><div class="v">${esc(r.issuedAt || "—")}</div></div>
        <div class="row"><div class="k">Hết hạn</div><div class="v">${esc(r.expiresAt || "Không")}</div></div>
        ${r.revokedAt ? `<div class="row"><div class="k">Thu hồi</div><div class="v">${esc(r.revokedAt)}</div></div>` : ""}
        ${r.note ? `<div class="row"><div class="k">Ghi chú</div><div class="v">${esc(r.note)}</div></div>` : ""}

        <div class="actions noPrint">
          <a class="btn" href="${verifyLink}">Mở trang xác minh</a>
          <a class="btn" href="${origin}/">Trang VC</a>
          <a class="btn" href="https://vetuonglai.com/vi/">Về Tương Lai</a>
        </div>

        <div class="hint">
          Link chia sẻ: <code class="small">${esc(shareLink)}</code>
        </div>
      </div>

      <div class="qrBox">
        <div style="font-weight:900; margin-bottom:10px;">QR Xác Minh</div>
        <div id="qr"></div>
        <div class="qrMeta">Quét QR để mở link share. Trang xác minh sẽ tự nhận mã.</div>

        <div class="actions noPrint" style="justify-content:center;">
          <button class="btn" id="copyShare">Copy link</button>
          <button class="btn" id="copyVerify">Copy verify</button>
          <button class="btn" id="downloadQR">Tải QR</button>
          <button class="btn" id="print">In</button>
        </div>
      </div>
    </div>
  </div>

  <!-- QR generator (client-side) -->
  <script src="https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js"></script>
  <script>
    const shareLink = ${JSON.stringify(shareLink)};
    const verifyLink = ${JSON.stringify(verifyLink)};

    // Render QR (to shareLink)
    const box = document.getElementById("qr");
    box.innerHTML = "";
    const qr = new QRCode(box, {
      text: shareLink,
      width: 220,
      height: 220,
      correctLevel: QRCode.CorrectLevel.M
    });

    async function copyText(txt){
      try { await navigator.clipboard.writeText(txt); return true; }
      catch { prompt("Copy:", txt); return false; }
    }

    document.getElementById("copyShare").onclick = async () => {
      const ok = await copyText(shareLink);
      if (ok) flash("copyShare");
    };
    document.getElementById("copyVerify").onclick = async () => {
      const ok = await copyText(verifyLink);
      if (ok) flash("copyVerify");
    };

    function flash(id){
      const b = document.getElementById(id);
      const t = b.textContent;
      b.textContent = "Đã copy ✓";
      setTimeout(()=> b.textContent = t, 1000);
    }

    // Download QR (canvas to PNG)
    document.getElementById("downloadQR").onclick = () => {
      // qrcodejs generates <img> or <canvas> depending on browser
      const img = box.querySelector("img");
      const canvas = box.querySelector("canvas");
      const url = img ? img.src : (canvas ? canvas.toDataURL("image/png") : "");
      if (!url) { alert("Không tải được QR. Thử lại."); return; }

      const a = document.createElement("a");
      a.href = url;
      a.download = (${JSON.stringify(r.code)} + ".png");
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    document.getElementById("print").onclick = () => window.print();
  </script>
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
