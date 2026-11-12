import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import { MockRestaurantRepository } from '@repositories/mocks/MockRestaurantRepository.js'
import {
    DuplicatedTableNumberError,
    InvalidPeopleCountError,
    InvalidTableCapacityError,
    InvalidTableNumberError,
    InvalidTableStatusError,
    RestaurantNotFoundError,
    TableNotAvailableError,
    TableNotFoundError
} from '@errors/DomainErrors.js'

describe('TableService', () => {
    let tableRepo: MockTableRepository
    let restaurantRepo: MockRestaurantRepository
    let service: TableService

    const validInput = { number: 1, description: 'Ventana', capacity: 4 }

    beforeEach(async () => {
        tableRepo = new MockTableRepository()
        restaurantRepo = new MockRestaurantRepository()
        service = new TableService(tableRepo, restaurantRepo)

        for (const id of ['r1', 'r2']) {
            await restaurantRepo.save({
                id, name: 'Rest', address: 'Calle', email: 'a@b.com', phone: '+34 600000000',
                ownerFirstName: 'A', ownerLastName: 'B', logoUrl: null,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            })
        }
    })

    describe('create', () => {
        it('should create and save a table with status libre by default', async () => {
            const result = await service.create('r1', validInput)

            expect(result.id).toBeDefined()
            expect(result).toMatchObject({ restaurantId: 'r1', number: 1, description: 'Ventana', capacity: 4, status: 'libre' })
            expect(result.createdAt).toBe(result.updatedAt)
            expect(await tableRepo.findById(result.id)).toEqual(result)
        })

        it('should accept and normalize an explicit status', async () => {
            const result = await service.create('r1', { ...validInput, status: ' Reservada ' })
            expect(result.status).toBe('reservada')
        })

        it('should store an empty or missing description as null', async () => {
            expect((await service.create('r1', { number: 1, capacity: 2, description: '   ' })).description).toBeNull()
            expect((await service.create('r1', { number: 2, capacity: 2 })).description).toBeNull()
        })

        it('should trim the description', async () => {
            expect((await service.create('r1', { ...validInput, description: '  Terraza ' })).description).toBe('Terraza')
        })

        it.each([0, -1, 1.5, '3', null, undefined])('should reject number %s', async (number) => {
            await expect(service.create('r1', { ...validInput, number: number as any }))
                .rejects.toThrow(InvalidTableNumberError)
        })

        it.each([0, -2, 2.5, '4', null, undefined])('should reject capacity %s', async (capacity) => {
            await expect(service.create('r1', { ...validInput, capacity: capacity as any }))
                .rejects.toThrow(InvalidTableCapacityError)
        })

        it('should reject an invalid status', async () => {
            await expect(service.create('r1', { ...validInput, status: 'sucia' }))
                .rejects.toThrow(InvalidTableStatusError)
        })

        it('should throw DuplicatedTableNumberError when the number exists in the restaurant', async () => {
            await service.create('r1', validInput)
            await expect(service.create('r1', validInput)).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('should allow the same number in another restaurant', async () => {
            await service.create('r1', validInput)
            await expect(service.create('r2', validInput)).resolves.toMatchObject({ restaurantId: 'r2', number: 1 })
        })

        it('should throw RestaurantNotFoundError if the restaurant does not exist', async () => {
            await expect(service.create('nope', validInput)).rejects.toThrow(RestaurantNotFoundError)
        })
    })

    describe('update', () => {
        it('should update number, description and capacity keeping the status if omitted', async () => {
            const created = await service.create('r1', { ...validInput, status: 'reservada' })

            const updated = await service.update('r1', created.id, { number: 9, description: 'Terraza', capacity: 6 })

            expect(updated).toMatchObject({ id: created.id, restaurantId: 'r1', number: 9, description: 'Terraza', capacity: 6, status: 'reservada', createdAt: created.createdAt })
            expect(await tableRepo.findById(created.id)).toEqual(updated)
        })

        it('should update the status if provided', async () => {
            const created = await service.create('r1', validInput)
            const updated = await service.update('r1', created.id, { ...validInput, status: 'OCUPADA' })
            expect(updated.status).toBe('ocupada')
        })

        it('should allow keeping its own number', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.update('r1', created.id, { ...validInput, capacity: 8 })).resolves.toMatchObject({ number: 1, capacity: 8 })
        })

        it('should throw DuplicatedTableNumberError if another table has that number', async () => {
            await service.create('r1', validInput)
            const second = await service.create('r1', { ...validInput, number: 2 })

            await expect(service.update('r1', second.id, validInput)).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('should validate number and capacity', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.update('r1', created.id, { ...validInput, number: 0 })).rejects.toThrow(InvalidTableNumberError)
            await expect(service.update('r1', created.id, { ...validInput, capacity: 0 })).rejects.toThrow(InvalidTableCapacityError)
        })

        it('should throw TableNotFoundError if the table does not exist or belongs to another restaurant', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.update('r1', 'nope', validInput)).rejects.toThrow(TableNotFoundError)
            await expect(service.update('r2', created.id, validInput)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findById', () => {
        it('should return the table', async () => {
            const created = await service.create('r1', validInput)
            expect(await service.findById('r1', created.id)).toEqual(created)
        })

        it('should throw TableNotFoundError if it does not exist', async () => {
            await expect(service.findById('r1', 'nope')).rejects.toThrow(TableNotFoundError)
        })

        it('should throw TableNotFoundError if it belongs to another restaurant', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.findById('r2', created.id)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findByRestaurantId', () => {
        it('should return only the tables of the restaurant ordered by number', async () => {
            await service.create('r1', { ...validInput, number: 2 })
            await service.create('r1', { ...validInput, number: 1 })
            await service.create('r2', { ...validInput, number: 3 })

            const result = await service.findByRestaurantId('r1')
            expect(result.map(t => t.number)).toEqual([1, 2])
        })
    })

    describe('delete', () => {
        it('should delete a free table', async () => {
            const created = await service.create('r1', validInput)
            await service.delete('r1', created.id)
            expect(await tableRepo.findById(created.id)).toBeNull()
        })

        it('should throw TableNotAvailableError if the table is not free', async () => {
            const created = await service.create('r1', { ...validInput, status: 'ocupada' })
            await expect(service.delete('r1', created.id)).rejects.toThrow(TableNotAvailableError)
            expect(await tableRepo.findById(created.id)).not.toBeNull()
        })

        it('should throw TableNotFoundError if it does not exist or belongs to another restaurant', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.delete('r1', 'nope')).rejects.toThrow(TableNotFoundError)
            await expect(service.delete('r2', created.id)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findAvailable', () => {
        it('should return free tables with enough capacity', async () => {
            await service.create('r1', { number: 1, capacity: 2 })
            await service.create('r1', { number: 2, capacity: 4 })
            await service.create('r1', { number: 3, capacity: 6, status: 'ocupada' })

            const result = await service.findAvailable('r1', 3)
            expect(result.map(t => t.number)).toEqual([2])
        })

        it.each([0, -1, 1.5, NaN, '2', undefined])('should throw InvalidPeopleCountError for %s', async (people) => {
            await expect(service.findAvailable('r1', people as any)).rejects.toThrow(InvalidPeopleCountError)
        })
    })

    describe('changeStatus', () => {
        it('should change and normalize the status', async () => {
            const created = await service.create('r1', validInput)

            const result = await service.changeStatus('r1', created.id, ' Reservada')

            expect(result.status).toBe('reservada')
            expect((await tableRepo.findById(created.id))?.status).toBe('reservada')
        })

        it('should throw InvalidTableStatusError for an invalid status', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.changeStatus('r1', created.id, 'sucia')).rejects.toThrow(InvalidTableStatusError)
        })

        it('should throw TableNotFoundError if it does not exist or belongs to another restaurant', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.changeStatus('r1', 'nope', 'libre')).rejects.toThrow(TableNotFoundError)
            await expect(service.changeStatus('r2', created.id, 'libre')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('occupy', () => {
        it('should occupy a free table and return it', async () => {
            const created = await service.create('r1', validInput)

            const result = await service.occupy('r1', created.id)

            expect(result).toMatchObject({ id: created.id, status: 'ocupada' })
            expect((await tableRepo.findById(created.id))?.status).toBe('ocupada')
        })

        it.each(['ocupada', 'reservada'])('should throw TableNotAvailableError if the table is %s', async (status) => {
            const created = await service.create('r1', { ...validInput, status })
            await expect(service.occupy('r1', created.id)).rejects.toThrow(TableNotAvailableError)
        })

        it('should throw TableNotFoundError if it does not exist or belongs to another restaurant', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.occupy('r1', 'nope')).rejects.toThrow(TableNotFoundError)
            await expect(service.occupy('r2', created.id)).rejects.toThrow(TableNotFoundError)
        })
    })
})
