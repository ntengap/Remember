(() => {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  let state = loadState();
  let activeFilter = "All";
  let reminderFilter = "open";
  let currentRecordId = null;
  let pendingDrafts = [];

  function loadState() {
    const data = window.rememberState;
    if (!data) throw new Error("Encrypted vault is locked.");
    return {
      records: Array.isArray(data.records) ? data.records : [],
      reminders: Array.isArray(data.reminders) ? data.reminders : [],
      diaries: Array.isArray(data.diaries) ? data.diaries : []
    };
  }
  function persist() {
    window.rememberPersist(state).catch(() => {
      toast("Encrypted save failed. Keep Remember open and retry.");
    });
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function niceDate(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "Date not set";
    const [y,m,d]=s.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(y,m-1,d)));
  }
  function toast(message) {
    const el=$("#toast"); el.textContent=message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2800);
  }
  function showPage(name) {
    $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${name}`));
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
    window.scrollTo({top:0,behavior:"smooth"});
    if(name==="home") renderHome();
    if(name==="memory") renderMemory();
    if(name==="reminders") renderReminders();
    if(name==="record") renderRecord();
  }
  document.addEventListener("click", e=>{
    const nav=e.target.closest("[data-page]");
    if(nav){e.preventDefault();showPage(nav.dataset.page);}
  });

  function symbol(category){return ({Location:"⌖",Change:"↻",Account:"◎",General:"▤"})[category]||"▤";}
  function recordCard(r, compact=false) {
    return `<div class="memory-row"><div class="memory-symbol">${symbol(r.category)}</div><div class="memory-body"><strong>${escapeHtml(r.title)}</strong><p>${escapeHtml(r.detail)}</p><div class="memory-meta">${escapeHtml(r.category)} · ${niceDate(r.updatedAt||r.date)} · ${r.verified?"Confirmed":"Needs confirmation"}</div></div><button class="row-action" data-open-record="${escapeHtml(r.id)}" aria-label="Open ${escapeHtml(r.title)}">›</button></div>`;
  }
  function reminderCard(r) {
    const overdue=!r.completed && r.due && r.due<today();
    return `<div class="panel"><div class="reminder-card"><div class="memory-symbol">${r.completed?"✓":"▦"}</div><div class="memory-body"><strong>${escapeHtml(r.title)}</strong><div class="reminder-due">${r.completed?"Completed":overdue?"Overdue · ":"Due "}${niceDate(r.due)}</div><div class="reminder-interval">${escapeHtml(intervalLabel(r.interval))}${r.completed&&r.completedAt?` · Completed ${niceDate(r.completedAt)}`:""}</div>${!r.completed?`<button class="secondary small" data-complete-reminder="${escapeHtml(r.id)}">Mark complete${r.interval!=="none"?" & schedule next":""}</button>`:`<button class="secondary small" data-reopen-reminder="${escapeHtml(r.id)}">Reopen</button>`}</div></div></div>`;
  }
  function intervalLabel(i){return ({none:"One time only",weekly:"Every week",monthly:"Every month",quarterly:"Every 3 months",halfyear:"Every 6 months",yearly:"Every year"})[i]||i;}
  function renderHome(){
    $("#statLocations").textContent=state.records.filter(r=>r.category==="Location").length;
    $("#statChanges").textContent=state.records.filter(r=>r.category==="Change").length;
    $("#statAccounts").textContent=state.records.filter(r=>r.category==="Account").length;
    $("#statReminders").textContent=state.reminders.filter(r=>!r.completed).length;
    const recent=state.records.slice().sort((a,b)=>(b.updatedAt||b.date||"").localeCompare(a.updatedAt||a.date||"")).slice(0,4);
    $("#recentMemories").innerHTML=recent.length?recent.map(r=>recordCard(r,true)).join(""):`<div class="empty-state">Your memory is ready when you are.<br>Start with a diary entry to save your first detail.</div>`;
    const upcoming=state.reminders.filter(r=>!r.completed).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999")).slice(0,3);
    $("#upcomingReminders").innerHTML=upcoming.length?upcoming.map(reminderCard).join(""):`<div class="empty-state">No open reminders. Add one whenever something needs repeating.</div>`;
  }
  function renderMemory(){
    const query=$("#memorySearch").value.trim().toLowerCase();
    const items=state.records.filter(r=>(activeFilter==="All"||r.category===activeFilter)&&(!query||[r.title,r.detail,r.category,...(r.tags||[])].join(" ").toLowerCase().includes(query))).sort((a,b)=>(b.updatedAt||b.date||"").localeCompare(a.updatedAt||a.date||""));
    $("#memoryList").innerHTML=items.length?items.map(r=>`<div class="panel">${recordCard(r)}</div>`).join(""):`<div class="panel empty-state">${query?"No matching memories. Try another word.":"No memories in this category yet. Capture a note in your diary."}</div>`;
  }
  function renderRecord(){
    const r=state.records.find(x=>x.id===currentRecordId);
    if(!r){$("#recordDetail").innerHTML='<div class="panel empty-state">This record no longer exists.</div>';return;}
    $("#recordDetail").innerHTML=`<div class="memory-symbol">${symbol(r.category)}</div><h1 class="record-title">${escapeHtml(r.title)}</h1><div class="record-subtitle">${escapeHtml(r.category)} · Recorded ${niceDate(r.date)} · ${r.verified?"Confirmed":"Needs confirmation"}</div><div class="panel"><div class="record-field"><label>Title</label><input id="editRecordTitle" maxlength="120" value="${escapeHtml(r.title)}"></div><div class="record-field"><label>Category</label><select id="editRecordCategory">${["Location","Change","Account","General"].map(c=>`<option ${c===r.category?"selected":""}>${c}</option>`).join("")}</select></div><div class="record-field"><label>Details</label><textarea id="editRecordDetail" rows="5">${escapeHtml(r.detail)}</textarea></div><div class="record-field"><label>Date of event</label><input id="editRecordDate" type="date" value="${escapeHtml(r.date||today())}"></div><div class="record-field"><label>Verification</label><select id="editRecordVerified"><option value="false" ${!r.verified?"selected":""}>Needs confirmation</option><option value="true" ${r.verified?"selected":""}>Confirmed</option></select></div><button class="primary" id="saveRecordBtn" style="margin-top:18px">Save changes <span>→</span></button><button class="danger" id="deleteRecordBtn" style="margin-top:10px;width:100%">Delete this record</button></div>${r.history?.length?`<div class="panel"><h2 class="form-title">History</h2>${r.history.map(h=>`<div class="record-field"><label>${niceDate(h.date)}</label><p>${escapeHtml(h.detail)}</p></div>`).join("")}</div>`:""}`;
    $("#saveRecordBtn").onclick=()=>{
      const old=state.records.find(x=>x.id===currentRecordId);
      const detail=$("#editRecordDetail").value.trim();
      if(old.detail!==detail){old.history=old.history||[];old.history.unshift({date:today(),detail:old.detail});}
      old.title=$("#editRecordTitle").value.trim()||"Untitled memory";old.category=$("#editRecordCategory").value;old.detail=detail;old.date=$("#editRecordDate").value||today();old.verified=$("#editRecordVerified").value==="true";old.updatedAt=today();
      persist();toast("Memory updated.");showPage("memory");
    };
    $("#deleteRecordBtn").onclick=()=>confirmAction("Delete this memory?","This record will be removed from this device.",()=>{state.records=state.records.filter(x=>x.id!==currentRecordId);persist();toast("Memory deleted.");showPage("memory");});
  }
  document.addEventListener("click",e=>{
    const open=e.target.closest("[data-open-record]");
    if(open){currentRecordId=open.dataset.openRecord;showPage("record");}
    const complete=e.target.closest("[data-complete-reminder]");
    if(complete){const r=state.reminders.find(x=>x.id===complete.dataset.completeReminder);if(!r)return;r.completedAt=today();if(r.interval!=="none"){r.due=addInterval(r.due,r.interval);r.completed=false;}else{r.completed=true;}persist();renderReminders();renderHome();toast(r.interval==="none"?"Reminder completed.":"Done. Next occurrence scheduled.");}
    const reopen=e.target.closest("[data-reopen-reminder]");
    if(reopen){const r=state.reminders.find(x=>x.id===reopen.dataset.reopenReminder);if(r){r.completed=false;r.completedAt=null;persist();renderReminders();renderHome();toast("Reminder reopened.");}}
  });

  // Month-safe date arithmetic: Jan 31 + one month becomes the last valid day in February.
  function addInterval(date, interval){
    const [y,m,d]=date.split("-").map(Number);const out=new Date(Date.UTC(y,m-1,d,12));
    if(interval==="weekly"){out.setUTCDate(out.getUTCDate()+7);return out.toISOString().slice(0,10);}
    let months=interval==="monthly"?1:interval==="quarterly"?3:interval==="halfyear"?6:interval==="yearly"?12:0;
    if(!months)return date;
    out.setUTCDate(1);out.setUTCMonth(out.getUTCMonth()+months);
    const last=new Date(Date.UTC(out.getUTCFullYear(),out.getUTCMonth()+1,0)).getUTCDate();
    out.setUTCDate(Math.min(d,last));return out.toISOString().slice(0,10);
  }
  function renderReminders(){
    const items=state.reminders.filter(r=>reminderFilter==="all"||(reminderFilter==="completed"?r.completed:!r.completed)).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"));
    $("#reminderList").innerHTML=items.length?items.map(reminderCard).join(""):`<div class="panel empty-state">Nothing here right now.</div>`;
  }
  function classify(text){
    const t=text.toLowerCase();
    const result=[];
    const rules=[
      {category:"Location",re:/\b(passport|keys?|wallet|card|document|paperwork|folder|drawer|safe|bag|laptop|charger|glasses|spare|put|moved|move|stored|left|kept|placed)\b/},
      {category:"Account",re:/\b(sign(?:ed)? up|signup|account|website|web site|subscription|username|email address|registered|login)\b/},
      {category:"Change",re:/\b(changed|change|updated|renewed|replaced|paid|cancelled|canceled|bought|sold|PIN|filter|serviced|installed|reset)\b/}
    ];
    rules.forEach(rule=>{if(rule.re.test(t))result.push(rule.category);});
    return result.length?[...new Set(result)]:["General"];
  }
  function makeDrafts(text){
    const sentences=text.split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);
    const chunks=sentences.length?sentences:[text.trim()];
    return chunks.map(s=>({title:s.length>58?s.slice(0,55).trim()+"…":s,detail:s,category:classify(s)[0],date:today(),verified:false,keep:true}));
  }
  function renderDrafts(){
    const area=$("#draftArea");area.hidden=false;
    area.innerHTML=`<div class="draft-heading"><div><div class="eyebrow">REVIEW BEFORE SAVING</div><h2>Here's what I found</h2></div><span class="memory-meta">${pendingDrafts.filter(d=>d.keep).length} notes</span></div>
      <div class="soft-panel panel">These are suggestions, not guaranteed AI interpretations. Edit each note, choose the right category, and remove anything that doesn't belong before saving.</div>
      ${pendingDrafts.map((d,i)=>`<div class="draft-card" data-draft="${i}"><div class="draft-top"><strong>Memory ${i+1}</strong><label style="display:flex;align-items:center;gap:6px;margin:0;font-weight:500"><input type="checkbox" data-keep="${i}" ${d.keep?"checked":""} style="width:auto"> Save this</label></div><label>Title</label><input data-title="${i}" maxlength="120" value="${escapeHtml(d.title)}"><label>Category</label><select data-category="${i}">${["Location","Change","Account","General"].map(c=>`<option ${c===d.category?"selected":""}>${c}</option>`).join("")}</select><label>Details</label><textarea data-detail="${i}" rows="3">${escapeHtml(d.detail)}</textarea><label>Event date</label><input type="date" data-date="${i}" value="${d.date}"></div>`).join("")}
      <button class="primary" id="saveDraftsBtn">Save selected memories <span>→</span></button><button class="secondary full-width" id="discardDraftsBtn">Discard draft</button>`;
    area.querySelectorAll("[data-title]").forEach(el=>el.addEventListener("input",()=>pendingDrafts[+el.dataset.title].title=el.value));
    area.querySelectorAll("[data-detail]").forEach(el=>el.addEventListener("input",()=>pendingDrafts[+el.dataset.detail].detail=el.value));
    area.querySelectorAll("[data-category]").forEach(el=>el.addEventListener("change",()=>pendingDrafts[+el.dataset.category].category=el.value));
    area.querySelectorAll("[data-date]").forEach(el=>el.addEventListener("change",()=>pendingDrafts[+el.dataset.date].date=el.value));
    area.querySelectorAll("[data-keep]").forEach(el=>el.addEventListener("change",()=>pendingDrafts[+el.dataset.keep].keep=el.checked));
    $("#saveDraftsBtn").onclick=()=>{
      const toSave=pendingDrafts.filter(d=>d.keep);
      toSave.forEach(d=>state.records.push({id:uid(),title:d.title.trim()||"Untitled memory",category:d.category,detail:d.detail.trim(),date:d.date||today(),updatedAt:today(),verified:false,history:[]}));
      if(toSave.length){state.diaries.push({id:uid(),date:today(),text:$("#diaryText").value.trim(),savedCount:toSave.length});persist();}
      $("#diaryText").value="";pendingDrafts=[];area.hidden=true;area.innerHTML="";toast(`${toSave.length} memory record${toSave.length===1?"":"s"} saved.`);showPage("memory");
    };
    $("#discardDraftsBtn").onclick=()=>{pendingDrafts=[];area.hidden=true;area.innerHTML="";};
  }
  $("#diaryForm").addEventListener("submit",e=>{
    e.preventDefault();const text=$("#diaryText").value.trim();if(!text)return;
    pendingDrafts=makeDrafts(text);renderDrafts();$("#draftArea").scrollIntoView({behavior:"smooth",block:"start"});
  });
  $("#memorySearch").addEventListener("input",renderMemory);
  $("#memoryFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;activeFilter=b.dataset.filter;$$(".filter",$("#memoryFilters")).forEach(x=>x.classList.toggle("active",x===b));renderMemory();});
  $("#reminderFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;reminderFilter=b.dataset.filter;$$(".filter",$("#reminderFilters")).forEach(x=>x.classList.toggle("active",x===b));renderReminders();});
  function updateNextPreview(){
    const date=$("#reminderDate").value,interval=$("#reminderInterval").value;
    $("#nextDatePreview").textContent=!date?"Choose a date to preview the next occurrence.":interval==="none"?"One-time reminder on "+niceDate(date)+".":"Next occurrence after "+niceDate(date)+": "+niceDate(addInterval(date,interval))+".";
  }
  $("#reminderDate").value=today();$("#reminderDate").min="";$("#reminderDate").addEventListener("change",updateNextPreview);$("#reminderInterval").addEventListener("change",updateNextPreview);updateNextPreview();
  $("#reminderForm").addEventListener("submit",e=>{
    e.preventDefault();const title=$("#reminderTitle").value.trim(),due=$("#reminderDate").value,interval=$("#reminderInterval").value;
    if(!title||!due)return;
    state.reminders.push({id:uid(),title,due,interval,completed:false,createdAt:today()});persist();$("#reminderTitle").value="";$("#reminderDate").value=today();$("#reminderInterval").value="quarterly";updateNextPreview();renderReminders();renderHome();toast("Reminder saved on this device.");
  });
  function confirmAction(title,message,onConfirm){
    const dlg=$("#confirmDialog");$("#dialogTitle").textContent=title;$("#dialogMessage").textContent=message;
    const btn=$("#dialogConfirm");const handler=e=>{if(e.submitter?.value==="confirm")onConfirm();};dlg.querySelector("form").addEventListener("submit",handler,{once:true});dlg.showModal();
  }
  $("#clearBtn").addEventListener("click",()=>confirmAction("Delete all Remember data?","This permanently deletes all memories, diary index entries and reminders from this browser. Export a backup first if you may need it.",()=>{state={records:[],reminders:[],diaries:[]};persist();renderHome();renderMemory();renderReminders();toast("All local Remember data deleted.");}));
  $("#lockNowBtn").addEventListener("click", () => window.rememberLock());
  $("#exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({app:"Remember",version:1,exportedAt:new Date().toISOString(),...state},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`remember-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);toast("Plaintext backup exported. Store it securely.");
  });
  $("#importBtn").addEventListener("click",()=>$("#importFile").click());
  $("#importFile").addEventListener("change",async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      if(!parsed||!Array.isArray(parsed.records)||!Array.isArray(parsed.reminders))throw new Error("This doesn't look like a Remember backup.");
      confirmAction("Import this backup?","Importing replaces the current local records and reminders. Export your current data first if you need a copy.",()=>{state={records:parsed.records,reminders:parsed.reminders,diaries:Array.isArray(parsed.diaries)?parsed.diaries:[]};persist();renderHome();renderMemory();renderReminders();toast("Backup imported.");});
    }catch(err){toast(err.message||"Could not import that file.");}
    e.target.value="";
  });
  // Install prompt is available only in browsers that support it.
  let installPrompt=null;
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn").hidden=false;});
  $("#installBtn").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn").hidden=true;});
  window.addEventListener("appinstalled",()=>toast("Remember installed."));
  if("serviceWorker" in navigator && location.protocol!=="file:"){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }
  renderHome();renderMemory();renderReminders();
})();