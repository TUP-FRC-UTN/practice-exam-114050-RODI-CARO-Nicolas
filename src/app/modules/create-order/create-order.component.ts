import { Component, inject, OnInit } from '@angular/core';
import { FormGroup, FormControl, FormArray, Validators, ValidationErrors, AbstractControl, AsyncValidatorFn, ValidatorFn } from '@angular/forms';
import { Product } from '../../models/product';
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

  private readonly productoService = inject(ProductoService);
  private readonly orderService = inject(OrderService);

  availableProducts: Product[] = [];
  
  //Variables para calcular totales
  discountApplies : boolean = false;
  orderTotal = 0;

  //Arreglo para visualizacion en HTML
  selectedProducts : Product[] = [];


  orderForm : FormGroup = new FormGroup({
    customerName: new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(20)] ),
    email: new FormControl('', [Validators.required, Validators.email], [this.checkOrderLimit()] ),
    products: new FormArray([], [this.validarCantidadProductos(), this.validarProductoUnico()]), //donde por dentro cada uno va a ser un form group
  
  });

  constructor(){ }

  ngOnInit(): void {
    this.loadProducts();
    this.updateSelectedProducts();
   }

   
  get productsFormArray(): FormArray {
    return this.orderForm.get('products') as FormArray;
  }
 
 
 
   loadProducts():void {
     this.productoService.getProducts().subscribe( {
      next: (data) => {
        this.availableProducts = data;
      },
      error: (err)=>{
        console.log('Error obteniendo productos: ', err)
      }
     }
     )
   }



  addProduct(){
    const productForm = new FormGroup({
      productId: new FormControl('', Validators.required),
      quantity: new FormControl(1),
      price : new FormControl(0),
      stock: new FormControl(0)
    });


    this.productsFormArray.push(productForm);
    this.updateTotal()

  }

  

  removeProduct(index: number){
    this.productsFormArray.removeAt(index);
    this.updateTotal();
    this.updateSelectedProducts();
    
    this.productsFormArray.updateValueAndValidity();


    }
  


  //Listeners de cambio de valor en inputs

  onSelectedProductChange(index : number){
    const productForm = this.productsFormArray.at(index);
    const selectedProductId =productForm.get('productId')?.value;
    const product = this.availableProducts.find(p => p.id === selectedProductId);
    console.log('onSelectedProductChange-product: ', product)

    if(product){
      this.productsFormArray.at(index).patchValue({
        price: product.price,
        stock: product.stock
      })
      const quantityControl = productForm.get('quantity');
      quantityControl?.setValidators( [Validators.required, Validators.min(1), Validators.max(product.stock) ])
      this.updateSubtotalPrice(index); //Para la visualizacion del precio multiplicado por cantidad, no requerido en el enunciado
      this.updateSelectedProducts() // Para la visualizacion del detalle en HTML


      
    }
  }

  onCantidadChange(index: number){

    this.updateSelectedProducts();
    this.updateSubtotalPrice(index); //Internamente llama a updateTotalPrice
  }


// Metodos actualizadores de valores

  updateTotal(){
    const total = this.calculateTotal();
    this.discountApplies = total > 1000;
    this.orderTotal = this.discountApplies ? total * 0.9 : total;

}

  private calculateTotal(){
  let total = 0;
  this.productsFormArray.controls.forEach(p=> {
    const quantity = p.get('quantity')?.value;
    const price = p.get('price')?.value;

    total += quantity * price;
  })
  return total;
  }



  updateSubtotalPrice(index: number){
  const cantidad = this.productsFormArray.at(index).get('quantity')?.value;
  const productoId = this.productsFormArray.at(index).get('productId')?.value;

  const producto = this.availableProducts.find(p => p.id === productoId);
  if(producto){
  const precioUnitario = producto.price;
  const precioSubtotal = cantidad * precioUnitario;
  this.productsFormArray.at(index).get('price')?.setValue(precioSubtotal);
  this.updateTotal();

  }

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
            const orderDate = order.timestamp ? new Date(order.timestamp) : new Date();
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




  
  //Helpers para visualizacion en HTML
  getProductNameById(productId: string){
  
    console.log(' this.availableProducts.find(p=> p.id == productId)?.name: ',  this.availableProducts.find(p=> p.id == productId)?.name )
    return this.availableProducts.find(p=> p.id == productId)?.name;
  }

  //Muta el arreglo de selectedProducts cada vez que se lo llama
  updateSelectedProducts(){
    const productsFormArrayControls = this.productsFormArray.controls;
    this.selectedProducts = productsFormArrayControls.map( control => {
      const productId = control.get('productId')?.value;
      const product = this.availableProducts.find(p=> p.id.toString()=== productId);
      return {
        id: product?.id || '',
        name: product?.name || '',
        quantity: control.get('quantity')?.value,
        price: control.get('price')?.value,
        stock: product?.stock
      };

    }) as Product[]
  }







  sendForm(){


    console.log('sendForm - this.orderForm: ', this.orderForm);

    if(this.orderForm.valid){
      const orderFormValue = this.orderForm.value
      console.log('order form value: ', orderFormValue);

      //como no tiene exactamente la misma estructura que el objeto Order, no se podría castear con el 
      //this.orderForm.value as Order;

      
      const order: Order ={
        customerName: orderFormValue.customerName,
        email: orderFormValue.email,
        products: orderFormValue.products,
        total: parseFloat(this.orderTotal.toFixed(2)),
        orderCode: this.generateOrderCode(orderFormValue.customerName, orderFormValue.email),
        timestamp: new Date().toISOString(),
      }
      console.log("order object before createOrder: ", order)
      this.orderService.createOrder(order).pipe(
        finalize(()=>{
        //  this.isSubmitting = false;
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


  private generateOrderCode(name: string, email: string): string {

    const nameFirstLetter = name.charAt(0).toUpperCase();
    const emailSufffix = email.slice(-4);
    const timestamp = new Date().toJSON();
    return `${nameFirstLetter}${emailSufffix}${timestamp}`
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

