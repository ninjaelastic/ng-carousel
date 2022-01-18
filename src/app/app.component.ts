import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import { CarouselEvent } from 'ngx-magic-carousel';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  title = 'app-test';
  slides = [
    'https://sun6-20.userapi.com/s/v1/ig2/884CSEuqZaRTNYM3Hn8YVkOLsugijMCR_LSYRdGULokVMz5-CR1SApEf6-zmxMsKyGjN1Z9YZwjUhkx1XAaf3wn8.jpg?size=400x0&quality=96&crop=1,0,936,936&ava=1',
    'https://i.pinimg.com/736x/bd/79/29/bd7929efa02ce8e32d633567a6123025.jpg',
    'https://sun1-30.userapi.com/s/v1/if1/VyuAkyQe6vD0SonMA9iK0k0OSW4dhsIIhTrFcj0Io-I5d2Ti_CGBvbfYWLf2xJuSxaMbh_Vx.jpg?size=400x0&quality=96&crop=76,0,298,298&ava=1',
    'https://sun6-23.userapi.com/s/v1/ig2/icCrulF60BZRLsmJO5AMB08m1A70khF9mUuYn1ziF9UXFGkGvu6s4RLipSiy0wouPfYq5-Zn86zZaQqZgaYU2Aop.jpg?size=400x0&quality=96&crop=1,98,867,867&ava=1',
    'http://1.bp.blogspot.com/-5bq9cnLWEqM/Te3PRBPN3qI/AAAAAAAAC4w/wfGqEHspFRY/s400/4d7b9f4f34d13.jpg',
    'https://pbs.twimg.com/profile_images/1298790474799616000/xNB_SFc__400x400.jpg',
  ];
  inited = false;

  constructor(public cd: ChangeDetectorRef) {}

  removeFirst() {
    this.slides.shift();
  }

  onEvent(e: CarouselEvent) {
    if (e.name === 'ready') {
      this.inited = true
    }
    this.cd.detectChanges();
  }

  clickHandler(str: string) {
    console.log(str)
  }

  first = 16;
  last = 16;
  margin = 16;
  width =  260
  height =  350
  cellsToShow = 0
  change(first: string, margin: string, last: string, width: string, height: string, cellsToShow: string) {
    this.first = Number(first)
    this.last = Number(last)
    this.margin = Number(margin)
    this.width = Number(width)
    this.height = Number(height)
    this.cellsToShow = Number(cellsToShow)
  }
}
