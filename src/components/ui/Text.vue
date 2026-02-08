<script setup lang="ts">
import type { TextSize, TextWeight } from '../../types/ui'

interface Props {
  size?: TextSize
  weight?: TextWeight
  as?: 'p' | 'span' | 'div'
  muted?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  size: 'base',
  weight: 'normal',
  as: 'p',
  muted: false,
})
</script>

<template>
  <component
    :is="as"
    class="ui-text" :class="[
      `text-${size}`,
      `font-${weight}`,
      { 'ui-text--muted': muted },
    ]"
  >
    <slot />
  </component>
</template>

<style scoped>
.ui-text {
  font-family: var(--font-body);
  line-height: var(--leading-normal);
  margin: 0;
}

.ui-text--muted {
  color: var(--p-text-muted-color);
}
</style>
