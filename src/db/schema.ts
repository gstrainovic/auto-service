import type { RxJsonSchema } from 'rxdb'

export const vehicleSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    make: { type: 'string' },
    model: { type: 'string' },
    year: { type: 'integer' },
    mileage: { type: 'integer' },
    vin: { type: 'string' },
    licensePlate: { type: 'string' },
    customSchedule: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          label: { type: 'string' },
          intervalKm: { type: 'number' },
          intervalMonths: { type: 'number' },
        },
      },
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'make', 'model', 'year', 'mileage', 'createdAt', 'updatedAt'],
}

export const invoiceSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    vehicleId: { type: 'string' },
    workshopName: { type: 'string' },
    date: { type: 'string', format: 'date' },
    totalAmount: { type: 'number' },
    currency: { type: 'string' },
    mileageAtService: { type: 'integer' },
    imageData: { type: 'string' },
    rawText: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          category: { type: 'string' },
          amount: { type: 'number' },
        },
      },
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'vehicleId', 'date', 'createdAt', 'updatedAt'],
}

export const maintenanceSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    vehicleId: { type: 'string' },
    invoiceId: { type: 'string' },
    type: { type: 'string' },
    description: { type: 'string' },
    doneAt: { type: 'string', format: 'date' },
    mileageAtService: { type: 'integer' },
    nextDueDate: { type: 'string', format: 'date' },
    nextDueMileage: { type: 'integer' },
    status: { type: 'string', enum: ['done', 'due', 'overdue'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'vehicleId', 'type', 'status', 'createdAt', 'updatedAt'],
}
