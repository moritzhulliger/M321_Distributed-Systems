# .

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

## Keycloak / OIDC setup

This project uses `oidc-client-ts` to integrate with Keycloak (or any OpenID Connect provider).

Environment variables (Vite):

- `VITE_OIDC_AUTHORITY` — your Keycloak base URL for the realm, e.g. `http://localhost:8080/auth/realms/myrealm`
- `VITE_OIDC_CLIENT_ID` — the client id you registered in Keycloak (e.g. `frontend`)

Example (.env.local):

```
VITE_OIDC_AUTHORITY=http://localhost:8080/auth/realms/myrealm
VITE_OIDC_CLIENT_ID=frontend
```

Notes:
- The client must allow the redirect URI `http://localhost:5173/callback` (adjust port if your dev server runs on a different port).
- Use the Authorization Code flow (client should be public or confidential with appropriate settings). The app uses `response_type: 'code'` and requests `openid profile email`.

After installing dependencies (`npm install`), run the dev server and click "Login with Keycloak" in the header.
