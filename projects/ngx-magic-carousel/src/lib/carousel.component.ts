import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener, Inject, Optional,
  Input,
  OnChanges,
  Output,
  Renderer2,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {fromEvent, Subject, timer} from 'rxjs';
import {UntilDestroy, untilDestroyed} from '@ngneat/until-destroy';
import {distinctUntilChanged, filter, takeUntil, tap} from 'rxjs/operators';
import {MAGIC_CAROUSEL_MAX_ANGLE_DEGREES} from "./tokens";

@UntilDestroy()
@Component({
  selector: 'ngx-magic-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarouselComponent implements OnChanges, AfterViewInit {
  @Input() height = 0;
  @Input() cellWidth = 0;
  @Input() margin = 16;
  @Input() marginFirst = 0;
  @Input() marginLast = 0;
  @Input() transition = 300;
  @Input() minSwipeDistance = 10;
  @Input() cellsToShow = 0;
  @Input() arrows = false;
  @Input() hideArrowsByLimit = false;
  @Input() swipeByMouse = false;
  @Output() private events = new EventEmitter<CarouselEvent>();
  @ViewChild('cellsRef', {static: true}) private cellsRef!: ElementRef<HTMLElement>;
  @HostBinding('style.height.px') private get hostHeight() {
    return this.height;
  }
  @HostListener('window:resize') private onResize() {
    if (this.elementRef.nativeElement.offsetWidth !== this.hostWidth) {
      this.hostWidth = this.elementRef.nativeElement.offsetWidth;
      this.contentChanged()
    }
  }

  @HostListener('window:mousemove', ['$event']) private onMouseMove($event: MouseEvent) {
    this.mouseHandler($event, this.pointerMove$);
  }
  @HostListener('mousedown', ['$event']) private onMouseDown($event: MouseEvent) {
    this.mouseHandler($event, this.pointerDown$);
  }
  @HostListener('window:mouseup', ['$event']) private onMouseUp($event: MouseEvent) {
    this.mouseHandler($event, this.pointerUp$,);
  }

  private mouseHandler($event: MouseEvent, subject: Subject<PointerPosition>) {
    if (!this.swipeByMouse) return;
    const { clientX, clientY, screenX, screenY } = $event;
    subject.next({ clientX, clientY, screenX, screenY })
  }

  get movementX() {
    return Math.round(this.touchEnd.x - this.touchStart.x);
  }

  set active(active: number) {
    this.cd.markForCheck();
    if (active > this.translateList.length - 1) {
      this.activeIndex = this.translateList.length - 1;
      console.warn('Active index greater than possible.');
      return;
    }
    if (active < 0 ) {
      this.activeIndex = 0;
      console.warn('Active index less than possible.');
      return;
    }
    this.activeIndex = active;
  }
  get active() {
    return this.activeIndex;
  }
  private activeIndex = 0;

  private eventSlideTo$ = new Subject();
  private eventType!: CarouselEventType;

  private touchStart = {
    x: 0,
    y: 0,
  };
  private touchEnd = {
    x: 0,
    y: 0,
  };
  private translateX = 0;
  private translateStart = {
    x: 0,
    y: 0,
  };

  private pointerMove$ = new Subject<PointerPosition>();
  private pointerDown$ = new Subject<PointerPosition>();
  private pointerUp$ = new Subject<PointerPosition>();
  private touchEvent!: TouchEvent;
  private pointerPressed = false;
  private hostWidth = 0;
  private slidesInView = 1;
  private cells: number[] = [];
  private translateList: number[] = [];
  private touchIdentifier = 0;
  private timeFirstTouch = 0;
  private maxDelayBetweenTouches = 500;
  private maxAngleDegrees = 45;

  constructor(
    private readonly elementRef: ElementRef,
    private readonly renderer2: Renderer2,
    private readonly cd: ChangeDetectorRef,
    @Optional() @Inject(MAGIC_CAROUSEL_MAX_ANGLE_DEGREES) maxAngleDegrees: number
  ) {
    if (maxAngleDegrees === null) return;
    if (maxAngleDegrees < 0 || maxAngleDegrees > 90) {
      console.warn(`The specified provider "MAGIC_CAROUSEL_MAX_ANGLE_DEGREES" value is incorrect. The value ${this.maxAngleDegrees} will be used.`)
      return;
    }
    this.maxAngleDegrees = maxAngleDegrees;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.cellsToShow?.currentValue) {
      this.cellWidth = 0;
      this.marginLast = 0;
      this.marginFirst = 0;
    }
    this.contentChanged();
  }

  ngAfterViewInit() {
    this.hostWidth = this.elementRef.nativeElement.offsetWidth;
    if ('ontouchstart' in window) {
      this.onTouchstart();
      this.onTouchmove();
      this.onTouchend();
    }
    this.subscribeToPointerDown();
    this.subscribeToPointerMove();
    this.subscribeToPointerUp();
    this.contentChanged();
    this.events.emit({name: 'ready'})
  }

  private onTouchstart() {
    fromEvent<TouchEvent>(this.cellsRef.nativeElement, 'touchstart')
      .pipe(untilDestroyed(this))
      .subscribe((e: TouchEvent) => {
        const isPinchEvent = e.touches.length > 1 && !this.eventType;
        const alreadyMoving = this.movementX && this.pointerPressed;
        if (isPinchEvent || alreadyMoving) return;
        this.touchIdentifier = e.touches[0].identifier;
        const now = Date.now();
        if (e.touches.length === 1) {
          this.timeFirstTouch = now;
        }
        if (e.touches.length > 1 && this.eventType !== 'horizontal-swipe' && now - this.timeFirstTouch <= this.maxDelayBetweenTouches) {
          this.eventType = 'vertical-swipe'
        }

        const { clientX, clientY, screenX, screenY } = e.touches[0];
        this.pointerDown$.next({ clientX, clientY, screenX, screenY });
      });
  }

  private onTouchmove() {
    fromEvent<TouchEvent>(this.cellsRef.nativeElement, 'touchmove')
      .pipe(distinctUntilChanged(), untilDestroyed(this))
      .subscribe((e: TouchEvent) => {
        this.touchEvent = e;
        const { clientX, clientY, screenX, screenY } = e.touches[0];
        this.pointerMove$.next({ clientX, clientY, screenX, screenY });
      });
  }

  private onTouchend() {
    fromEvent<TouchEvent>(this.cellsRef.nativeElement, 'touchend')
      .pipe(untilDestroyed(this))
      .subscribe((e) => {
        if (e.changedTouches[0].identifier !== this.touchIdentifier) return;
        this.touchEvent = e;
        const { clientX, clientY, screenX, screenY } = e.changedTouches[0];
        this.pointerUp$.next({ clientX, clientY, screenX, screenY });
      });
  }

  private subscribeToPointerDown() {
    this.pointerDown$.pipe(untilDestroyed(this)).subscribe(position => {
      this.pointerPressed = true;
      this.translateStart.x = this.translateX;
      this.touchStart.x = position.screenX;
      this.touchStart.y = position.screenY;
      this.touchEnd.x = position.screenX;
      this.touchEnd.y = position.screenY;
      this.events.emit({ name: 'touchStart' });
    });
  }

  private subscribeToPointerMove() {
    this.pointerMove$
      .pipe(
        filter(() => this.pointerPressed),
        distinctUntilChanged(),
        tap(position => {
          this.cd.markForCheck()
          this.touchEnd.x = position.screenX;
          this.touchEnd.y = position.screenY;
          if (this.eventType === undefined) {
            this.eventType = this.getLinearSwipeType(position);
          }
          if (this.eventType === 'horizontal-swipe' && this.touchEvent) {
            this.touchEvent.preventDefault();
          }
        }),
        filter(() => this.eventType === 'horizontal-swipe'),
        untilDestroyed(this),
      )
      .subscribe((e: PointerPosition) => {
        this.cd.markForCheck();
        if(this.greaterThanLimit(e)) return;
        let multyply = 1;
        this.translateX = this.translateStart.x - this.movementX * multyply
        this.events.emit({ name: 'move' });
        this.cd.detectChanges()
      });
  }

  private subscribeToPointerUp() {
    this.pointerUp$.pipe(untilDestroyed(this)).subscribe(() => {
      this.cd.markForCheck();
      this.pointerPressed = false;
      if (Math.abs(this.movementX) >= this.minSwipeDistance && this.eventType === 'horizontal-swipe') {
        this.goToNearestSlide();
      }
      this.touchStart = { x: 0, y: 0 };
      this.touchEnd = { x: 0, y: 0 };
      this.eventType = undefined;
      this.active = this.activeIndex;
      this.events.emit({ name: 'touchEnd' });
    });
  }

  private getLinearSwipeType(position: PointerPosition) {
    if (this.eventType !== 'horizontal-swipe' && this.eventType !== 'vertical-swipe') {
      if (!this.touchEvent) return 'horizontal-swipe'
      const movementX = Math.abs(position.screenX - this.touchStart.x);
      const movementY = Math.abs(position.screenY - this.touchStart.y);
      // if (Math.pow(movementX, 2) + Math.pow(movementY, 2) < 25) return this.eventType;
      const angleRad = Math.atan( movementY / movementX);
      const angleDegrees = angleRad * 180 / Math.PI;
      return angleDegrees <= this.maxAngleDegrees ? 'horizontal-swipe' : 'vertical-swipe';
    } else {
      return this.eventType;
    }
  }

  private greaterThanLimit(e: PointerPosition) {
    const movement = Math.round(e.screenX - this.touchStart.x);
    if (this.translateX < this.translateList[0]) {
      if (this.translateX <= this.translateList[0] - this.cellWidth / 2 && movement > this.cellWidth / 2) {
        return true;
      }
    }
    else if (this.translateX > this.translateList[this.translateList.length - 1]) {
      if (this.translateX >= this.translateList[this.translateList.length - 1] - this.cellWidth / 2 && movement < - this.cellWidth / 2) {
        return true;
      }
    }
    return false;
  }

  private goToNearestSlide() {
    const nearestIndex = this.getNearestSlideIndex();
    if (nearestIndex === this.active && this.translateX < this.translateList[this.translateList.length - 1]) {
      if (this.movementX < 0) {
        this.next();
      } else if (this.movementX > 0) {
        this.prev();
      }
      return;
    }
    this.active = nearestIndex;
    this.events.emit({ name: 'goTo', data: this.active });
    this.emitTransitionEvent();
  }

  private getNearestSlideIndex() {
    let minimalDistance = this.translateList[this.translateList.length - 1];
    let result = 0;
    this.translateList.forEach((translate, i) => {
      const distanceToCurrentSlide = Math.abs(translate - this.translateX);
      if (distanceToCurrentSlide < minimalDistance) {
        minimalDistance = distanceToCurrentSlide;
        result = i;
      }
    });
    return result;
  }

  contentChanged() {
    this.setHtmlStylesToSlides();
    this.calculateSlidesInView();
    this.calculateTranslateList();
    if (this.active > this.translateList.length - 1) {
      this.active = this.translateList.length - 1;
    }
    this.cd.detectChanges()
  }

  private calculateSlidesInView() {
    for (let i = this.cells.length - 1; i >= 0; i--) {
      if (this.cellsRef.nativeElement.offsetWidth - this.cells[i] + this.marginLast >= 0) {
        this.slidesInView = i;
        return;
      }
    }
  }

  private setHtmlStylesToSlides() {
    this.cells = [];
    const cells = this.cellsRef.nativeElement.querySelectorAll('.carousel-cell') as unknown as HTMLElement[];
    if (this.cellsToShow) {
      this.calculateCellWidth();
    }
    cells.forEach((el, i) => {
      this.renderer2.setStyle(el, 'width', `${this.cellWidth}px`);
      this.setTransformStyles(cells, i);
    });
  }

  private calculateCellWidth() {
    const cellsTotalWidth = this.cellsRef.nativeElement.offsetWidth;
    this.cellWidth = cellsTotalWidth / this.cellsToShow;
    if (this.cellsToShow !== 1) {
      const marginsAmountPerView = this.cellsToShow - 1;
      const totalMargin = marginsAmountPerView * this.margin;
      this.cellWidth -= totalMargin / this.cellsToShow;
    }
  }

  private setTransformStyles(cells: HTMLElement[], i: number) {
    const el = cells[i];
    let translateX = 0;
    if (i === 0) {
      translateX += this.marginFirst;
    } else {
      translateX = this.cells[i - 1] + this.cellWidth;
      translateX += this.margin;
    }

    this.cells[i] = translateX;
    this.renderer2.setStyle(el, 'transform', `translateX(${translateX}px)`);
  }

  private calculateTranslateList() {
    this.translateList = [this.cells[0] - this.marginFirst];
    for (let i = 0; i < this.cells.length; i++) {

      if (i + this.slidesInView >= this.cells.length - 1) {
        let t = this.cells[this.cells.length - 1];
        const totalWidth = this.cellsRef.nativeElement.offsetWidth;
        t -= totalWidth - this.cellWidth - this.marginLast;
        if (t > 0) this.translateList.push(t)
        return;
      }

      const nextCellTranslate = this.cells[i + 1] - this.marginFirst;
      this.translateList.push(nextCellTranslate)
    }
  }

  getCellsContainerTransform() {
    if (!this.movementX) {
      this.translateX = this.translateList[this.active];
    }
    return `translateX(${-this.translateX}px)`;
  }

  prev() {
    if (!this.prevAvailable()) return;
    this.active -= 1;
    this.events.emit({ name: 'goTo', data: this.active });
    this.emitTransitionEvent();
  }

  next() {
    if (!this.nextAvailable()) return;
    this.active += 1;
    this.events.emit({ name: 'goTo', data: this.active });
    this.emitTransitionEvent();
  }

  private emitTransitionEvent() {
    this.eventSlideTo$.next(undefined);
    timer(this.transition)
      .pipe(takeUntil(this.eventSlideTo$), untilDestroyed(this))
      .subscribe(() => {
        this.events.emit({ name: 'transitionEnd' });
      });
  }

  prevAvailable() {
    return this.active - 1 >= 0;
  }

  nextAvailable() {
    return this.translateX < this.translateList[this.translateList.length - 1];
  }

  nextCanBeShown() {
    if (this.hideArrowsByLimit) {
      if (!this.nextAvailable()) return false;
      if (this.movementX && this.active === this.translateList.length - 1) return false;
    }
    return true;
  }
}

type CarouselEventType = undefined | 'horizontal-swipe' | 'vertical-swipe';

type CarouselEventReady = {
  name: 'ready';
};

type CarouselEventTouchStart = {
  name: 'touchStart';
};

type CarouselEventMove = {
  name: 'move';
};

type CarouselEventTouchEnd = {
  name: 'touchEnd';
};

type CarouselEventGoTo = {
  name: 'goTo';
  data: number;
};

type CarouselEventTransitionEnd = {
  name: 'transitionEnd';
};

export type CarouselEvent =
  | CarouselEventReady
  | CarouselEventTouchStart
  | CarouselEventMove
  | CarouselEventTouchEnd
  | CarouselEventGoTo
  | CarouselEventTransitionEnd;

type PointerPosition = {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
};
