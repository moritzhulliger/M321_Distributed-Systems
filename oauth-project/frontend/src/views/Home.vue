
<script setup>
import { ref, onMounted } from 'vue'
import { getUser } from '../oidc'

const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'
const loading = ref(false)
const data = ref(null)
const error = ref(null)
const comments = ref([])
const newComment = ref('')

onMounted(async () => {
  await loadComments()
})

async function loadComments() {
  loading.value = true
  error.value = null
  comments.value = []

  try {
    const user = await getUser()
    const headers = {}
    if (user && user.access_token) {
      headers['Authorization'] = `Bearer ${user.access_token}`
    }

    const res = await fetch(`${apiBase}/comments`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const value = await res.json()
    console.log("Loaded comments:", value)
    comments.value = value.comments || ['asdf']

  } catch (err) {
    error.value = err.message || String(err)
  } finally {
    loading.value = false
  }
}   

async function submitComment() {
  const comment = newComment.value.trim()
  if (!comment) return

  loading.value = true
  error.value = null

  try {
    const user = await getUser()
    const headers = {
      'Content-Type': 'application/json',
    }
    if (user && user.access_token) {
      headers['Authorization'] = `Bearer ${user.access_token}`
    }

    const res = await fetch(`${apiBase}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ comment }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    newComment.value = ''
    await loadComments()
  } catch (err) {
    error.value = err.message || String(err)
  } finally {
    loading.value = false
  }
}   

</script>

<template>
  <div>
    <h2>Home</h2>
    <p>This is the app home. Use the login button above to authenticate with Keycloak.</p>

    <input type="textarea" v-model="newComment" placeholder="Write a comment..."></input>
    <button @click="submitComment">Submit</button>

    <h2>Kommentare</h2>
    <ul>
      <li v-html="comment.comment" v-for="comment in comments" :key="comment.id"></li>
    </ul>

  </div>
</template>
