import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'app-test';
  arr = [1,2,3,4,5,6]

  removeFirst() {
    this.arr.shift()
    console.log(this.arr)
  }
}
