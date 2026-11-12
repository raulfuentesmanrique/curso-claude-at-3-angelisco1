import { describe, it, expect } from 'vitest'
import { normalizeTableStatus } from '@models/table.model.js'
import { InvalidTableStatusError } from '@errors/DomainErrors.js'

describe('normalizeTableStatus', () => {
    it('should accept all valid statuses', () => {
        for (const s of ['libre', 'ocupada', 'reservada']) {
            expect(normalizeTableStatus(s)).toBe(s)
        }
    })

    it('should trim and lowercase the value', () => {
        expect(normalizeTableStatus('  OCUPADA ')).toBe('ocupada')
    })

    it('should throw InvalidTableStatusError for an invalid status', () => {
        expect(() => normalizeTableStatus('sucia')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus('sucia')).toThrow('Invalid table status: sucia')
    })

    it('should throw InvalidTableStatusError for an empty or non-string value', () => {
        expect(() => normalizeTableStatus('')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus(undefined as unknown as string)).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus(3 as unknown as string)).toThrow(InvalidTableStatusError)
    })
})
