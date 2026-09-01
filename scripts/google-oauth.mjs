#!/usr/bin/env node
// Un solo uso: saca el refresh token de Google Calendar para la cuenta de
// Tomás. Se corre en local, imprime el token y se acabó — el valor va DIRECTO
// a .env.local y a Vercel, nunca al repo ni al chat.
//
//   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
//     node scripts/google-oauth.mjs
//
// Requisito previo: la pantalla de consentimiento PUBLICADA EN PRODUCCIÓN.
// En "Testing" el refresh token caduca a los 7 días.

import { createServer } from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const PUERTO = 53682;
const REDIRECT = `http://localhost:${PUERTO}`;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Faltan GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET.");
  process.exit(1);
}

const url =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES,
    // access_type=offline + prompt=consent: sin los dos, Google NO devuelve
    // refresh_token en una cuenta que ya autorizó antes.
    access_type: "offline",
    prompt: "consent",
  });

const servidor = createServer(async (req, res) => {
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Sin code.");
    return;
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const json = await r.json();
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(json.refresh_token ? "Listo. Vuelve a la terminal." : "Google no devolvió refresh_token.");

  if (json.refresh_token) {
    console.log("\nGOOGLE_CALENDAR_REFRESH_TOKEN=" + json.refresh_token);
    console.log("\nPégalo en .env.local y en Vercel. No lo pegues en un chat.\n");
  } else {
    console.error("\nSin refresh_token. Revoca el acceso en https://myaccount.google.com/permissions y repite.\n");
  }
  servidor.close();
});

servidor.listen(PUERTO, () => {
  console.log("Abriendo el navegador. Si no se abre, entra a:\n" + url + "\n");
  exec(`open "${url}"`);
});
