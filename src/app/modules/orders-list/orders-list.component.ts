import { Component, inject, OnInit } from '@angular/core';
import { Order } from '../../models/order';
import { OrderService } from '../../services/order.service';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, RouterModule ],
  templateUrl: './orders-list.component.html',
  styleUrl: './orders-list.component.css'
})
export class OrdersListComponent implements OnInit {

  private readonly orderService = inject(OrderService);


  allOrders: Order[] = [];
  filteredOrders: Order[] = [];

  search : FormControl = new FormControl('');

  ngOnInit(): void {
    this.getOrders();

  }


  getOrders(){
    this.orderService.getOrders().subscribe({
      next: (data) => {
        this.allOrders = data;
        this.filteredOrders = data;
      },
      error: (error)=>{
        console.error('Error', error);
      }
    })

    this.search.valueChanges.subscribe(data => {
      if(this.search.value == null || this.search.value === ''){
        this.filteredOrders = this.allOrders;
      } else {
        this.filteredOrders = this.allOrders.filter(order => 
          order.customerName.toUpperCase().includes(this.search.value.toUpperCase())
          ||
          order.email.toUpperCase().includes(this.search.value.toUpperCase())
        )
      }
    })
    
  }




}
