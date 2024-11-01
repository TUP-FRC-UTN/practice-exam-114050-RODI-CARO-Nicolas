import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Order } from '../models/order';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class OrderService {

  private readonly httpClient = inject(HttpClient)
  private apiUrl = 'http://localhost:3000/orders'

  
  getOrders():Observable<Order[]> {
    return this.httpClient.get<Order[]>(this.apiUrl);
  }

  getOrdersByEmail(email : string):Observable<Order[]>{
    const url = `${this.apiUrl}?email=${encodeURIComponent(email)}`;
    return this.httpClient.get<Order[]>(url);
  }

  createOrder(order : Order): Observable<Order >{
    return this.httpClient.post<Order>(this.apiUrl, order);

  }

}
