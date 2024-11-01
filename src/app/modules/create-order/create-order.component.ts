import { Component, inject, OnInit } from '@angular/core';
import { FormGroup, FormControl, FormArray, Validators } from '@angular/forms';
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

  ngOnInit(): void {
   this.cargarProductos();
  }


  private readonly productoService = inject(ProductoService);

  productosDisponibles: Producto[] = [];

  cargarProductos():void {
    this.productoService.getProducts().subscribe((products)=>{
      this.productosDisponibles = products;
    })
  }

  onProductoSeleccionado(index : number){
    const productoSeleccionado = this.productos.at(index).get('productoNombre')?.value;
    const producto = this.productosDisponibles.find(p => p.id === productoSeleccionado);

    if(producto){
      this.productos.at(index).get('precioUnitario')?.setValue(producto.price);
      this.productos.at(index).get('stock')?.setValue(producto.stock);
      
    }
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


  orderForm : FormGroup = new FormGroup({
    nombreCliente : new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(20)] ),
    emailCliente: new FormControl('', [Validators.required, Validators.email] ),
    productos: new FormArray([]) //donde por dentro cada uno va a ser un form group
  })


  get productos(): FormArray {
    return this.orderForm.get('productos') as FormArray;
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
  }

  eliminarProducto(index: number){
    this.productos.removeAt(index);
    
  }
  

}

