<script setup lang="ts">
interface Props {
  spacing?: 'sm' | 'md' | 'lg' | 'xl'
}

const _props = withDefaults(defineProps<Props>(), {
  spacing: 'lg',
})

const spacingMap = {
  sm: 'var(--spacing-md)',
  md: 'var(--spacing-lg)',
  lg: 'var(--spacing-xl)',
  xl: 'var(--spacing-2xl)',
}
</script>

<template>
  <section class="ui-section" :style="{ padding: spacingMap[spacing] }">
    <slot />
  </section>
</template>

<style scoped>
.ui-section {
  width: 100%;
}
</style>
