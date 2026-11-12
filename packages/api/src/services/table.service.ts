import { randomUUID } from 'crypto'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import type { RestaurantRepository } from '@repositories/restaurant.repository.js'
import {
    DuplicatedTableNumberError,
    InvalidPeopleCountError,
    InvalidTableCapacityError,
    InvalidTableNumberError,
    RestaurantNotFoundError,
    TableNotAvailableError,
    TableNotFoundError
} from '@errors/DomainErrors.js'

export interface CreateTableDTO {
    number: number
    capacity: number
    description?: string | null
    status?: string
}

export interface UpdateTableDTO {
    number: number
    capacity: number
    description?: string | null
    status?: string
}

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value > 0

export class TableService {
    constructor(
        private readonly tableRepository: TableRepository,
        private readonly restaurantRepository: RestaurantRepository
    ) {}

    async create(restaurantId: string, dto: CreateTableDTO): Promise<Table> {
        const restaurant = await this.restaurantRepository.findById(restaurantId)
        if (!restaurant) {
            throw new RestaurantNotFoundError()
        }

        const now = new Date().toISOString()
        const table = this.buildTable({
            id: randomUUID(),
            restaurantId,
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status: dto.status ?? 'libre',
            createdAt: now,
            updatedAt: now
        })

        await this.ensureNumberIsUnique(table)
        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.findById(restaurantId, id)

        const updated = this.buildTable({
            id: existing.id,
            restaurantId: existing.restaurantId,
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status: dto.status ?? existing.status,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        })

        await this.ensureNumberIsUnique(updated)
        await this.tableRepository.save(updated)
        return updated
    }

    async delete(restaurantId: string, id: string): Promise<void> {
        const existing = await this.findById(restaurantId, id)
        if (existing.status !== 'libre') {
            throw new TableNotAvailableError()
        }
        await this.tableRepository.delete(id)
    }

    async findById(restaurantId: string, id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return table
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        return this.tableRepository.findByRestaurantId(restaurantId)
    }

    async findAvailable(restaurantId: string, people: number): Promise<Table[]> {
        if (!isPositiveInteger(people)) {
            throw new InvalidPeopleCountError()
        }
        return this.tableRepository.findAvailable(restaurantId, people)
    }

    async changeStatus(restaurantId: string, id: string, status: string): Promise<Table> {
        const existing = await this.findById(restaurantId, id)
        const updated: Table = {
            ...existing,
            status: normalizeTableStatus(status),
            updatedAt: new Date().toISOString()
        }
        await this.tableRepository.save(updated)
        return updated
    }

    async occupy(restaurantId: string, id: string): Promise<Table> {
        await this.findById(restaurantId, id)

        const occupied = await this.tableRepository.occupyIfFree(id, new Date().toISOString())
        if (!occupied) {
            throw new TableNotAvailableError()
        }
        return this.findById(restaurantId, id)
    }

    private async ensureNumberIsUnique(table: Table): Promise<void> {
        const sameNumber = await this.tableRepository.findByNumber(table.restaurantId, table.number)
        if (sameNumber && sameNumber.id !== table.id) {
            throw new DuplicatedTableNumberError()
        }
    }

    private buildTable(props: {
        id: string
        restaurantId: string
        number: unknown
        description: unknown
        capacity: unknown
        status: string
        createdAt: string
        updatedAt: string
    }): Table {
        if (!isPositiveInteger(props.number)) {
            throw new InvalidTableNumberError()
        }
        if (!isPositiveInteger(props.capacity)) {
            throw new InvalidTableCapacityError()
        }
        const status: TableStatusType = normalizeTableStatus(props.status)

        return {
            id: props.id,
            restaurantId: props.restaurantId,
            number: props.number,
            description: this.normalizeDescription(props.description),
            capacity: props.capacity,
            status,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        }
    }

    private normalizeDescription(value: unknown): string | null {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed === '' ? null : trimmed
    }
}
