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
    async list(signal) {
      if (!selected) throw new Error('Choose a folder before reading files.');
      images.clear();
      const result = await get('files', {
        q: "'" + selected.id + "' in parents and trashed = false",
        fields: 'nextPageToken,files(id,name,mimeType,parents,capabilities(canDownload))',
        pageSize:'100', orderBy:'name', supportsAllDrives:'true',
        includeItemsFromAllDrives:'true',
      }, signal);
      const files = (result.files || []).filter(file =>
        file.parents?.includes(selected.id) && file.mimeType?.startsWith('image/'));
      images = new Set(files.filter(file => file.capabilities?.canDownload !== false).map(file => file.id));
      return {files, hasMore:Boolean(result.nextPageToken)};
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
export const SESSION_KEY = 'colouring-album.google-session.v1';
export function createSessionStore(clientId, getStorage = () => localStorage, now = () => Date.now()) {
  function clear() {
    try { getStorage().removeItem(SESSION_KEY); } catch { /* Storage may be disabled. */ }
  }
  function valid(value) {
    return value?.clientId === clientId && value?.scope === DRIVE_SCOPE &&
      typeof value.token === 'string' && value.token.length > 0 &&
      Number.isFinite(value.expiresAt) && value.expiresAt > now() &&
      (value.folderId === '' || (typeof value.folderId === 'string' && /^[A-Za-z0-9_-]+$/.test(value.folderId)));
  }
  return {
    clear,
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
      const value = {clientId,scope:DRIVE_SCOPE,token,expiresAt,folderId};
      if (!valid(value)) { clear(); return false; }
      try { getStorage().setItem(SESSION_KEY,JSON.stringify(value)); return true; }
      catch { return false; }
    },
  };
}


