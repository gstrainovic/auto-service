<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const { sendMagicCode, signInWithMagicCode } = useAuth()

const email = ref('')
const code = ref('')
const sentEmail = ref('')
const loading = ref(false)
const error = ref('')

async function handleSendCode() {
  error.value = ''
  loading.value = true
  try {
    await sendMagicCode(email.value)
    sentEmail.value = email.value
  }
  catch (err: any) {
    error.value = err.body?.message || 'Code konnte nicht gesendet werden.'
  }
  finally {
    loading.value = false
  }
}

async function handleVerifyCode() {
  error.value = ''
  loading.value = true
  try {
    await signInWithMagicCode(sentEmail.value, code.value)
  }
  catch (err: any) {
    code.value = ''
    error.value = err.body?.message || 'Ungültiger Code.'
  }
  finally {
    loading.value = false
  }
}

function handleBack() {
  sentEmail.value = ''
  code.value = ''
  error.value = ''
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <i class="pi pi-car" />
        <h1>Auto-Service</h1>
      </div>

      <Message v-if="error" severity="error" :closable="false">
        {{ error }}
      </Message>

      <!-- Step 1: E-Mail eingeben -->
      <form v-if="!sentEmail" @submit.prevent="handleSendCode">
        <p class="login-description">
          E-Mail-Adresse eingeben um einen Anmelde-Code zu erhalten.
        </p>
        <div class="login-field">
          <InputText
            v-model="email"
            type="email"
            placeholder="E-Mail-Adresse"
            required
            autofocus
            fluid
          />
        </div>
        <Button
          type="submit"
          label="Code senden"
          icon="pi pi-send"
          :loading="loading"
          fluid
        />
      </form>

      <!-- Step 2: Code eingeben -->
      <form v-else @submit.prevent="handleVerifyCode">
        <p class="login-description">
          Code wurde an <strong>{{ sentEmail }}</strong> gesendet.
        </p>
        <div class="login-field">
          <InputText
            v-model="code"
            type="text"
            placeholder="6-stelliger Code"
            required
            autofocus
            fluid
            inputmode="numeric"
            maxlength="6"
          />
        </div>
        <Button
          type="submit"
          label="Anmelden"
          icon="pi pi-sign-in"
          :loading="loading"
          fluid
        />
        <Button
          type="button"
          label="Andere E-Mail"
          text
          fluid
          class="login-back"
          @click="handleBack"
        />
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--p-surface-ground);
  padding: 1rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--p-surface-card);
  border-radius: var(--p-border-radius);
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.login-header i {
  font-size: 3rem;
  color: var(--p-primary-color);
}

.login-header h1 {
  margin: 0.5rem 0 0;
  font-size: 1.5rem;
  color: var(--p-text-color);
}

.login-description {
  color: var(--p-text-muted-color);
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.login-field {
  margin-bottom: 1rem;
}

.login-back {
  margin-top: 0.5rem;
}
</style>
