import { NgModule } from '@angular/core';
import { CarouselComponent } from './carousel.component';
import {CommonModule} from "@angular/common";
import {ObserversModule} from "@angular/cdk/observers";



@NgModule({
  declarations: [
    CarouselComponent
  ],
  imports: [CommonModule,
    ObserversModule],
  exports: [
    CarouselComponent
  ]
})
export class CarouselModule { }
