<script setup lang="ts">
interface Props {
  imageData?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  alt: 'Dokument',
  size: 'md',
})

const sizeMap = {
  sm: '48px',
  md: '80px',
  lg: '120px',
}

const hasImage = !!props.imageData
</script>

<template>
  <div
    class="document-preview" :class="[`document-preview--${size}`]"
    :style="{ '--preview-size': sizeMap[size] }"
  >
    <img
      v-if="hasImage"
      :src="imageData"
      :alt="alt"
      class="preview-image"
    >
    <div v-else class="preview-placeholder">
      <i class="pi pi-file-pdf" />
    </div>
  </div>
</template>

<style scoped>
.document-preview {
  width: var(--preview-size);
  height: var(--preview-size);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  flex-shrink: 0;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color);
  font-size: calc(var(--preview-size) * 0.4);
}
</style>
