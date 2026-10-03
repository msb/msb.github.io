export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export function parseFolderId(value) {
  const input = value.trim();
  if (/^[A-Za-z0-9_-]+$/.test(input)) return input;
  let url;
  try { url = new URL(input); } catch { throw new Error('Enter a Google Drive folder link or ID.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') {
    throw new Error('Use a folder link from https://drive.google.com.');
  }
  const match = url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) throw new Error('That is not a Google Drive folder link.');
  return match[1];
}

export function createFolderReader(token, fetcher = fetch) {
  let selected = null;
  let images = new Set();
  async function get(path, params, signal, media = false) {
    const url = new URL('https://www.googleapis.com/drive/v3/' + path);
    url.search = new URLSearchParams(params).toString();
    const response = await fetcher(url, {
      method: 'GET', headers: {Authorization: 'Bearer ' + token}, signal,
    });
    if (!response.ok) {
      const error = new Error(response.status === 401
        ? 'Google connection expired. Connect again.'
        : response.status === 403
        ? 'Google denied access. Check Drive API setup and your folder permissions.'
        : response.status === 404
        ? 'Folder not found, or this Google account cannot read it.'
        : 'Google Drive request failed (' + response.status + '). Try again.');
      error.status = response.status;
      throw error;
    }
    return media ? response.blob() : response.json();
  }
  return {
    async select(value, signal) {
      selected = null;
      images.clear();
      const id = parseFolderId(value);
      const folder = await get('files/' + encodeURIComponent(id),
        {fields:'id,name,mimeType,trashed',supportsAllDrives:'true'}, signal);
      if (folder.mimeType !== FOLDER_MIME || folder.trashed) throw new Error('Choose a folder that is not in the bin.');
      selected = {id, name:folder.name};
      return {...selected};
    },
    async list(signal, pageToken = '') {
      if (!selected) throw new Error('Choose a folder before reading files.');
      if (!pageToken) images.clear();
      const folderId = selected.id;
      const result = await get('files', {
        q: "'" + selected.id + "' in parents and trashed = false",
        fields: 'nextPageToken,files(id,name,mimeType,parents,capabilities(canDownload))',
        pageSize:'100', orderBy:'name', supportsAllDrives:'true',
        includeItemsFromAllDrives:'true', ...(pageToken ? {pageToken} : {}),
      }, signal);
      if (selected?.id !== folderId) throw new Error('Folder changed during listing.');
      const files = (result.files || []).filter(file =>
        file.parents?.includes(selected.id) && file.mimeType?.startsWith('image/'));
      for (const file of files) if (file.capabilities?.canDownload !== false) images.add(file.id);
      return {files, hasMore:Boolean(result.nextPageToken), nextPageToken:result.nextPageToken || ''};
    },
    async image(id, signal) {
      if (!selected || !images.has(id)) throw new Error('Image is not readable in the selected folder results.');
      const blob = await get('files/' + encodeURIComponent(id),
        {alt:'media',supportsAllDrives:'true'}, signal, true);
      if (!blob.type.startsWith('image/')) throw new Error('Drive did not return an image.');
      return blob;
    },
  };
}

// Persist only this app's session and retain Google's original absolute expiry.
export const FOLDER_KEY = 'colouring-album.folder.v1';
export const SESSION_KEY = 'colouring-album.google-session.v1';
export function createSessionStore(clientId, getStorage = () => localStorage, now = () => Date.now()) {
  function saveFolder(folderId) {
    if (typeof folderId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(folderId)) return false;
    try { getStorage().setItem(FOLDER_KEY, folderId); return true; } catch { return false; }
  }
  function loadFolder() {
    try {
      const storage = getStorage();
      const cached = storage.getItem(FOLDER_KEY);
      if (cached && /^[A-Za-z0-9_-]+$/.test(cached)) return cached;
      // Migrate the folder out of an existing session, even if its token expired.
      const old = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
      if (old?.folderId && saveFolder(old.folderId)) return old.folderId;
    } catch { /* Storage may be disabled or contain invalid data. */ }
    return '';
  }
  function clear() {
    loadFolder();
    try { getStorage().removeItem(SESSION_KEY); } catch { /* Storage may be disabled. */ }
  }
  function valid(value) {
    return value?.clientId === clientId && value?.scope === DRIVE_SCOPE &&
      typeof value.token === 'string' && value.token.length > 0 &&
      Number.isFinite(value.expiresAt) && value.expiresAt > now() &&
      (value.folderId === '' || (typeof value.folderId === 'string' && /^[A-Za-z0-9_-]+$/.test(value.folderId)));
  }
  return {
    clear, loadFolder, saveFolder,
    load() {
      try {
        const raw = getStorage().getItem(SESSION_KEY);
        if (!raw) return null;
        const value = JSON.parse(raw);
        if (!valid(value)) { clear(); return null; }
        return {token:value.token, expiresAt:value.expiresAt, folderId:value.folderId};
      } catch { clear(); return null; }
    },
    save({token, expiresAt, folderId = ''}) {
      if (folderId) saveFolder(folderId);
      const value = {clientId,scope:DRIVE_SCOPE,token,expiresAt,folderId};
      if (!valid(value)) { clear(); return false; }
      try { getStorage().setItem(SESSION_KEY,JSON.stringify(value)); return true; }
      catch { return false; }
    },
  };
}




export const GRID_KEY = 'colouring-album.grid.v1';
export function gridPreferences(value = {}) {
  const count = (input, fallback) => Number.isInteger(input) && input >= 1 && input <= 100 ? input : fallback;
  return {axis:value?.axis === 'rows' ? 'rows' : 'columns', rows:count(value?.rows,3), columns:count(value?.columns,4)};
}
export function createGridStore(getStorage = () => localStorage) {
  return {
    load() {
      try { return gridPreferences(JSON.parse(getStorage().getItem(GRID_KEY) || '{}')); }
      catch { return gridPreferences(); }
    },
    save(value) {
      try { getStorage().setItem(GRID_KEY,JSON.stringify(gridPreferences(value))); return true; }
      catch { return false; }
    },
  };
}
export function viewportGrid(width, height, preferences = {}) {
  const settings = gridPreferences(preferences);
  const tileSize = settings.axis === 'rows' ? height / settings.rows : width / settings.columns;
  const rows = settings.axis === 'rows' ? settings.rows : Math.floor(height / tileSize + 1e-9);
  const columns = settings.axis === 'columns' ? settings.columns : Math.floor(width / tileSize + 1e-9);
  return {tileSize, rows, columns, capacity:rows * columns};
}

// Collect metadata pages serially while consumers draw from the growing pool.
export function createFilePool(reader, signal, random = Math.random, onProgress = () => {}) {
  const files = new Map();
  const waiters = new Set();
  let finished = false;
  let error = null;
  const wake = () => { for (const resolve of waiters) resolve(); waiters.clear(); };
  const completion = (async () => {
    const seenPages = new Set();
    let pageToken = '';
    try {
      do {
        signal.throwIfAborted();
        const page = await reader.list(signal, pageToken);
        signal.throwIfAborted();
        for (const file of page.files) {
          if (file.capabilities?.canDownload !== false) files.set(file.id, file);
        }
        onProgress(files.size);
        wake();
        pageToken = page.nextPageToken || '';
        if (pageToken && seenPages.has(pageToken)) throw new Error('Drive returned a repeated page token.');
        seenPages.add(pageToken);
      } while (pageToken);
    } catch (cause) { error = cause; }
    finally { finished = true; wake(); }
  })();
  return {
    completion,
    get size() { return files.size; },
    get error() { return error; },
    async pick(used, consumerSignal = signal) {
      while (true) {
        signal.throwIfAborted();
        consumerSignal.throwIfAborted();
        const available = [...files.values()].filter(file => !used.has(file.id));
        if (available.length) {
          const file = available[Math.floor(random() * available.length)];
          used.add(file.id);
          return file;
        }
        if (finished) {
          if (error) throw error;
          return null;
        }
        await new Promise(resolve => {
          const done = () => { signal.removeEventListener('abort',done); consumerSignal.removeEventListener('abort',done); waiters.delete(done); resolve(); };
          waiters.add(done);
          signal.addEventListener('abort',done,{once:true});
          consumerSignal.addEventListener('abort',done,{once:true});
        });
      }
    },
  };
}





