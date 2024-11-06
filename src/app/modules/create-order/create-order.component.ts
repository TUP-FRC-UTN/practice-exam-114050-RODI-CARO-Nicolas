import { Component, inject, OnInit } from '@angular/core';
import { FormGroup, FormControl, FormArray, Validators, ValidationErrors, AbstractControl, AsyncValidatorFn, ValidatorFn } from '@angular/forms';
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

    
  productosDisponibles: Producto[] = [];
  private readonly productoService = inject(ProductoService);
  private readonly orderService = inject(OrderService);

  isCheckingEmail = false;
  isSubmitting = false;


  discountApplies : boolean = false;

  orderForm : FormGroup = new FormGroup({
    customerName: new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(20)] ),
    email: new FormControl('', [Validators.required, Validators.email], [this.checkOrderLimit()] ),
    products: new FormArray([], [this.validarCantidadProductos(), this.validarProductoUnico(), this.validarCantidadProductosSegunStock()]), //donde por dentro cada uno va a ser un form group
    total: new FormControl(''),
    orderCode : new FormControl(''),
    timestamp : new FormControl(new Date())
  });

  constructor(){ }

  /*
  this.orderForm.get('emailCliente')?.statusChanges.subscribe(status => {
    this.isCheckingEmail = status === 'PENDING';
  }); */


  get products(): FormArray {
    return this.orderForm.get('products') as FormArray;
  }

  
  agregarProducto(){
    const producto = new FormGroup({
      productId: new FormControl('', Validators.required),
      quantity: new FormControl(1, [Validators.required, Validators.min(1)]),
      price : new FormControl({value: 0, disabled: true}),
      stock: new FormControl({value : 0, disabled: true})
    });
    this.products.push(producto);
    this.updateTotal()
    this.products.setValidators(this.validarProductoUnico());
    this.products.setValidators(this.validarCantidadProductos());
    this.products.setValidators(this.validarCantidadProductosSegunStock());
  }


  // Validaciones sincronicas




  validarProductoUnico(): ValidatorFn {
    return (control : AbstractControl): ValidationErrors | null => {
      const products = control as FormArray
      if(!products || products.length === 0){
        return null;
      }
      const ids = products.controls.map(control => control.get('productId')?.value)
      const hasDuplicates = ids.some((id, index) => ids.indexOf(id) !== index );
      
      //indexOf retorna el indice del primer miembro de la lista con el valor evaluado
      //Entonces se pregunta si para alguno de los miembros de la lista devuelve un indice
        //distinto de su indice actual
        return hasDuplicates ? {'duplicates' : true} : null;

    }
  }

  validarCantidadProductos() : ValidatorFn {
    return (control : AbstractControl) : ValidationErrors | null => {
      const array = control as FormArray;
      return (array.length < 1 && array.length > 10) ? {'productLimitError': true} : null 
    }
  }




  validarCantidadProductosSegunStock() : ValidatorFn {
    return (control : AbstractControl) : ValidationErrors | null => {
      const products = control as FormArray;
     if(!products || products.length === 0 ){
      return null;
     }
     const productsWithInvalidStock = products?.controls.some(productGroup => {
      const quantity = productGroup.get('quantity')?.value;
      const stock = productGroup.get('stock')?.value;
      return quantity > stock;
     });
     return productsWithInvalidStock ? {'stockExcedido': true}:null;
    }
  }


  getProductNameById(productId: string){
    return this.productosDisponibles.find(p=> p.id == productId)?.name;
  }









  //Validacion asincronica orderForm.mail

  checkOrderLimit() : AsyncValidatorFn {
    return (control : AbstractControl): Observable<ValidationErrors | null> =>{
      
      const email = control.value;
      if(!email){
        return of(null);
      }

      return this.orderService.getOrdersByEmail(email).pipe(
        map(orders => {
          const now = new Date();
          const last24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          console.log('last 24 hours: ', last24Hours)
          const recentOrders = orders.filter(order => {
            const orderDate = new Date(order.timestamp);
            return orderDate >= last24Hours;
          });
          console.log('recent orders: ', recentOrders)
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



  cargarProductos():void {
    this.productoService.getProducts().subscribe((products)=>{
      this.productosDisponibles = products;
    })
  }

  onProductoSeleccionado(index : number){
    const productoSeleccionado = this.products.at(index).get('productId')?.value;
    const producto = this.productosDisponibles.find(p => p.id === productoSeleccionado);

    if(producto){
      this.products.at(index).patchValue({
        price: producto.price,
        stock: producto.stock
      })
      
    }
    this.updateTotal();
    this.products.setValidators(this.validarCantidadProductos());
    this.products.setValidators(this.validarProductoUnico());
    this.products.setValidators(this.validarCantidadProductosSegunStock());
  }




  updateTotal(){
        const total = this.calculateTotal();
        this.discountApplies = total > 1000;
        if(this.discountApplies){
          this.orderForm.patchValue({total: total * 0.9})
        } else {
          this.orderForm.patchValue({total: total})
        };
    
  }

  private calculateTotal(){
    let total = 0;
    this.products.controls.forEach(p=> {
      const quantity = p.get('quantity')?.value;
      const price = p.get('price')?.value;

      total += quantity * price;
    })
    return total;
  }

  onCantidadChange(index: number){
    this.actualizarStockRestante(index);
    this.actualizarPrecioSubtotal(index);
  }


  actualizarStockRestante(index : number){
    const cantidad = this.products.at(index).get('quantity')?.value;
    const stockActual = this.products.at(index).get('stock')?.value;
    const stockRestante = stockActual - cantidad;
    this.products.at(index).get('stock')?.setValue(stockRestante);
    
  }


  
  actualizarPrecioSubtotal(index: number){
    const cantidad = this.products.at(index).get('quantity')?.value;
    const precioUnitario = this.products.at(index).get('price')?.value;
    const precioSubtotal = cantidad * precioUnitario;
    this.products.at(index).get('price')?.setValue(precioSubtotal);

  }




  eliminarProducto(index: number){
    this.products.removeAt(index);
    this.products.updateValueAndValidity();
    
  }

  sendForm(){

    this.orderForm.patchValue(
      {
        orderCode: this.generateOrderCode()
      }
    )
    console.log('sendForm - this.orderForm: ', this.orderForm);

    if(this.orderForm.valid){
      const order = this.orderForm.value as Order;
      console.log('se castea el form a objeto Order: ', order);

      this.orderService.createOrder(order).pipe(
        finalize(()=>{
          this.isSubmitting = false;
        })
      )
      .subscribe({
        next: (createdOrder) => {
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

