import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { HttpErrorResponse } from '@angular/common/http'
import { TableService } from '../../core/services/table.service'
import { RestaurantService } from '../../core/services/restaurant.service'
import { CartStore } from '../../core/store/cart.store'
import { Table } from '../../core/models/table.model'
import { Restaurant } from '../../core/models/restaurant.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>{{ restaurant()?.name || 'Cargando...' }}</h1>
          <p>Elige tu mesa</p>
        </div>
      </div>

      <div class="people-form card">
        <label for="people">¿Cuántas personas sois?</label>
        <input id="people" type="number" min="1" step="1" [ngModel]="people()" (ngModelChange)="people.set($event)" />
        <button class="btn btn-primary" [disabled]="!validPeople() || loading()" (click)="search()">
          Buscar mesas
        </button>
      </div>

      @if (warning()) {
        <div class="alert-error">{{ warning() }}</div>
      }
      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (searched()) {
        @if (tables().length === 0 && !error()) {
          <div class="empty-state card">
            <p>No hay mesas libres para {{ searchedPeople() }} personas</p>
          </div>
        } @else {
          <div class="tables-grid">
            @for (table of tables(); track table.id) {
              <button type="button" class="table-card card" [class.selected]="selected()?.id === table.id"
                      (click)="selected.set(table)">
                <h3>Mesa {{ table.number }}</h3>
                <p class="capacity">Capacidad: {{ table.capacity }}</p>
                @if (table.description) {
                  <p class="description">{{ table.description }}</p>
                }
              </button>
            }
          </div>
          <div class="actions">
            <button class="btn btn-primary" [disabled]="!selected() || occupying()" (click)="continue()">
              @if (occupying()) { Reservando mesa... } @else { Continuar }
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .container { max-width: 900px; margin: 0 auto; }
    .back-link { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; display: inline-block; }
    .people-form { display: flex; align-items: center; gap: 12px; padding: 16px 20px; margin-bottom: 20px; flex-wrap: wrap; }
    .people-form input { width: 80px; }
    .tables-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .table-card { text-align: left; padding: 16px 20px; cursor: pointer; border: 1px solid var(--border-color); }
    .table-card:hover, .table-card.selected { border-color: var(--green-medium); }
    .table-card.selected { background: var(--green-glow); }
    .table-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .capacity { color: var(--text-secondary); font-size: 13px; }
    .description { color: var(--text-muted); font-size: 13px; margin-top: 4px; }
    .actions { margin-top: 20px; display: flex; justify-content: flex-end; }
  `]
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly tableService = inject(TableService)
  private readonly restaurantService = inject(RestaurantService)
  private readonly cartStore = inject(CartStore)

  private restaurantId = ''
  readonly restaurant = signal<Restaurant | null>(null)
  readonly people = signal<number | null>(2)
  readonly searchedPeople = signal<number | null>(null)
  readonly tables = signal<Table[]>([])
  readonly selected = signal<Table | null>(null)
  readonly loading = signal(false)
  readonly occupying = signal(false)
  readonly searched = signal(false)
  readonly error = signal<string | null>(null)
  readonly warning = signal<string | null>(null)

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!
    this.restaurantService.getById(this.restaurantId).subscribe({
      next: (r) => this.restaurant.set(r),
      error: () => {}
    })
  }

  validPeople(): boolean {
    const p = Number(this.people())
    return Number.isInteger(p) && p > 0
  }

  search(): void {
    if (!this.validPeople()) return
    this.load()
  }

  private load(): void {
    const people = Number(this.people())
    this.loading.set(true)
    this.error.set(null)
    this.selected.set(null)
    this.tableService.getAvailable(this.restaurantId, people).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        this.searchedPeople.set(people)
        this.searched.set(true)
        this.loading.set(false)
      },
      error: () => {
        this.tables.set([])
        this.searched.set(true)
        this.error.set('Error al cargar las mesas disponibles')
        this.loading.set(false)
      }
    })
  }

  continue(): void {
    const table = this.selected()
    if (!table) return
    this.occupying.set(true)
    this.warning.set(null)
    this.error.set(null)
    this.tableService.occupy(this.restaurantId, table.id).subscribe({
      next: (occupied) => {
        this.cartStore.selectTable(this.restaurantId, occupied.id, occupied.number)
        this.router.navigate(['/restaurants', this.restaurantId, 'menu'])
      },
      error: (err: HttpErrorResponse) => {
        this.occupying.set(false)
        if (err.status === 409) {
          this.warning.set('La mesa ya no está disponible. Elige otra.')
          this.load()
        } else {
          this.error.set('Error al ocupar la mesa. Inténtalo de nuevo.')
        }
      }
    })
  }
}
