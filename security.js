(() => {
  'use strict';
  const VAULT = 'remember-vault-v2';
  const LEGACY = 'remember-local-v1';
  const ITERATIONS = 310000;
  const TIMEOUT = 5 * 60 * 1000;
  const $ = id => document.getElementById(id);
  let key = null;
  let saltText = null;
  let saveQueue = Promise.resolve();
  let timer = null;
  let closing = false;

  const encode = bytes => {
    let str = '';
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str);
  };
  const decode = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
  const random = size => crypto.getRandomValues(new Uint8Array(size));

  async function derive(pass, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'}, material, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
  }
  async function encrypt(data, k, salt) {
    const iv = random(12);
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv}, k, bytes);
    return {version:2,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt,iv:encode(iv),ciphertext:encode(new Uint8Array(encrypted))};
  }
  async function decrypt(blob, k) {
    const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(blob.iv)},k,decode(blob.ciphertext));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  function showError(message) { $('securityError').textContent=message; $('securityError').hidden=false; }
  function modeSetup(isNew) {
    $('securityTitle').textContent = isNew ? 'Create your passphrase' : 'Unlock Remember';
    $('securityIntro').textContent = isNew ? 'Choose a strong passphrase to encrypt your memories on this device.' : 'Enter your passphrase to access your encrypted memories.';
    $('securitySubmit').textContent = isNew ? 'Create encrypted vault →' : 'Unlock Remember →';
    $('confirmPassWrap').hidden = !isNew;
    $('securityPass').autocomplete = isNew ? 'new-password' : 'current-password';
  }
  function resetTimer() {
    if (!key || closing) return;
    clearTimeout(timer);
    timer=setTimeout(lock, TIMEOUT);
  }
  async function lock() {
    if (closing) return;
    closing=true;
    clearTimeout(timer);
    $('appShell').hidden=true;
    $('securityGate').hidden=false;
    $('securityTitle').textContent='Locking Remember…';
    $('securityIntro').textContent='Finishing any pending encrypted saves.';
    $('securityForm').hidden=true;
    try { await saveQueue; } catch (_) { showError('A save failed. Your latest change may not have been stored.'); }
    key=null;
    window.rememberState=null;
    window.rememberPersist=null;
    location.reload(); // Fresh app.js closure on the next unlock; no old decrypted state reused.
  }
  function persist(data) {
    if (!key || closing) return Promise.reject(new Error('Vault locked'));
    const snapshot=JSON.parse(JSON.stringify(data));
    // Recover the queue after an error so a transient failure doesn't block all future saves.
    const next=saveQueue.catch(()=>{}).then(async()=>{
      if (!key) throw new Error('Vault locked');
      const blob=await encrypt(snapshot,key,saltText);
      localStorage.setItem(VAULT,JSON.stringify(blob));
    });
    saveQueue=next;
    return next;
  }
  function start(state,k,salt) {
    key=k; saltText=salt;
    window.rememberState=state;
    window.rememberPersist=persist;
    window.rememberLock=lock;
    $('securityGate').hidden=true;
    $('appShell').hidden=false;
    const script=document.createElement('script');
    script.src='./app.js';
    script.onerror=()=>{ $('appShell').hidden=true; $('securityGate').hidden=false; showError('Could not load Remember. Please refresh.'); };
    document.body.appendChild(script);
    resetTimer();
  }
  function initialize() {
    const form=$('securityForm');
    if (!crypto?.subtle) {
      showError('Encryption requires HTTPS or localhost.');
      $('securitySubmit').disabled=true;
      return;
    }
    const isNew=!localStorage.getItem(VAULT);
    modeSetup(isNew);
    if (isNew && localStorage.getItem(LEGACY)) {
      showError('Older unencrypted Remember data was found. Export it using the previous app before upgrading, then remove the old data. The new app will not overwrite it.');
      $('securitySubmit').disabled=true;
      return;
    }
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      $('securityError').hidden=true;
      const pass=$('securityPass').value;
      const button=$('securitySubmit');
      button.disabled=true;
      try {
        if (pass.length<10) throw new Error('Use a passphrase with at least 10 characters.');
        if (isNew) {
          if (pass!==$('confirmPass').value) throw new Error('Passphrases do not match.');
          const salt=random(16),saltString=encode(salt);
          const derived=await derive(pass,salt);
          const state={records:[],reminders:[],diaries:[]};
          const blob=await encrypt(state,derived,saltString);
          localStorage.setItem(VAULT,JSON.stringify(blob));
          start(state,derived,saltString);
        } else {
          const blob=JSON.parse(localStorage.getItem(VAULT));
          const derived=await derive(pass,decode(blob.salt));
          const state=await decrypt(blob,derived);
          start(state,derived,blob.salt);
        }
      } catch (err) {
        showError(isNew ? (err.message || 'Could not create vault.') : 'Unable to unlock. Check your passphrase.');
      } finally {
        $('securityPass').value='';
        $('confirmPass').value='';
        button.disabled=false;
      }
    });
    for (const eventName of ['pointerdown','keydown','touchstart']) {
      document.addEventListener(eventName,resetTimer,{passive:true});
    }
    document.addEventListener('visibilitychange',()=>{
      if (document.hidden && key) lock();
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize);
  else initialize();
})();
