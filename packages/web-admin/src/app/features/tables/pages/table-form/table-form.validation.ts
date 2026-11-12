import type { TableStatus } from '../../models/table.model'

export const TABLE_STATUSES: TableStatus[] = ['libre', 'ocupada', 'reservada']

export interface TableFormValues {
  number: number | null
  capacity: number | null
  status: TableStatus
}

export function validateTableForm(form: TableFormValues): string | null {
  if (!Number.isInteger(form.number) || (form.number as number) <= 0) {
    return 'El número de mesa debe ser un entero mayor que 0.'
  }
  if (!Number.isInteger(form.capacity) || (form.capacity as number) <= 0) {
    return 'La capacidad debe ser un entero mayor que 0.'
  }
  if (!TABLE_STATUSES.includes(form.status)) {
    return 'El estado no es válido.'
  }
  return null
}
