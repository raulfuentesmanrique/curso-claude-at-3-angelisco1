import { SqliteTableRepository } from './table.repository.js'
import { Database } from '@config/database.js'
import type { Table, TableStatusType } from '@models/table.model.js'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const buildTable = (overrides: Partial<Table> = {}): Table => ({
    id: 't1',
    restaurantId: 'r1',
    number: 1,
    description: 'Ventana',
    capacity: 4,
    status: 'libre',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    ...overrides
})

describe('SqliteTableRepository (Integration)', () => {
    let db: Database
    let repo: SqliteTableRepository

    beforeEach(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteTableRepository(db)

        for (const id of ['r1', 'r2']) {
            await db.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, 'Rest ' + id, 'Calle Mayor 10', 'info@rest.com', '+34 612345678', 'Carlos', 'García', new Date().toISOString(), new Date().toISOString()]
            )
        }
    })

    afterEach(async () => {
        await db.close()
    })

    it('should insert and find a table by id', async () => {
        await repo.save(buildTable())

        const found = await repo.findById('t1')
        expect(found).toEqual(buildTable())
    })

    it('should return null when the table does not exist', async () => {
        expect(await repo.findById('nope')).toBeNull()
    })

    it('should store a null description', async () => {
        await repo.save(buildTable({ description: null }))
        expect((await repo.findById('t1'))?.description).toBeNull()
    })

    it('should update an existing table', async () => {
        await repo.save(buildTable())
        await repo.save(buildTable({ number: 7, description: 'Terraza', capacity: 6, status: 'reservada', updatedAt: '2026-01-02T10:00:00.000Z' }))

        const found = await repo.findById('t1')
        expect(found).toEqual(buildTable({ number: 7, description: 'Terraza', capacity: 6, status: 'reservada', updatedAt: '2026-01-02T10:00:00.000Z' }))
    })

    it('should find tables by restaurant ordered by number', async () => {
        await repo.save(buildTable({ id: 't3', number: 3 }))
        await repo.save(buildTable({ id: 't1', number: 1 }))
        await repo.save(buildTable({ id: 't2', number: 2 }))
        await repo.save(buildTable({ id: 'other', restaurantId: 'r2', number: 1 }))

        const results = await repo.findByRestaurantId('r1')
        expect(results.map(t => t.id)).toEqual(['t1', 't2', 't3'])
    })

    it('should find a table by restaurant and number', async () => {
        await repo.save(buildTable({ id: 't1', number: 4 }))

        expect((await repo.findByNumber('r1', 4))?.id).toBe('t1')
        expect(await repo.findByNumber('r1', 5)).toBeNull()
        expect(await repo.findByNumber('r2', 4)).toBeNull()
    })

    it('should delete a table', async () => {
        await repo.save(buildTable())
        await repo.delete('t1')
        expect(await repo.findById('t1')).toBeNull()
    })

    describe('findAvailable', () => {
        it('should return only free tables of the restaurant with enough capacity, ordered by capacity and number', async () => {
            const tables: Array<[string, number, number, TableStatusType, string]> = [
                ['a', 1, 2, 'libre', 'r1'],
                ['b', 2, 6, 'libre', 'r1'],
                ['c', 3, 4, 'libre', 'r1'],
                ['d', 4, 4, 'ocupada', 'r1'],
                ['e', 5, 8, 'reservada', 'r1'],
                ['f', 6, 4, 'libre', 'r2'],
                ['g', 7, 4, 'libre', 'r1']
            ]
            for (const [id, number, capacity, status, restaurantId] of tables) {
                await repo.save(buildTable({ id, number, capacity, status, restaurantId }))
            }

            const results = await repo.findAvailable('r1', 3)
            expect(results.map(t => t.id)).toEqual(['c', 'g', 'b'])
        })
    })

    describe('occupyIfFree', () => {
        it('should occupy a free table and return true', async () => {
            await repo.save(buildTable())

            const result = await repo.occupyIfFree('t1', '2026-01-03T10:00:00.000Z')

            expect(result).toBe(true)
            const found = await repo.findById('t1')
            expect(found?.status).toBe('ocupada')
            expect(found?.updatedAt).toBe('2026-01-03T10:00:00.000Z')
        })

        it('should return false if the table was not free', async () => {
            await repo.save(buildTable({ status: 'reservada' }))

            expect(await repo.occupyIfFree('t1', '2026-01-03T10:00:00.000Z')).toBe(false)
            expect((await repo.findById('t1'))?.status).toBe('reservada')
        })

        it('should let only one of two concurrent attempts succeed', async () => {
            await repo.save(buildTable())

            const results = await Promise.all([
                repo.occupyIfFree('t1', '2026-01-03T10:00:00.000Z'),
                repo.occupyIfFree('t1', '2026-01-03T10:00:00.000Z')
            ])
            expect(results.filter(Boolean)).toHaveLength(1)
        })

        it('should return false if the table does not exist', async () => {
            expect(await repo.occupyIfFree('nope', '2026-01-03T10:00:00.000Z')).toBe(false)
        })
    })
})
