import { OrderProduct } from "./order-product";
import { Producto } from "./product";
export interface Order {
    id: number,
    customerName: string,
    email: string,
    products: Producto[],
    total: number,
    orderCode: string,
    timestamp: string

}

