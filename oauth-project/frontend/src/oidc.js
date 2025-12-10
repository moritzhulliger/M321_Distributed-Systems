import { UserManager, WebStorageStateStore, Log } from 'oidc-client-ts'

const settings = {
  authority: 'http://localhost:8080/realms/security-lab',
  client_id:  'spa-client',
  redirect_uri: window.location.origin + '/callback',
  response_type: 'code',
  scope: 'openid profile email',
  post_logout_redirect_uri: window.location.origin + '/',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true
}

Log.setLevel(Log.INFO)

const userManager = new UserManager(settings)

export async function login() {
  return userManager.signinRedirect()
}

export async function handleCallback() {
  const user = await userManager.signinRedirectCallback()
  return user
}

export async function logout() {
  return userManager.signoutRedirect()
}

export async function getUser() {
  return userManager.getUser()
}

export { userManager }
