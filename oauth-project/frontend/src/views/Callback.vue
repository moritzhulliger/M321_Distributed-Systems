<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { handleCallback } from '../oidc'

const router = useRouter()

onMounted(async () => {
  try {
    await handleCallback()
  } catch (e) {
     console.error('Callback processing error', e)
  }
  router.replace('/')
})
</script>

<template>
  <div>
    <p>Processing login...</p>
  </div>
</template>
