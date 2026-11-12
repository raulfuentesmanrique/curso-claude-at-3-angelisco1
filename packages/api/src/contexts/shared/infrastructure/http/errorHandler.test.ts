import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { errorHandler } from './errorHandler.js'
import {
    DuplicatedTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    TableNotAvailableError,
    TableNotFoundError
} from '@errors/DomainErrors.js'

const run = (err: unknown) => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }
    errorHandler(err, {} as Request, res as unknown as Response, (() => {}) as NextFunction)
    return res
}

describe('errorHandler', () => {
    it('should map TableNotFoundError to 404', () => {
        const res = run(new TableNotFoundError())
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({ error: 'TableNotFoundError', message: 'Table not found' })
    })

    it.each([new DuplicatedTableNumberError(), new TableNotAvailableError()])('should map %s to 409', (err) => {
        const res = run(err)
        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.json).toHaveBeenCalledWith({ error: err.name, message: err.message })
    })

    it.each([new InvalidTableStatusError(), new InvalidTableCapacityError()])('should map %s to 400', (err) => {
        expect(run(err).status).toHaveBeenCalledWith(400)
    })

    it('should map unknown errors to 500', () => {
        expect(run(new Error('boom')).status).toHaveBeenCalledWith(500)
    })
})
