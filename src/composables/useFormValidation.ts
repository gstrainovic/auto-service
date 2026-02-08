/**
 * Form Validation Composable using Zod
 */

import type { z, ZodSchema } from 'zod'
import type { FormErrors } from '../types/forms'
import { ref } from 'vue'

export function useFormValidation<T extends ZodSchema>(schema: T) {
  const errors = ref<FormErrors>({})
  const isValidating = ref(false)

  function validate(data: unknown): data is z.infer<T> {
    isValidating.value = true
    const newErrors: FormErrors = {}

    try {
      schema.parse(data)
      errors.value = {}
      return true
    }
    catch (error: any) {
      if (error.issues) {
        error.issues.forEach((err: any) => {
          const field = err.path[0]
          newErrors[field] = err.message
        })
      }
      errors.value = newErrors
      return false
    }
    finally {
      isValidating.value = false
    }
  }

  function clearError(field: string) {
    delete errors.value[field]
  }

  function clearAll() {
    errors.value = {}
  }

  return {
    errors,
    isValidating,
    validate,
    clearError,
    clearAll,
  }
}
