<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, logout, getUser, userManager } from './oidc'

const router = useRouter()
const user = ref(null)

async function refreshUser() {
  user.value = await getUser()
}

onMounted(async () => {
  await refreshUser()

  // update on user loaded/changed events
  userManager.events.addUserLoaded(() => refreshUser())
  userManager.events.addUserUnloaded(() => refreshUser())
})

function doLogin() {
  return login()
}

function doLogout() {
  return logout()
}
</script>

<template>
  <div>
    <header style="display:flex;justify-content:space-between;align-items:center;padding:1rem;border-bottom:1px solid #eee;">
      <div>
        <strong>OAuth Demo</strong>
      </div>
      <div>
        <template v-if="user">
          <span style="margin-right:1rem">Hello, {{ user.profile?.preferred_username || user.profile?.name || user.profile?.email }}</span>
          <button @click="doLogout">Logout</button>
        </template>
        <template v-else>
          <button @click="doLogin">Login with Keycloak</button>
        </template>
      </div>
    </header>

    <main style="padding:1rem">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
button {
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
}
</style>
