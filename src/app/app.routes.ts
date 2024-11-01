import { Routes } from '@angular/router';
import { CreateOrderComponent } from './modules/create-order/create-order.component';
import { OrdersListComponent } from './modules/orders-list/orders-list.component';
export const routes: Routes = [

    {
        path: 'create-order',
        component: CreateOrderComponent,
    },

    {
        path: 'orders',
        component: OrdersListComponent
    }
];
