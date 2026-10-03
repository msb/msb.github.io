import {GOOGLE_CLIENT_ID} from './config.js';
import {DRIVE_SCOPE, createFolderReader, createSessionStore, viewportGrid, createGridStore, createFilePool} from './drive.js';

const $ = id => document.getElementById(id);
let client;
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

const session = createSessionStore(GOOGLE_CLIENT_ID);
let rememberedFolderId = session.loadFolder();
$('folder').value = rememberedFolderId;
const status = message => { $('status').textContent = message; };

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
  $('connect').disabled = !client || busy || authorizing;
  $('connect').textContent = token ? 'Change Google account' : 'Connect with Google';
  $('disconnect').hidden = !token;
  $('revoke').hidden = !token;
  $('disconnect').disabled = authorizing;
  $('revoke').disabled = authorizing;
  $('folder').disabled = !token || busy || authorizing;
  $('load').disabled = !token || busy || authorizing;
  $('refresh').disabled = !token || busy || authorizing;
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
  update();
}
function persist() {
  const saved = session.save({token, expiresAt, folderId:folder?.id || ''});
  $('storage-note').hidden = saved;
}
function armExpiry() {
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => {
    reset(); status('Google connection expired. Connect again.');
  }, Math.max(0, expiresAt - Date.now()));
}
function requireConnection() {
  if (!token || Date.now() >= expiresAt) {
    reset();
    throw new Error('Google connection expired. Connect again.');
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

$('connect').addEventListener('click', () => {
  reset(); authorizing = true; update();
  status('Complete the Google permission prompt.');
  try { client.requestAccessToken({prompt:'select_account', include_granted_scopes:false}); }
  catch(error) { authorizing = false; status(error.message); update(); }
});
$('disconnect').addEventListener('click', () => {
  reset(); status('Disconnected. Token cleared; folder remembered. Google permission remains until revoked.');
});
$('revoke').addEventListener('click', () => {
  const accessToken = token;
  reset();
  authorizing = true; update();
  status('Revoking Google access…');
  let completed = false;
  const timeout = setTimeout(() => {
    completed = true; authorizing = false; update();
    status('Disconnected. Could not confirm revocation; remove access in your Google Account settings.');
  }, 10000);
  google.accounts.oauth2.revoke(accessToken, response => {
    if (completed) return;
    clearTimeout(timeout); authorizing = false; update();
    status(response?.successful ? 'Google access revoked.' : 'Disconnected. Remove access in Google Account settings if revocation failed.');
  });
});
$('folder-form').addEventListener('submit', event => { event.preventDefault(); if (!busy) void readFolder(true); });
$('refresh').addEventListener('click', () => { if (!busy) void readFolder(); });
window.addEventListener('focus', () => {
  if (token && Date.now() >= expiresAt) { reset(); status('Google connection expired. Connect again.'); }
});

async function initialize() {
  if (!GOOGLE_CLIENT_ID) {
    $('setup').hidden = false;
    status('Google connection has not been configured yet.');
    return;
  }
  try {
    await new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection or browser settings.'));
      document.head.append(script);
    });
    client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      include_granted_scopes: false,
      callback: response => {
        authorizing = false;
        if (response.error) { status('Google connection was not completed: ' + response.error); update(); return; }
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
          status('Read-only Drive permission was not granted.'); update(); return;
        }
        const lifetime = Number(response.expires_in);
        if (!response.access_token || !Number.isFinite(lifetime) || lifetime <= 0) {
          status('Google returned an invalid connection. Try again.'); update(); return;
        }
        token = response.access_token;
        expiresAt = Date.now() + lifetime * 1000;
        reader = createFolderReader(token);
        armExpiry();
        persist();
        status('Connected to Google. Paste your album folder link to continue.');
        update();
      },
      error_callback: error => {
        authorizing = false;
        status(error.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Could not open Google sign-in. Allow popups and try again.');
        update();
      },
    });
    const saved = session.load();
    if (saved) {
      token = saved.token;
      expiresAt = saved.expiresAt;
      reader = createFolderReader(token);
      armExpiry();
      update();
      if (saved.folderId) {
        $('folder').value = saved.folderId;
        await readFolder(true);
      } else {
        status('Google connection restored. Paste your album folder link to continue.');
      }
    } else {
      status('Connect with Google to choose your album folder.');
      update();
    }
  } catch(error) { status(error.message); }
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








