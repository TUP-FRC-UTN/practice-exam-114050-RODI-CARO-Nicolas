import { Component, inject, OnInit } from '@angular/core';
import { FormGroup, FormControl, FormArray, Validators, ValidationErrors, AbstractControl, AsyncValidatorFn } from '@angular/forms';
import { Producto } from '../../models/producto';
import { ProductoService } from '../../services/producto.service';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../services/order.service';
import { Observable, of, debounceTime, map, catchError, finalize } from 'rxjs';
import { Order } from '../../models/order';
import { OrderProduct } from '../../models/order-product';

@Component({
  selector: 'app-create-order',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './create-order.component.html',
  styleUrl: './create-order.component.css'
})
export class CreateOrderComponent implements OnInit {

  orderForm : FormGroup;

  constructor(){
    this.orderForm = new FormGroup({
      nombreCliente: new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(20)] ),
      emailCliente: new FormControl('', [Validators.required, Validators.email], [this.checkOrderLimit()] ),
      productos: new FormArray([]), //donde por dentro cada uno va a ser un form group
    });
    
  const productosArray = this.orderForm.get('productos') as FormArray;
  productosArray.setValidators(this.chequearProductosDuplicados.bind(this));

  this.orderForm.get('emailCliente')?.statusChanges.subscribe(status => {
    this.isCheckingEmail = status === 'PENDING';
  });
  }


  isCheckingEmail = false;
  isSubmitting = false;

  hayErrorLimiteOrdenes(): boolean {
    const emailControls = this.orderForm.get('emailCliente');
    return emailControls?.errors?.['orderLimit'] !== undefined;
  }

  getMensajeErrorLimiteOrdenes():string {
    const emailControl = this.orderForm.get('emailCliente');
    return emailControl?.errors?.['orderLimit']?.message || '';
  }

  
  productosDisponibles: Producto[] = [];
  private readonly productoService = inject(ProductoService);
  private readonly orderService = inject(OrderService);

  checkOrderLimit() : AsyncValidatorFn {
    return (control : AbstractControl): Observable<ValidationErrors | null> =>{
      
      const email = control.value;
      if(!email){
        return of(null);
      }

      return this.orderService.getOrdersByEmail(email).pipe(
        debounceTime(300),
        map(orders => {
          const now = new Date();
          const last24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          const recentOrders = orders.filter(order => {
            const orderDate = new Date(order.timestamp);
            return orderDate >= last24Hours;
          });
          return recentOrders.length >= 3 ? 
          {orderLimit : {message: 'Has excedido el límite de 3 pedidos en 24 horas'}} 
          : null;
        }),
        catchError(()=>{
          console.error('Error al verificar límite de pedidos');
          return of(null);
        })
      );
    }
  }


  ngOnInit(): void {
   this.cargarProductos();
  }

  get productos(): FormArray {
    return this.orderForm.get('productos') as FormArray;
  }


  cargarProductos():void {
    this.productoService.getProducts().subscribe((products)=>{
      this.productosDisponibles = products;
    })
  }

  onProductoSeleccionado(index : number){
    const productoSeleccionado = this.productos.at(index).get('productoNombre')?.value;
    const producto = this.productosDisponibles.find(p => p.id === productoSeleccionado);

    if(producto){
      this.productos.at(index).patchValue({
        precioUnitario: producto.price,
        stock: producto.stock
      })
      
    }

    this.productos.updateValueAndValidity();
  }


  actualizarStockRestante(index : number){
    const cantidad = this.productos.at(index).get('cantidad')?.value;
    const stockActual = this.productos.at(index).get('stock')?.value;
    const stockRestante = stockActual - cantidad;
    this.productos.at(index).get('stock')?.setValue(stockRestante);
    
  }

  onCantidadChange(index: number){
    this.actualizarStockRestante(index);
    this.actualizarPrecioSubtotal(index);
  }

  
  actualizarPrecioSubtotal(index: number){
    const cantidad = this.productos.at(index).get('cantidad')?.value;
    const precioUnitario = this.productos.at(index).get('precioUnitario')?.value;
    const precioSubtotal = cantidad * precioUnitario;
    this.productos.at(index).get('precioSubtotal')?.setValue(precioSubtotal);

  }


  chequearProductosDuplicados( control : AbstractControl): ValidationErrors | null {
    const productos = control as FormArray;
    if(!productos || productos.length === 0 ){
      return null;
    }
    const productIds = productos.controls.map(control => 
      control.get('productoNombre')?.value
     );

     const hayDuplicados = productIds.some( (id, index)=> 
    id && productIds.indexOf(id) !== index);

    return hayDuplicados ? {duplicateProducts : true} : null;
  }

  hayProductosDuplicados(): boolean {
    return this.productos.errors?.['duplicateProducts'] || false;
  }



  agregarProducto(){
    const producto = new FormGroup({
      productoNombre: new FormControl('', Validators.required),
      cantidad: new FormControl(1, [Validators.required, Validators.min(1)]),
      precioUnitario : new FormControl({value: 0, disabled: true}),
      precioSubtotal: new FormControl({value: 0, disabled: true }),
      stock: new FormControl({value : 0, disabled: true})
    });
    this.productos.push(producto);

    producto.get('productoNombre')?.valueChanges.subscribe(()=>{
      this.productos.updateValueAndValidity();
    })
  }

  eliminarProducto(index: number){
    this.productos.removeAt(index);
    this.productos.updateValueAndValidity();
    
  }

  sendForm(){
    if(this.orderForm.valid){
      this.isSubmitting = true;
      const formValues = this.orderForm.value;

      const order: Order ={
        customerName: formValues.nombreCliente,
        email: formValues.emailCliente,
        products: this.mapProductsToOrderProducts(formValues.productos),
        total: this.calculateTotal(formValues.productos),
        orderCode: this.generateOrderCode(),
        timestamp: new Date().toISOString(),
      } as Order;
      
      this.orderService.createOrder(order)
      .pipe(
        finalize( () => {
          this.isSubmitting = false;
        })
      ).subscribe({
        next: (createdOrder) => {
          console.log('Orden creada exitosamente: ', createdOrder);
          this.showSuccesMessage();
        },
        error: (error) => {
          console.error('Error al crear la orden ', error)
          this.showErrorMessage(error);
        }
      })
      
    }
  }

  showSuccesMessage(){
    alert('Orden creada exitosamente');
  }

  showErrorMessage(error: any){
    alert('Error al crear la orden')
  }

  private mapProductsToOrderProducts(formProducts: any[]): OrderProduct[]{
    return formProducts.map(fp => ({
      productId: fp.productoNombre,
      quantity: fp.cantidad,
      stock: fp.stock,
      price: fp.precioUnitario
    }))
  }

  private calculateTotal(products: any[]){
    return products.reduce((total, product)=>{
      return total + (product.cantidad * product.precioUnitario);
    })
  }

  private generateOrderCode(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000 );
    return `ORD-${timestamp}-${random}`;
  }

  private markFormAsTouched(){
    Object.values(this.orderForm.controls).forEach(control => {
      if(control instanceof FormControl){
        control.markAsTouched();
      } else if (control instanceof FormArray){
        control.controls.forEach(c=>{
          if(c instanceof FormGroup){
            Object.values(c.controls).forEach(fc => fc.markAllAsTouched());
          }
        })
      }
    })
  }
  
}

