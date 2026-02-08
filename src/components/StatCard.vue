<script setup lang="ts">
interface Props {
  icon: string
  label: string
  value: string
  color?: string
}

withDefaults(defineProps<Props>(), {
  color: 'var(--p-primary-color)',
})
</script>

<template>
  <div class="stat-card">
    <div class="stat-icon" :style="{ color }">
      <i class="pi" :class="[icon]" />
    </div>
    <div class="stat-content">
      <div class="stat-value">
        {{ value }}
      </div>
      <div class="stat-label">
        {{ label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--surface-section);
  border-radius: var(--radius-lg);
  border: 1px solid var(--surface-border);
}

.stat-icon {
  font-size: var(--text-2xl);
}

.stat-value {
  font-weight: var(--font-bold);
  font-size: var(--text-lg);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--p-text-muted-color);
}
</style>
