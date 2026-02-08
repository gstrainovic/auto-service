<script setup lang="ts">
import type { ButtonSize, ButtonVariant } from '../../types/ui'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
})
</script>

<template>
  <button
    class="ui-button" :class="[
      `ui-button--${variant}`,
      `ui-button--${size}`,
      { 'ui-button--loading': loading },
    ]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="ui-button__spinner">⏳</span>
    <slot />
  </button>
</template>

<style scoped>
.ui-button {
  font-family: var(--font-body);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.ui-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.ui-button--sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--text-sm);
}

.ui-button--md {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--text-base);
}

.ui-button--lg {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--text-lg);
}

/* Variants */
.ui-button--primary {
  background: var(--p-primary-500);
  color: white;
}

.ui-button--primary:hover:not(:disabled) {
  background: var(--p-primary-600);
}

.ui-button--secondary {
  background: var(--surface-section);
  color: var(--p-text-color);
  border: 1px solid var(--surface-border);
}

.ui-button--secondary:hover:not(:disabled) {
  background: var(--surface-ground);
}

.ui-button--ghost {
  background: transparent;
  color: var(--p-text-color);
}

.ui-button--ghost:hover:not(:disabled) {
  background: var(--surface-ground);
}

.ui-button--danger {
  background: var(--status-error);
  color: white;
}

.ui-button--danger:hover:not(:disabled) {
  background: #dc2626;
}

.ui-button--loading {
  position: relative;
}

.ui-button__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
