// ══════════════════════════════════════════
// Flow AI — Image Generator App
// ══════════════════════════════════════════
let API = localStorage.getItem('flow_api_url') || '';
let KEY = localStorage.getItem('flow_api_key') || '';
const H = () => ({'Content-Type':'application/json','X-API-Key':KEY});
const jobs = []; // {id, type, prompt, status, progress}
let uploadedPaths = [];

// ── Init ──
window.addEventListener('DOMContentLoaded', () => {
  if(!API || !KEY) openSettings();
  else checkConnection();
  setupRatio();
  setupUpload();
  setupPromptCount();
});

// ── Settings ──
function openSettings(){
  document.getElementById('cfgUrl').value = API;
  document.getElementById('cfgKey').value = KEY;
  document.getElementById('settingsOverlay').classList.add('show');
}
function closeSettings(){ document.getElementById('settingsOverlay').classList.remove('show'); }
function saveSettings(){
  API = document.getElementById('cfgUrl').value.trim().replace(/\/+$/,'');
  KEY = document.getElementById('cfgKey').value.trim();
  if(!API||!KEY) return toast('Nhập đầy đủ URL và Key','err');
  localStorage.setItem('flow_api_url', API);
  localStorage.setItem('flow_api_key', KEY);
  closeSettings();
  checkConnection();
  toast('Đã lưu cài đặt','ok');
}

async function checkConnection(){
  try{
    const r = await fetch(`${API}/public/api/v1/usage`,{headers:{'X-API-Key':KEY}});
    if(r.ok){
      document.getElementById('statusDot').classList.add('on');
      document.getElementById('statusText').textContent='Đã kết nối';
      loadUsage();
    } else {
      document.getElementById('statusDot').classList.remove('on');
      document.getElementById('statusText').textContent='Lỗi key';
    }
  }catch{
    document.getElementById('statusDot').classList.remove('on');
    document.getElementById('statusText').textContent='Không kết nối';
  }
}

// ── Tabs ──
function switchTab(id){
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', t.textContent.toLowerCase().includes(id)));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tc-'+id).classList.add('active');
  if(id==='library') loadLibrary();
  if(id==='usage') loadUsage();
  if(id==='jobs') renderJobs();
}

// ── Ratio buttons ──
function setupRatio(){
  document.querySelectorAll('.ratio-group').forEach(g => {
    g.querySelectorAll('.ratio-btn').forEach(b => {
      b.addEventListener('click', () => {
        g.querySelectorAll('.ratio-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
  });
}
function getRatio(groupId){
  const a = document.querySelector(`#${groupId} .ratio-btn.active`);
  return a ? a.dataset.v : '1:1';
}

// ── Prompt counter ──
function setupPromptCount(){
  const ta = document.getElementById('t2iPrompts');
  ta.addEventListener('input', () => {
    const n = ta.value.trim().split('\n').filter(l=>l.trim()).length;
    document.getElementById('t2iCount').textContent = n + ' prompt';
  });
}

// ── Upload ──
function setupUpload(){
  const zone = document.getElementById('r2iZone');
  const input = document.getElementById('r2iFile');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', () => handleFiles(input.files));
}

async function handleFiles(files){
  if(!API||!KEY) return toast('Cài đặt API trước','err');
  const thumbs = document.getElementById('r2iThumbs');
  for(const f of files){
    const fd = new FormData(); fd.append('file', f);
    try{
      toast('Đang upload '+f.name+'...','info');
      const r = await fetch(`${API}/public/api/v1/upload-image`,{method:'POST',body:fd,headers:{'X-API-Key':KEY}});
      const d = await r.json();
      if(d.path){
        uploadedPaths.push(d.path);
        const idx = uploadedPaths.length - 1;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;display:inline-block';
        wrap.dataset.uploadIdx = idx;
        const img = document.createElement('img');
        img.src = URL.createObjectURL(f);
        img.className = 'upload-thumb';
        const btn = document.createElement('button');
        btn.textContent = '×';
        btn.style.cssText = 'position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:var(--err);color:#fff;border:none;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;line-height:1';
        btn.onclick = () => removeUpload(idx, wrap);
        wrap.appendChild(img);
        wrap.appendChild(btn);
        thumbs.appendChild(wrap);
        toast('Upload OK: '+f.name,'ok');
        updateUploadCount();
      }
    }catch(e){ toast('Upload lỗi: '+e.message,'err'); }
  }
}

function removeUpload(idx, el){
  uploadedPaths[idx] = null; // Mark as removed
  el.remove();
  updateUploadCount();
  toast('Đã xóa ảnh tham chiếu','ok');
}

function clearAllUploads(){
  uploadedPaths = [];
  document.getElementById('r2iThumbs').innerHTML = '';
  updateUploadCount();
  toast('Đã xóa tất cả ảnh tham chiếu','ok');
}

function updateUploadCount(){
  const count = uploadedPaths.filter(p => p).length;
  const el = document.getElementById('r2iUploadInfo');
  if(el) el.textContent = count > 0 ? `${count} ảnh đã upload` : '';
}

// ── T2I ──
async function startT2I(){
  if(!API||!KEY) return openSettings();
  const lines = document.getElementById('t2iPrompts').value.trim().split('\n').filter(l=>l.trim());
  if(!lines.length) return toast('Nhập ít nhất 1 prompt','err');
  const ratio = getRatio('t2iRatio');
  const upscale = getRatio('t2iUpscale');
  const num = parseInt(document.getElementById('t2iNum').value);
  const btn = document.getElementById('t2iBtn');
  btn.disabled = true; btn.textContent = '⏳ Đang tạo...';
  try{
    const r = await fetch(`${API}/public/api/v1/text-to-image`,{
      method:'POST', headers:H(),
      body:JSON.stringify({prompts:lines, aspect_ratio:ratio, num_images:num, upscale_quality:upscale})
    });
    const d = await r.json();
    if(!r.ok){
      const msg = d.detail || d.error || d.message || 'Lỗi không xác định';
      toast(`❌ ${msg}`, 'err');
      btn.disabled = false; btn.textContent = '🚀 Tạo ảnh';
      return;
    }
    if(d.job_id){
      const job = {id:d.job_id, type:'T2I', prompts:lines, status:'queued', progress:0};
      jobs.unshift(job);
      toast('Job tạo: '+d.job_id,'ok');
      pollJob(job, 't2iResults');
      updateJobsBadge();
    } else { toast(d.error||d.detail||'Lỗi','err'); }
  }catch(e){ toast('Lỗi: '+e.message,'err'); }
  btn.disabled = false; btn.textContent = '🚀 Tạo ảnh';
}

// ── R2I ──
async function startR2I(){
  if(!API||!KEY) return openSettings();
  if(!uploadedPaths.length) return toast('Upload ảnh tham chiếu trước','err');
  const lines = document.getElementById('r2iPrompts').value.trim().split('\n').filter(l=>l.trim());
  if(!lines.length) return toast('Nhập ít nhất 1 prompt','err');
  // Filter out removed uploads
  const activePaths = uploadedPaths.filter(p => p);
  if(!activePaths.length) return toast('Upload ảnh tham chiếu trước','err');
  const ratio = getRatio('r2iRatio');
  const upscale = getRatio('r2iUpscale');
  const btn = document.getElementById('r2iBtn');
  btn.disabled = true; btn.textContent = '⏳ Đang tạo...';
  try{
    const r = await fetch(`${API}/public/api/v1/reference-to-image`,{
      method:'POST', headers:H(),
      body:JSON.stringify({prompts:lines, reference_images:activePaths, aspect_ratio:ratio, upscale_quality:upscale})
    });
    const d = await r.json();
    if(!r.ok){
      const msg = d.detail || d.error || d.message || 'Lỗi không xác định';
      toast(`❌ ${msg}`, 'err');
      btn.disabled = false; btn.textContent = '🖼️ Tạo ảnh tham chiếu';
      return;
    }
    if(d.job_id){
      const job = {id:d.job_id, type:'R2I', prompts:lines, status:'queued', progress:0};
      jobs.unshift(job);
      toast('Job R2I: '+d.job_id,'ok');
      pollJob(job, 'r2iResults');
      updateJobsBadge();
    } else { toast(d.error||d.detail||'Lỗi','err'); }
  }catch(e){ toast('Lỗi: '+e.message,'err'); }
  btn.disabled = false; btn.textContent = '🖼️ Tạo ảnh tham chiếu';
}

// ── Poll Job ──
async function pollJob(job, resultElId){
  const el = document.getElementById(resultElId);
  const card = document.createElement('div');
  card.style.cssText = 'padding:12px;border-bottom:1px solid var(--border)';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-family:monospace;color:var(--accent);font-size:11px">${job.id}</span>
      <span class="badge badge-run" id="st-${job.id}">queued</span>
    </div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:4px">${job.prompts.join(' | ').substring(0,100)}</div>
    <div class="progress"><div class="progress-fill" id="pg-${job.id}" style="width:0%"></div></div>
    <div id="imgs-${job.id}" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>
  `;
  if(el.querySelector('p')) el.innerHTML = '';
  el.prepend(card);

  while(true){
    try{
      const r = await fetch(`${API}/public/api/v1/jobs/${job.id}`,{headers:{'X-API-Key':KEY}});
      const d = await r.json();
      job.status = d.status; job.progress = d.progress||0;
      const stEl = document.getElementById('st-'+job.id);
      const pgEl = document.getElementById('pg-'+job.id);
      if(stEl){
        stEl.textContent = d.status;
        stEl.className = 'badge ' + (d.status==='completed'?'badge-ok':d.status==='failed'?'badge-err':'badge-run');
      }
      if(pgEl) pgEl.style.width = job.progress+'%';
      if(d.status==='completed'){
        const imgEl = document.getElementById('imgs-'+job.id);
        // Try loading images - try max of reported count or prompt count
        const maxTry = Math.max(d.images_count||0, d.total_prompts||0, job.prompts.length, 4);
        for(let i=0;i<maxTry;i++){
          const img = await loadImageRetry(job.id, i, 3);
          if(img && imgEl){
            const im = document.createElement('img');
            im.src = img; im.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;cursor:pointer';
            im.onclick = () => showLightbox(img);
            imgEl.appendChild(im);
          }
        }
        updateJobsBadge(); break;
      }
      if(d.status==='failed'){ toast('Job failed: '+(d.error||''),'err'); updateJobsBadge(); break; }
    }catch{}
    await sleep(3000);
  }
}

async function loadImage(jobId, index){
  try{
    const r = await fetch(`${API}/public/api/v1/jobs/${jobId}/image?index=${index}`,{headers:{'X-API-Key':KEY}});
    if(r.ok){
      const blob = await r.blob();
      if(blob.size > 100) return URL.createObjectURL(blob);
    }
  }catch{} return null;
}

async function loadImageRetry(jobId, index, retries){
  for(let i=0;i<retries;i++){
    const url = await loadImage(jobId, index);
    if(url) return url;
    await sleep(2000);
  }
  return null;
}

// ── Jobs list ──
function renderJobs(){
  const el = document.getElementById('jobsList');
  if(!jobs.length){ el.innerHTML='<p style="color:var(--text2);text-align:center;padding:30px">Chưa có jobs</p>'; return; }
  el.innerHTML = jobs.map(j => `
    <div class="job-item">
      <span class="jid">${j.id}</span>
      <span class="badge ${j.status==='completed'?'badge-ok':j.status==='failed'?'badge-err':'badge-run'}">${j.status}</span>
      <span style="font-size:11px;color:var(--accent)">${j.type}</span>
      <span class="jprompt">${j.prompts.join(' | ')}</span>
      <span style="font-size:11px;color:var(--text2)">${j.progress}%</span>
    </div>
  `).join('');
}
function updateJobsBadge(){
  const running = jobs.filter(j=>j.status==='queued'||j.status==='running').length;
  const b = document.getElementById('jobsBadge');
  if(running>0){ b.textContent=running; b.style.display='inline'; }
  else b.style.display='none';
}

// ── Library ──
let libItems = []; // [{job_id, index, quality, prompt, blobUrl}]

async function loadLibrary(){
  if(!API||!KEY) return openSettings();
  const el = document.getElementById('libGrid');
  el.innerHTML = '<p style="color:var(--text2);text-align:center;padding:30px;grid-column:1/-1">⏳ Đang tải...</p>';
  libItems = [];
  try{
    const r = await fetch(`${API}/public/api/v1/my-library?limit=200`,{headers:{'X-API-Key':KEY}});
    const d = await r.json();
    const imgs = d.images||[];
    if(!imgs.length){ el.innerHTML='<p style="color:var(--text2);text-align:center;padding:40px;grid-column:1/-1">Thư viện trống</p>'; return; }
    el.innerHTML = '';
    document.getElementById('libToolbar').style.display = 'flex';
    for(let idx=0; idx<imgs.length; idx++){
      const item = imgs[idx];
      if(item.status!=='completed') continue;
      const div = document.createElement('div');
      div.className = 'lib-item';
      div.dataset.idx = idx;
      div.innerHTML = `
        <div class="check" onclick="event.stopPropagation();toggleSelect(${idx})"></div>
        <button class="dl-btn" onclick="event.stopPropagation();downloadOne(${idx})" title="Tải ảnh">⬇</button>
        <div style="width:100%;aspect-ratio:1;background:var(--s2);display:flex;align-items:center;justify-content:center;color:var(--text2);font-size:12px">⏳</div>
        <div class="info">
          <span class="q">${item.quality||'1K'}</span>
          <div class="prompt-text">${item.prompt||item.job_id}</div>
        </div>
      `;
      el.appendChild(div);
      const libEntry = {job_id:item.job_id, index:item.index, quality:item.quality||'1K', prompt:item.prompt||'', blobUrl:null, el:div};
      libItems.push(libEntry);
      // Load async
      loadImageRetry(item.job_id, item.index, 2).then(url => {
        const placeholder = div.querySelector('div[style]');
        if(url){
          libEntry.blobUrl = url;
          const img = document.createElement('img');
          img.src = url;
          img.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover;display:block';
          placeholder.replaceWith(img);
          div.querySelector('img').onclick = () => showLightbox(url);
        } else { placeholder.textContent = '❌'; }
      });
    }
    updateSelectedCount();
  }catch(e){ el.innerHTML='<p style="color:var(--err);text-align:center;padding:30px;grid-column:1/-1">Lỗi: '+e.message+'</p>'; }
}

function toggleSelect(idx){
  const item = libItems[idx];
  if(!item) return;
  item.el.classList.toggle('selected');
  const chk = item.el.querySelector('.check');
  chk.textContent = item.el.classList.contains('selected') ? '✓' : '';
  updateSelectedCount();
}

function updateSelectedCount(){
  const n = document.querySelectorAll('.lib-item.selected').length;
  document.getElementById('selectedCount').textContent = n;
}

function toggleSelectAll(){
  const allSelected = libItems.every(i => i.el.classList.contains('selected'));
  libItems.forEach((item, idx) => {
    if(allSelected){ item.el.classList.remove('selected'); item.el.querySelector('.check').textContent=''; }
    else { item.el.classList.add('selected'); item.el.querySelector('.check').textContent='✓'; }
  });
  updateSelectedCount();
}

async function downloadOne(idx){
  const item = libItems[idx];
  if(!item) return;
  if(!item.blobUrl){
    item.blobUrl = await loadImageRetry(item.job_id, item.index, 2);
  }
  if(item.blobUrl) triggerDownload(item.blobUrl, `${item.prompt||item.job_id}_${item.quality}.png`);
  else toast('Ảnh chưa sẵn sàng','err');
}

async function downloadSelected(){
  const selected = libItems.filter((_,i) => libItems[i].el.classList.contains('selected'));
  if(!selected.length) return toast('Chọn ảnh trước','err');
  toast(`Đang tải ${selected.length} ảnh...`,'info');
  for(let i=0;i<selected.length;i++){
    const item = selected[i];
    if(!item.blobUrl) item.blobUrl = await loadImageRetry(item.job_id, item.index, 2);
    if(item.blobUrl) triggerDownload(item.blobUrl, `${(item.prompt||item.job_id).substring(0,30)}_${item.quality}_${i+1}.png`);
    await sleep(300);
  }
  toast(`Đã tải ${selected.length} ảnh`,'ok');
}

async function downloadAll(){
  if(!libItems.length) return toast('Thư viện trống','err');
  toast(`Đang tải ${libItems.length} ảnh...`,'info');
  for(let i=0;i<libItems.length;i++){
    const item = libItems[i];
    if(!item.blobUrl) item.blobUrl = await loadImageRetry(item.job_id, item.index, 2);
    if(item.blobUrl) triggerDownload(item.blobUrl, `${(item.prompt||item.job_id).substring(0,30)}_${item.quality}_${i+1}.png`);
    await sleep(300);
  }
  toast(`Đã tải ${libItems.length} ảnh`,'ok');
}

let _currentLbUrl = '';
function downloadCurrent(){
  if(_currentLbUrl) triggerDownload(_currentLbUrl, 'flow_ai_image.png');
}

function triggerDownload(blobUrl, filename){
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename.replace(/[^a-zA-Z0-9_\-\.]/g,'_');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Usage ──
async function loadUsage(){
  if(!API||!KEY) return;
  try{
    const r = await fetch(`${API}/public/api/v1/usage`,{headers:{'X-API-Key':KEY}});
    const d = await r.json();
    const cr = Math.max(0, d.credits_remaining ?? 0);
    const imgR = Math.max(0, d.image_remaining ?? 0);
    const days = Math.max(0, d.days_remaining ?? 0);
    const imgU = d.image_used ?? 0;
    const vidU = d.video_used ?? 0;
    const vidR = Math.max(0, d.video_remaining ?? 0);

    document.getElementById('uCredits').textContent = cr;
    document.getElementById('uCredits').style.color = cr <= 0 ? 'var(--err)' : '';
    document.getElementById('uImages').textContent = imgU;
    document.getElementById('uImgRemain').textContent = imgR;
    document.getElementById('uImgRemain').style.color = imgR <= 0 ? 'var(--err)' : '';
    document.getElementById('uDays').textContent = days;
    document.getElementById('uDays').style.color = days <= 0 ? 'var(--err)' : '';

    // Warnings
    const warns = [];
    if(cr <= 0) warns.push('⛔ Hết credits!');
    if(imgR <= 0 && (d.image_quota||0) > 0) warns.push('⛔ Hết quota ảnh!');
    if(vidR <= 0 && (d.video_quota||0) > 0) warns.push('⛔ Hết quota video!');
    if(days <= 0 && d.expires_at) warns.push('⛔ Key đã hết hạn!');

    const ubt = d.usage_by_type||{};
    const imgTotal = (imgU)+(imgR);
    const vidTotal = (vidU)+(vidR);
    document.getElementById('usageDetail').innerHTML = `
      ${warns.length ? `<div style="background:rgba(255,92,92,.15);border:1px solid var(--err);border-radius:8px;padding:10px;margin-bottom:12px;color:var(--err);font-weight:600;font-size:13px">${warns.join(' &nbsp; ')}<br><span style="font-weight:400;font-size:12px;color:var(--text2)">Liên hệ admin để nạp thêm</span></div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>📋 Plan: <strong>${d.plan||'-'}</strong></div>
        <div>💰 Credits: <strong style="color:${cr<=0?'var(--err)':''}">${cr}</strong> / ${cr+(d.credits_used||0)}</div>
        <div>🎨 Ảnh: <strong>${imgU}</strong> / ${imgTotal}</div>
        <div>🎬 Video: <strong>${vidU}</strong> / ${vidTotal}</div>
        <div>📅 Hôm nay: <strong>${d.usage_today||0}</strong> / ${d.rate_limit_daily||'-'}</div>
        <div>⏰ Hạn: <strong style="color:${days<=0&&d.expires_at?'var(--err)':''}">${d.expires_at ? new Date(d.expires_at).toLocaleDateString('vi-VN') : '∞'}</strong></div>
      </div>
      ${Object.keys(ubt).length ? `<div style="margin-top:12px;padding:10px;background:var(--s2);border-radius:8px">
        <div style="font-size:12px;font-weight:600;margin-bottom:6px">📊 Theo loại:</div>
        ${Object.entries(ubt).map(([k,v])=>`<span style="margin-right:12px">${k.toUpperCase()}: <strong>${v}</strong></span>`).join('')}
      </div>` : ''}
    `;
  }catch{}
}

// ── Utils ──
function showLightbox(src){
  _currentLbUrl = src;
  document.getElementById('lbImg').src = src;
  document.getElementById('lightbox').classList.add('show');
}
function toast(msg, type='info'){
  const t = document.createElement('div');
  t.className = 'toast '+type;
  t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(()=>t.remove(), 3000);
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
