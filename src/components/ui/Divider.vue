<script setup lang="ts">
interface Props {
  vertical?: boolean
  spacing?: 'sm' | 'md' | 'lg'
}

const _props = withDefaults(defineProps<Props>(), {
  vertical: false,
  spacing: 'md',
})

const spacingMap = {
  sm: 'var(--spacing-sm)',
  md: 'var(--spacing-md)',
  lg: 'var(--spacing-lg)',
}
</script>

<template>
  <div
    class="ui-divider" :class="[
      { 'ui-divider--vertical': vertical },
    ]"
    :style="{
      margin: vertical ? `0 ${spacingMap[spacing]}` : `${spacingMap[spacing]} 0`,
    }"
  />
</template>

<style scoped>
.ui-divider {
  border: 0;
  border-top: 1px solid var(--surface-border);
}

.ui-divider--vertical {
  border-top: 0;
  border-left: 1px solid var(--surface-border);
  height: 100%;
  width: 1px;
  display: inline-block;
  vertical-align: middle;
}
</style>
