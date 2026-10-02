import {GOOGLE_CLIENT_ID} from './config.js';
import {DRIVE_SCOPE, createFolderReader, createSessionStore} from './drive.js';

const $ = id => document.getElementById(id);
let client;
let token = '';
let expiresAt = 0;
let expiryTimer;
let reader;
let folder;
const imageUrls = new Set();
let busy = false;
let authorizing = false;
let controller;
let generation = 0;

const session = createSessionStore(GOOGLE_CLIENT_ID);
const status = message => { $('status').textContent = message; };

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
  session.clear();
  generation++;
  controller?.abort();
  controller = null;
  clearTimeout(expiryTimer);
  token = ''; expiresAt = 0; reader = null; folder = null;
  busy = false;
  $('folder').value = '';
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
async function renderImages(files, run, signal) {
  clearGrid();
  const tiles = files.map(file => {
    const tile = document.createElement('li');
    const image = document.createElement('img');
    image.alt = file.name;
    image.decoding = 'async';
    image.hidden = true;
    const caption = document.createElement('span');
    caption.className = 'image-caption';
    caption.textContent = file.name;
    const message = document.createElement('span');
    message.className = 'image-state';
    message.textContent = 'Loading image...';
    tile.append(image,message,caption);
    $('files').append(tile);
    return {file,image,message};
  });
  let index = 0;
  // Limit simultaneous downloads for large folders.
  async function worker() {
    while (index < tiles.length && run === generation && !signal.aborted) {
      const {file,image,message} = tiles[index++];
      try {
        if (file.capabilities?.canDownload === false) throw new Error('Preview restricted by owner.');
        const blob = await reader.image(file.id, signal);
        if (run !== generation || signal.aborted) return;
        const url = URL.createObjectURL(blob);
        imageUrls.add(url);
        image.onload = () => { image.hidden = false; message.hidden = true; };
        image.onerror = () => {
          image.hidden = true; message.hidden = false;
          message.textContent = 'This image format cannot be displayed.';
          URL.revokeObjectURL(url); imageUrls.delete(url);
        };
        image.src = url;
      } catch(error) {
        if (run !== generation || error.name === 'AbortError') return;
        if (error.status === 401) throw error;
        message.textContent = error.message;
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(4,tiles.length)},worker));
}
async function readFolder(newSelection = false) {
  const run = ++generation;
  controller?.abort();
  controller = new AbortController();
  busy = true; update();
  try {
    requireConnection();
    if (newSelection) {
      folder = null; persist(); clearGrid(); $('album').hidden = true;
      status('Checking your folder…');
      const selected = await reader.select($('folder').value, controller.signal);
      if (run !== generation) return;
      folder = selected;
      persist();
    }
    if (!folder) throw new Error('Choose a folder first.');
    status('Reading ' + folder.name + '…');
    const result = await reader.list(controller.signal);
    if (run !== generation) return;
    $('folder-title').textContent = folder.name;
    $('album').hidden = false;
    $('count').textContent = result.files.length
      ? result.files.length + ' images on the first page.' + (result.hasMore ? ' More images are not shown.' : '')
      : 'No images found on the first page.';
    await renderImages(result.files, run, controller.signal);
    if (run !== generation) return;
    status('Connected. Reading only the selected folder.');
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
  reset(); status('Disconnected. Saved connection cleared; Google permission remains until revoked.');
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



