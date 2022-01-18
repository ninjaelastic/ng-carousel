[Live Demo](https://stackblitz.com/edit/angular-ivy-5gg843?file=src/app/app.component.html)

## How to install

```
npm i ngx-magic-carousel
```


## Usage

Add CarouselModule to imports from "ngx-magic-carousel".
```typescript
import { CarouselModule } from 'ngx-magic-carousel';

...

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [CarouselModule],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

And insert component to template
```angular2html
<ngx-magic-carousel
  [height]="350"
  [cellWidth]="260"
  [margin]="16"
  [marginFirst]="16"
  [marginLast]="16"
  [transition]="300"
>
  <ng-container ngProjectAs="carousel-cells">
    <div class="carousel-cell" *ngFor="let slide of slides;">
      {{slide.id}}
    </div>
  </ng-container>
</ngx-magic-carousel>
```
