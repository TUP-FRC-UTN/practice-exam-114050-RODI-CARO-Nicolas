import { OrderProduct } from "./order-product";
export interface Order {
    id: number,
    customerName: string,
    email: string,
    products: OrderProduct[],
    total: number,
    orderCode: string,
    timestamp: string

}

