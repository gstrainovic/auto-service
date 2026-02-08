<script setup lang="ts">
import type { HeadingLevel } from '../../types/ui'

interface Props {
  level?: HeadingLevel
  as?: HeadingLevel
}

const props = withDefaults(defineProps<Props>(), {
  level: 'h2',
})

const component = props.as || props.level
</script>

<template>
  <component :is="component" class="ui-heading">
    <slot />
  </component>
</template>

<style scoped>
.ui-heading {
  font-family: var(--font-heading);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  margin: 0;
}
</style>
