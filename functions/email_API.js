// functions/email_API.js
// Gmail auth + send helper (Google Identity Services + Gmail API).
//
// Requires index.html to include or allow injection of:
//   https://accounts.google.com/gsi/client
//
// Usage:
//   import emailAPI from '../functions/email_API.js';
//   await emailAPI.ensureInit();
//   await emailAPI.ensureSignedIn(); // prompts consent
//   await emailAPI.sendHtml({ to, subject, html });

const emailAPI = (() => {
  let accessToken = null;
  let tokenClient = null;
  let initPromise = null;

  async function ensureInit() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      await ensureGIS();
      initOAuth();
    })();
    return initPromise;
  }

  async function ensureGIS() {
    if (window.google?.accounts?.oauth2) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load Google Identity Services (gsi/client)."));
      document.head.appendChild(s);
    });
  }

  function initOAuth() {
    const GOOGLE_CLIENT_ID =
      window.GOOGLE_CLIENT_ID ||
      "765883496085-itufq4k043ip181854tmcih1ka3ascmn.apps.googleusercontent.com";

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/gmail.send",
      callback: (resp) => {
        if (resp?.error) {
          console.error("OAuth error:", resp.error);
          return;
        }
        accessToken = resp.access_token;
      },
    });
  }

  function isSignedIn() {
    return !!accessToken;
  }

  async function ensureSignedIn() {
    await ensureInit();
    if (accessToken) return accessToken;

    // Wrap the async callback flow into a promise
    return new Promise((resolve, reject) => {
      const prev = tokenClient.callback;
      tokenClient.callback = (resp) => {
        // restore previous callback for safety
        tokenClient.callback = prev;

        if (resp?.error) {
          reject(new Error(resp.error?.message || "Google OAuth failed."));
          return;
        }
        accessToken = resp.access_token;
        resolve(accessToken);
      };

      try {
        tokenClient.requestAccessToken({ prompt: "consent" });
      } catch (e) {
        reject(e);
      }
    });
  }

  async function revoke() {
    if (!accessToken) return;
    try {
      await google.accounts.oauth2.revoke(accessToken);
    } finally {
      accessToken = null;
    }
  }

  async function sendHtml({ to, subject, html }) {
    if (!to) throw new Error("Missing recipient email.");
    if (!subject) subject = "(No Subject)";
    if (!html) html = "";

    await ensureSignedIn();

    const raw = buildRawEmail({
      to,
      subject,
      text: stripHtml(html) || subject,
      html,
    });

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error("Gmail send failed: " + errTxt);
    }

    return await res.json();
  }

  function buildRawEmail({ to, subject, text, html }) {
    const sub = (subject || "").toString().replace(/\r?\n/g, " ").trim();
    const txt = (text || "").toString();
    const htm = (html || "").toString();

    const boundary = "=_idshare_" + Math.random().toString(36).slice(2);

    const asciiOnly = /^[\x00-\x7F]*$/.test(sub);
    const headers = [
      `To: ${to}`,
      `Subject: ${asciiOnly ? sub : encodeRFC2047(sub)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];

    const parts = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      txt.replace(/\r?\n/g, "\r\n"),

      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      htm.replace(/\r?\n/g, "\r\n"),

      `--${boundary}--`,
      "",
    ];

    const msg = headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n");
    return base64UrlEncode(msg);
  }

  function base64UrlEncode(str) {
    const utf8 = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]);
    const b64 = btoa(binary);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function encodeRFC2047(str) {
    if (!str) return "";
    if (/^[\x00-\x7F]*$/.test(str)) return str;
    const utf8 = new TextEncoder().encode(str);
    let hex = "";
    for (let i = 0; i < utf8.length; i++) hex += "=" + utf8[i].toString(16).toUpperCase().padStart(2, "0");
    return `=?UTF-8?Q?${hex.replace(/ /g, "_")}?=`;
  }

  function stripHtml(h = "") {
    return h
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "$&\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return { ensureInit, ensureSignedIn, isSignedIn, revoke, sendHtml };
})();

export default emailAPI;
