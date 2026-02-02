<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Xác Minh Chứng Chỉ | VC</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <main class="center">
    <h1>Xác Minh Chứng Chỉ</h1>
    <p>Nhập mã chứng chỉ (hoặc quét QR) để kiểm tra tính xác thực.</p>

    <input id="code" type="text" placeholder="Ví dụ: VC-2026-0001" autocomplete="off" />
    <button id="btn">Kiểm tra</button>

    <button id="scan" class="ghost" style="width:100%; margin-top:10px;">Quét QR bằng camera</button>

    <div id="scanner" class="panel" hidden>
      <div class="badge muted">QR SCAN</div>
      <div class="title">Đưa QR vào giữa khung</div>

      <video id="video" playsinline
        style="width:100%; border-radius:14px; border:1px solid rgba(255,255,255,.08); margin-top:10px;"></video>

      <div class="note" id="scanNote">Đang mở camera…</div>

      <div class="actions">
        <button class="ghost" id="stop">Tắt camera</button>
      </div>
    </div>

    <div id="panel" class="panel" hidden>
      <div class="badge" id="badge">—</div>
      <div class="title" id="t">—</div>
      <div class="meta" id="m"></div>
      <div class="noteBox" id="n" hidden></div>

      <div class="actions">
        <button class="ghost" id="copy">Copy link</button>
        <a class="ghost" href="/">Trang VC</a>
        <a class="ghost" href="https://vetuonglai.com/vi/">Về Tương Lai</a>
      </div>
    </div>

    <div id="hint" class="note" style="margin-top:14px;">
      Mẹo: Có thể mở thẳng bằng link dạng <code>/verify/?code=VC-2026-0001</code> hoặc quét QR dẫn tới <code>/v/VC-...</code>
    </div>

    <p style="margin-top:18px;">
      <a href="/">← Quay lại VC</a>
    </p>
  </main>

  <script src="https://unpkg.com/jsqr/dist/jsQR.js"></script>

  <script>
    const $code = document.getElementById("code");
    const $btn = document.getElementById("btn");
    const $panel = document.getElementById("panel");
    const $badge = document.getElementById("badge");
    const $t = document.getElementById("t");
    const $m = document.getElementById("m");
    const $n = document.getElementById("n");
    const $copy = document.getElementById("copy");

    const $scan = document.getElementById("scan");
    const $scanner = document.getElementById("scanner");
    const $video = document.getElementById("video");
    const $stop = document.getElementById("stop");
    const $scanNote = document.getElementById("scanNote");

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    let stream = null;
    let rafId = null;

    function setStatus(status) {
      $badge.className = "badge";
      if (status === "valid") { $badge.textContent = "HỢP LỆ"; $badge.classList.add("ok"); }
      else if (status === "revoked") { $badge.textContent = "THU HỒI"; $badge.classList.add("bad"); }
      else if (status === "expired") { $badge.textContent = "HẾT HẠN"; $badge.classList.add("warn"); }
      else if (status === "not_found") { $badge.textContent = "KHÔNG TÌM THẤY"; $badge.classList.add("muted"); }
      else { $badge.textContent = "LỖI"; $badge.classList.add("bad"); }
    }

    function escapeHtml(s){
      return String(s||"").replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
    }

    function fmtRow(label, value) {
      const v = value ?? "—";
      return `<div class="row"><div class="k">${label}</div><div class="v">${escapeHtml(String(v))}</div></div>`;
    }

    function showRecord(data){
      $panel.hidden = false;
      setStatus(data.status);

      if (data.status === "not_found") {
        $t.textContent = "Không tìm thấy chứng chỉ";
        $m.innerHTML = fmtRow("Mã", data.code);
        $n.hidden = true;
        return;
      }

      const r = data.record || {};
      $t.textContent = r.name || "Chứng chỉ";
      $m.innerHTML =
        fmtRow("Mã", r.code) +
        fmtRow("Đơn vị cấp", r.issuer) +
        fmtRow("Ngày cấp", r.issuedAt) +
        fmtRow("Hết hạn", r.expiresAt || "Không");

      if (r.note) {
        $n.hidden = false;
        $n.textContent = r.note;
      } else {
        $n.hidden = true;
      }
    }

    async function verify(code) {
      const clean = (code || "").trim();
      if (!clean) {
        $panel.hidden = true;
        alert("Vui lòng nhập mã chứng chỉ.");
        return;
      }

      $btn.disabled = true;
      $btn.textContent = "Đang kiểm tra...";
      try {
        const res = await fetch(`/api/verify?code=${encodeURIComponent(clean)}`, { cache: "no-store" });
        const data = await res.json();
        showRecord(data);
        history.replaceState(null, "", `/verify/?code=${encodeURIComponent(clean)}`);
      } catch (e) {
        $panel.hidden = false;
        setStatus("error");
        $t.textContent = "Lỗi kết nối";
        $m.textContent = "Vui lòng thử lại.";
        $n.hidden = true;
      } finally {
        $btn.disabled = false;
        $btn.textContent = "Kiểm tra";
      }
    }

    $btn.addEventListener("click", ()=> verify($code.value));
    $code.addEventListener("keydown", (e)=> { if (e.key === "Enter") verify($code.value); });

    $copy.addEventListener("click", async () => {
      const code = ($code.value || new URLSearchParams(location.search).get("code") || "").trim();
      const link = `${location.origin}/verify/?code=${encodeURIComponent(code)}`;
      try {
        await navigator.clipboard.writeText(link);
        $copy.textContent = "Đã copy ✓";
        setTimeout(()=> $copy.textContent = "Copy link", 1200);
      } catch {
        prompt("Copy link:", link);
      }
    });

    // ---- QR decode helpers ----
    function extractCodeFromText(text) {
      const s = (text || "").trim();
      if (!s) return "";

      // 1) Nếu QR chỉ chứa mã VC-....
      if (/^VC-\d{4}-\d{4,}$/i.test(s)) return s.toUpperCase();

      // 2) Nếu QR là URL: hỗ trợ /verify/?code=..., và /v/VC-...
      try {
        if (s.startsWith("http")) {
          const u = new URL(s);
          const qp = (u.searchParams.get("code") || "").trim();
          if (qp) return qp.toUpperCase();

          // /v/VC-2026-0001
          const parts = u.pathname.split("/").filter(Boolean);
          if (parts.length >= 2 && parts[0].toLowerCase() === "v") {
            return String(parts[1] || "").trim().toUpperCase();
          }

          // fallback: nếu dán nhầm URL khác thì thôi
          return "";
        }
      } catch {}

      return "";
    }

    // ---- QR scan ----
    async function startScan() {
      try {
        $scanner.hidden = false;
        $scanNote.textContent = "Xin quyền camera…";
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });
        $video.srcObject = stream;
        await $video.play();
        $scanNote.textContent = "Đang quét…";
        tick();
      } catch (e) {
        $scanNote.textContent = "Không mở được camera. Hãy kiểm tra quyền camera trên trình duyệt.";
      }
    }

    function stopScan() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      $video.srcObject = null;
      $scanner.hidden = true;
    }

    function tick() {
      if (!$video.videoWidth) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      canvas.width = $video.videoWidth;
      canvas.height = $video.videoHeight;
      ctx.drawImage($video, 0, 0, canvas.width, canvas.height);

      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(img.data, img.width, img.height);

      if (qr && qr.data) {
        const code = extractCodeFromText(qr.data);
        if (code) {
          $code.value = code;
          stopScan();
          verify(code);
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    $scan.addEventListener("click", startScan);
    $stop.addEventListener("click", stopScan);

    // Auto verify if ?code=
    const q = new URLSearchParams(location.search);
    const preset = (q.get("code") || "").trim();
    if (preset) {
      $code.value = preset;
      verify(preset);
    }
  </script>
</body>
</html>
