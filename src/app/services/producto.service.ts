import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Producto } from '../models/product';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {

  private readonly httpClient = inject(HttpClient)
  private apiUrl = 'http://localhost:3000/products'

  getProducts():Observable<Producto[]> {
    return this.httpClient.get<Producto[]>(this.apiUrl);
  }
}
