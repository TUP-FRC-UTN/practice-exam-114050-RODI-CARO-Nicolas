import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product } from '../models/product';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {

  private readonly httpClient = inject(HttpClient)
  private apiUrl = 'http://localhost:3000/products'

  getProducts():Observable<Product[]> {
    return this.httpClient.get<Product[]>(this.apiUrl);
  }
}
