<script setup lang="ts">
import type { InvoiceFormData } from '../types/forms'
import Dialog from 'primevue/dialog'
import { computed } from 'vue'
import InvoiceForm from './InvoiceForm.vue'

interface Props {
  visible: boolean
  initialData?: Partial<InvoiceFormData>
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Neue Rechnung',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'submit': [data: InvoiceFormData]
}>()

const isVisible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

function handleSubmit(data: InvoiceFormData) {
  emit('submit', data)
  emit('update:visible', false)
}

function handleCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    v-model:visible="isVisible"
    :header="title"
    :modal="true"
    :closable="true"
    :draggable="false"
    :style="{ width: '90vw', maxWidth: '500px' }"
  >
    <InvoiceForm
      :initial-data="initialData"
      @submit="handleSubmit"
      @cancel="handleCancel"
    />
  </Dialog>
</template>
