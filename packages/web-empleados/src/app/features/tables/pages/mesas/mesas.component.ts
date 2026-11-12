import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { OrderStore } from '../../../orders/store/order.store';
import { TableStore } from '../../store/table.store';
import { TABLE_STATUSES, Table, TableStatus } from '../../models/table.model';

@Component({
  selector: 'app-mesas',
  standalone: true,
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);
  readonly orderStore = inject(OrderStore);

  readonly statuses = TABLE_STATUSES;

  readonly tablesWithOrders = computed(() => {
    const orders = this.orderStore.orders();
    return this.tableStore.tables().map(table => ({
      table,
      orders: table.status === 'ocupada'
        ? orders.filter(o => o.tableId === table.id)
        : []
    }));
  });

  ngOnInit(): void {
    const restaurantId = this.authStore.user()?.restaurantId;
    if (restaurantId) {
      this.tableStore.loadTables(restaurantId);
      this.orderStore.startPolling(restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.orderStore.stopPolling();
  }

  changeStatus(table: Table, event: Event): void {
    const restaurantId = this.authStore.user()?.restaurantId;
    const status = (event.target as HTMLSelectElement).value as TableStatus;
    if (restaurantId && status !== table.status) {
      this.tableStore.updateStatus(restaurantId, table.id, status);
    }
  }
}
