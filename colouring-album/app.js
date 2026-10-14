import {DRIVE_SCOPE, createFolderReader, createSessionStore, viewportGrid, createGridStore, createFilePool, parseFolderId} from './drive.js';

const $ = id => document.getElementById(id);
let client;
const CLIENT_ID_KEY = 'colouring-album.client-id.v1';
let clientId = '';
try { clientId = localStorage.getItem(CLIENT_ID_KEY) || ''; } catch {}
let authVersion = 0;
let googleScript;
let token = '';
let expiresAt = 0;
let expiryTimer;
let reader;
let folder;
let filePool;
let poolController;
const imageUrls = new Set();
let busy = false;
let authorizing = false;
let controller;
let generation = 0;
let displayedCapacity = 0;
const gridStore = createGridStore();
let gridSettings = gridStore.load();
function gridControls() {
  $('grid-axis').value = gridSettings.axis;
  $('grid-count-label').textContent = gridSettings.axis === 'rows' ? 'Rows' : 'Columns';
  $('grid-count').value = gridSettings[gridSettings.axis];
}
gridControls();
function applyGridLayout() {
  const layout = viewportGrid(window.innerWidth, window.innerHeight, gridSettings);
  $('files').style.setProperty('--tile-size', layout.tileSize + 'px');
  $('files').style.setProperty('--grid-columns', Math.max(1,layout.columns));
  $('files').style.setProperty('--grid-rows', Math.max(1,layout.rows));
  $('grid-note').textContent = layout.capacity
    ? 'Square images fill the chosen axis and are centered on the other.'
    : 'Increase the chosen count so at least one square image fits on the other axis.';
  return layout;
}
$('grid-axis').addEventListener('change', () => {
  const current = Number($('grid-count').value);
  if (Number.isInteger(current) && current >= 1 && current <= 100) gridSettings[gridSettings.axis] = current;
  gridSettings.axis = $('grid-axis').value;
  gridControls();
});
$('grid-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!$('grid-count').checkValidity()) return;
  gridSettings[gridSettings.axis] = Number($('grid-count').value);
  if (!gridStore.save(gridSettings)) $('grid-note').textContent = 'Browser storage is unavailable; layout will not be remembered.';
  resizeGrid();
});

let session = createSessionStore(clientId);
$('client-id').value = clientId;
let rememberedFolderId = session.loadFolder();
$('folder').value = rememberedFolderId;
const status = message => { $('status').textContent = message; };
function promptForClientId() {
  status($('folder').value.trim()
    ? 'Enter your Google OAuth client ID to start.'
    : 'Enter your Google OAuth client ID and Drive folder to start.');
}

const drivePanel = $('drive-panel');
const driveToggle = $('drive-toggle');
function toggleDrivePanel(open) {
  drivePanel.hidden = !open;
  driveToggle.setAttribute('aria-expanded', String(open));
  driveToggle.setAttribute('aria-label', open ? 'Close Drive settings' : 'Drive settings');
  if (open) drivePanel.focus();
}
driveToggle.addEventListener('click', () => toggleDrivePanel(drivePanel.hidden));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !drivePanel.hidden) {
    toggleDrivePanel(false);
    driveToggle.focus();
  }
});
document.addEventListener('click', event => {
  if (!drivePanel.hidden && !drivePanel.contains(event.target) && !driveToggle.contains(event.target)) {
    toggleDrivePanel(false);
  }
});

function update() {
  $('folder').disabled = authorizing;
  $('client-id').disabled = authorizing;
  $('load').disabled = !client || authorizing || busy;
  $('load').hidden = !rememberedFolderId || !client || authorizing || Boolean(token && Date.now() < expiresAt);
}
function reset() {
  poolController?.abort(); filePool = null;
      $('pool-count').textContent = 'Pool: 0 files';
  session.clear();
  generation++;
  controller?.abort();
  controller = null;
  clearTimeout(expiryTimer);
  token = ''; expiresAt = 0; reader = null; folder = null;
  busy = false;
  $('folder').value = rememberedFolderId;
  clearGrid();
  $('album').hidden = true;
  update();
}
function persist() {
  const saved = session.save({token, expiresAt, folderId:rememberedFolderId});
  $('storage-note').hidden = saved;
}
function armExpiry() {
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => {
    reset(); status('Google connection expired. Choose Continue with Google in settings.');
  }, Math.max(0, expiresAt - Date.now()));
}
function requireConnection() {
  if (!token || Date.now() >= expiresAt) {
    reset();
    throw new Error('Google connection expired. Choose Continue with Google in settings.');
  }
}
function clearGrid() {
  $('files').replaceChildren();
  for (const url of imageUrls) URL.revokeObjectURL(url);
  imageUrls.clear();
}
function cyclePause(signal) {
  return new Promise((resolve,reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(() => { signal.removeEventListener('abort',abort); resolve(); },1000);
    function abort() { clearTimeout(timer); reject(signal.reason); }
    signal.addEventListener('abort',abort,{once:true});
  });
}
async function loadImage(file, signal) {
  const blob = await reader.image(file.id, signal);
  signal.throwIfAborted();
  const url = URL.createObjectURL(blob);
  imageUrls.add(url);
  const image = document.createElement('img');
  image.alt = file.name;
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
    signal.throwIfAborted();
    return {image,url};
  } catch(error) {
    URL.revokeObjectURL(url); imageUrls.delete(url);
    throw error;
  }
}
async function crossfade(tile, next, signal) {
  const previous = tile.querySelector('img');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  tile.append(next.image);
  if (reducedMotion || !previous) {
    signal.throwIfAborted();
    tile.replaceChildren(next.image);
    return;
  }
  const options = {duration:600, easing:'ease-in-out', fill:'forwards'};
  const animations = [
    previous.animate([{opacity:1},{opacity:0}], options),
    next.image.animate([{opacity:0},{opacity:1}], options),
  ];
  const cancel = () => animations.forEach(animation => animation.cancel());
  signal.addEventListener('abort',cancel,{once:true});
  try {
    signal.throwIfAborted();
    await Promise.all(animations.map(animation => animation.finished));
    signal.throwIfAborted();
    tile.replaceChildren(next.image);
  } catch(error) {
    next.image.remove();
    URL.revokeObjectURL(next.url); imageUrls.delete(next.url);
    throw error;
  } finally {
    signal.removeEventListener('abort',cancel);
    cancel();
  }
}
async function renderImages(pool, capacity, run, signal) {
  clearGrid();
  const used = new Set();
  const failed = new Set();
  const slots = [];
  async function pick() {
    // Selection reserves in this temporary set; used represents displayed images only.
    return pool.pick(new Set([...used,...failed]),signal);
  }
  async function cycle() {
    while (run === generation && !signal.aborted) {
      await cyclePause(signal);
      const slot = slots[Math.floor(Math.random()*slots.length)];
      const file = await pick();
      if (!file) return; // No unseen image available: keep the current grid.
      try {
        const next = await loadImage(file,signal);
        if (run !== generation || signal.aborted) {
          URL.revokeObjectURL(next.url); imageUrls.delete(next.url); return;
        }
        await crossfade(slot.tile, next, signal);
        used.delete(slot.file.id);
        used.add(file.id);
        URL.revokeObjectURL(slot.url); imageUrls.delete(slot.url);
        Object.assign(slot,{file,url:next.url});
      } catch(error) {
        if (signal.aborted || error.status===401) throw error;
        failed.add(file.id);
      }
    }
  }
  for (let index=0; index<capacity; index++) {
    const tile=document.createElement('li');
    const message=document.createElement('span');
    message.className='image-state'; message.textContent='Loading image...';
    tile.append(message); $('files').append(tile);
    while (true) {
      const file=await pick();
      if (!file || run!==generation || signal.aborted) { tile.remove(); return slots.length; }
      try {
        const next=await loadImage(file,signal);
        if (run!==generation || signal.aborted) {
          URL.revokeObjectURL(next.url); imageUrls.delete(next.url); return slots.length;
        }
        tile.replaceChildren(next.image);
        used.add(file.id);
        slots.push({tile,file,url:next.url});
        break;
      } catch(error) {
        if (signal.aborted || error.status===401) throw error;
        failed.add(file.id);
      }
    }
  }
  if (slots.length) {
    void cycle().catch(error => {
      if (run!==generation || signal.aborted) return;
      if (error.status===401) reset();
      status(error.message);
    });
  }
  return slots.length;
}
async function readFolder(newSelection = false) {
  const run = ++generation;
  controller?.abort();
  controller = new AbortController();
  busy = true; update();
  try {
    requireConnection();
    if (newSelection) {
      poolController?.abort(); filePool = null;
      $('pool-count').textContent = 'Pool: 0 files';
      folder = null; persist(); clearGrid(); $('album').hidden = true;
      status('Checking your folder…');
      const selected = await reader.select($('folder').value, controller.signal);
      if (run !== generation) return;
      folder = selected;
      rememberedFolderId = selected.id;
      $('folder').value = rememberedFolderId;
      persist();
    }
    if (!folder) throw new Error('Choose a folder first.');
    if (!filePool) {
      poolController = new AbortController();
      const collectionController = poolController;
      const pool = createFilePool(reader, collectionController.signal, Math.random, count => {
        if (!collectionController.signal.aborted) {
          $('pool-count').textContent = 'Pool: ' + count + (count === 1 ? ' file' : ' files');
        }
      });
      filePool = pool;
      void pool.completion.then(() => {
        if (filePool !== pool || !pool.error || poolController.signal.aborted) return;
        if (pool.error.status === 401) reset();
        status(pool.error.message);
      });
    }
    status('Collecting folder files and filling images one at a time...');
    const layout = applyGridLayout();
    displayedCapacity = layout.capacity;
    $('album').hidden = false;
    const shown = await renderImages(filePool, layout.capacity, run, controller.signal);
    if (run !== generation) return;
    status(shown ? 'Showing ' + shown + ' randomly selected images. Folder collection continues in the background.' : 'No readable images found.');
  } catch(error) {
    if (run !== generation || error.name === 'AbortError') return;
    if (error.status === 401) reset();
    status(error.message);
  } finally {
    if (run === generation) { busy = false; update(); }
  }
}

function authFailed(message) {
  authorizing = false;
  status(message);
  toggleDrivePanel(true);
  update();
}
function startAuth() {
  if (!rememberedFolderId || !client || authorizing) return;
  reset();
  authorizing = true; update();
  status('Complete the Google permission prompt.');
  try { client.requestAccessToken({prompt:'', include_granted_scopes:false}); }
  catch { authFailed('Google sign-in needs a click. Choose Continue with Google.'); }
}
function clearFolder() {
  const accessToken = token;
  reset();
  rememberedFolderId = '';
  session.forgetFolder();
  $('folder').value = '';
  toggleDrivePanel(true);
  if (!accessToken || !window.google?.accounts?.oauth2) {
    status('Folder forgotten. No active token is available to revoke; remove any remaining grant in your Google Account connections.');
    return;
  }
  authorizing = true; update();
  status('Folder forgotten. Revoking Google access...');
  let completed = false;
  const timeout = setTimeout(() => {
    completed = true;
    authFailed('Folder forgotten. Could not confirm revocation; remove access in Google Account connections.');
  },10000);
  try {
    google.accounts.oauth2.revoke(accessToken,response => {
      if (completed) return;
      completed = true; clearTimeout(timeout);
      authorizing = false; update();
      status(response?.successful ? 'Folder forgotten and Google access revoked.' : 'Folder forgotten. Revocation failed; remove access in Google Account connections.');
    });
  } catch {
    completed = true; clearTimeout(timeout);
    authFailed('Folder forgotten. Revocation failed; remove access in Google Account connections.');
  }
}
function acceptFolder() {
  const value = $('folder').value.trim();
  if (!value) { clearFolder(); return; }
  let id;
  try { id = parseFolderId(value); }
  catch(error) { status(error.message); return; }
  rememberedFolderId = id;
  session.saveFolder(id);
  $('folder').value = id;
  if (!clientId) { promptForClientId(); return; }
  if (!token || Date.now() >= expiresAt) startAuth();
  else { persist(); toggleDrivePanel(false); void readFolder(true); }
}
$('folder-form').addEventListener('submit',event => {
  event.preventDefault();
  if (!authorizing && !busy) acceptFolder();
});
$('folder').addEventListener('input', () => {
  if (!$('folder').value.trim() && rememberedFolderId) clearFolder();
  else if (!clientId) promptForClientId();
});
$('folder').addEventListener('change', () => {
  if ($('folder').value.trim() && !authorizing && !busy) acceptFolder();
});
$('folder').addEventListener('paste',event => {
  const value = event.clipboardData?.getData('text').trim();
  if (!value || authorizing || busy) return;
  try { parseFolderId(value); } catch { return; }
  event.preventDefault();
  $('folder').value = value;
  acceptFolder();
});
$('client-id').addEventListener('change', () => {
  const value = $('client-id').value.trim();
  if (value === clientId) return;
  if (value && !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value)) {
    status('Enter a Google OAuth web client ID ending in .apps.googleusercontent.com.');
    return;
  }
  authVersion++;
  reset();
  client = undefined;
  clientId = value;
  $('client-id').value = value;
  try {
    if (value) localStorage.setItem(CLIENT_ID_KEY,value);
    else localStorage.removeItem(CLIENT_ID_KEY);
  } catch { $('storage-note').hidden = false; }
  session = createSessionStore(clientId);
  void initialize();
});
window.addEventListener('focus', () => {
  if (token && Date.now() >= expiresAt) { reset(); status('Google connection expired. Choose Continue with Google in settings.'); }
});

async function initialize() {
  const version = authVersion;
  toggleDrivePanel(!rememberedFolderId || !clientId);
  update();
  if (!clientId) {
    promptForClientId();
    return;
  }
  try {
    googleScript ??= new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => { googleScript = undefined; reject(new Error('Could not load Google sign-in. Check your connection or browser settings.')); };
      document.head.append(script);
    });
    await googleScript;
    if (version !== authVersion) return;
    client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      include_granted_scopes: false,
      callback: response => {
        if (version !== authVersion) return;
        authorizing = false;
        if (response.error) { authFailed('Google connection was not completed: ' + response.error); return; }
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
          authFailed('Read-only Drive permission was not granted.'); return;
        }
        const lifetime = Number(response.expires_in);
        if (!response.access_token || !Number.isFinite(lifetime) || lifetime <= 0) {
          authFailed('Google returned an invalid connection. Choose Continue with Google.'); return;
        }
        token = response.access_token;
        expiresAt = Date.now() + lifetime * 1000;
        reader = createFolderReader(token);
        armExpiry();
        persist();
        update();
        if (rememberedFolderId) { toggleDrivePanel(false); void readFolder(true); }
        else { clearFolder(); }
      },
      error_callback: error => {
        if (version !== authVersion) return;
        authFailed(error.type === 'popup_closed' ? 'Google sign-in was cancelled. Choose Continue with Google to retry.' : 'Google sign-in needs a click. Choose Continue with Google.');
      },
    });
    const saved = session.load();
    if (saved) {
      token = saved.token;
      expiresAt = saved.expiresAt;
      reader = createFolderReader(token);
      armExpiry();
      update();
      if (rememberedFolderId) {
        $('folder').value = rememberedFolderId;
        await readFolder(true);
      } else {
        status('Google connection restored. Paste your album folder link to continue.');
      }
    } else {
      status('Enter your Google Drive folder to start.');
      update();
      if (rememberedFolderId) startAuth();
    }
  } catch(error) { if (version === authVersion) authFailed(error.message); }
}
void initialize();





let resizeTimer;
function resizeGrid() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const layout = applyGridLayout();

    if (!folder || !token || layout.capacity === displayedCapacity) return;
    if (busy) { resizeGrid(); return; }
    void readFolder();
  }, 200);
}
window.addEventListener('resize', resizeGrid);
