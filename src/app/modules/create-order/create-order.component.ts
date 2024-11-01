import { Component, inject, OnInit } from '@angular/core';
import { FormGroup, FormControl, FormArray, Validators, ValidationErrors, AbstractControl } from '@angular/forms';
import { Producto } from '../../models/producto';
import { ProductoService } from '../../services/producto.service';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

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
      emailCliente: new FormControl('', [Validators.required, Validators.email] ),
      productos: new FormArray([]), //donde por dentro cada uno va a ser un form group
    });
    
  const productosArray = this.orderForm.get('productos') as FormArray;
  productosArray.setValidators(this.chequearProductosDuplicados.bind(this));
  }



  
  productosDisponibles: Producto[] = [];
  private readonly productoService = inject(ProductoService);

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
      
    }
  }
  
}

