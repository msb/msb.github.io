// Runtime configuration is provided by the local server.
// Client IDs are public to the browser, but kept out of repository source.
let clientId = '';
try {
  const response = await fetch('/config.json', {cache:'no-store'});
  if (response.ok) {
    const config = await response.json();
    if (typeof config.GOOGLE_CLIENT_ID === 'string') clientId = config.GOOGLE_CLIENT_ID;
  }
} catch {
  // The page displays its setup instructions when configuration is unavailable.
}
export const GOOGLE_CLIENT_ID = clientId;
