import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  Renderer2,
  ViewChild,
} from '@angular/core';
import { fromEvent, Subject, timer } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, filter, takeUntil, tap } from 'rxjs/operators';

@UntilDestroy()
@Component({
  selector: 'gp-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarouselComponent implements AfterViewInit {
  @Input() height = 0;
  @Input() cellWidth = 0;
  @Input() margin = 16;
  @Input() marginFirst = 0;
  @Input() marginLast = 0;
  @Input() transition = 300;
  @Input() minSwipeDistance = 10;
  @Input() cellsToShow = 0;
  @Input() cellsToScroll = 1;
  @Input() arrows = false;
  @Input() loop = false;
  @Input() swipeByMouse = false;
  @Output() protected events = new EventEmitter<CarouselEvents>();
  @ViewChild('cells')
  private cellsRef!: ElementRef<HTMLElement>;
  @HostBinding('style.height') protected get hostHeight() {
    return `${this.height}px`;
  }
  @HostListener('window:resize') protected onResize() {
    if (this.elementRef.nativeElement.offsetWidth !== this.hostWidth) {
      this.hostWidth = this.elementRef.nativeElement.offsetWidth;
      this.setHtmlStylesToSlides();
    }
  }
  @HostListener('window:mousemove', ['$event']) protected onMouseMove($event: MouseEvent) {
    if (!this.swipeByMouse) return;
    const { clientX, clientY, screenX, screenY } = $event;
    this.pointerMove$.next({ clientX, clientY, screenX, screenY });
  }
  @HostListener('mousedown', ['$event']) protected onMouseDown($event: MouseEvent) {
    if (!this.swipeByMouse) return;
    const { clientX, clientY, screenX, screenY } = $event;
    this.pointerDown$.next({ clientX, clientY, screenX, screenY });
  }
  @HostListener('window:mouseup', ['$event']) protected onMouseUp($event: MouseEvent) {
    if (!this.swipeByMouse) return;
    const { clientX, clientY, screenX, screenY } = $event;
    this.pointerUp$.next({ clientX, clientY, screenX, screenY });
  }

  get movementX() {
    return Math.round(this.touchEnd.x - this.touchStart.x);
  }

  set active(active: number) {
    this.cd.markForCheck();
    if (active >= this.cellsTranslateX.length && !this.loop) {
      this.activeIndex = this.cellsTranslateX.length - 1;
      console.warn('Active index more than slides length.');
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
  private cellsTranslateX: number[] = [];
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
  protected hostWidth = 0;
  protected pointerMove$ = new Subject<PointerPosition>();
  protected pointerDown$ = new Subject<PointerPosition>();
  protected pointerUp$ = new Subject<PointerPosition>();
  protected pointerDown = false;
  protected touchEvent!: TouchEvent;

  constructor(
    protected readonly elementRef: ElementRef,
    protected readonly renderer2: Renderer2,
    protected readonly cd: ChangeDetectorRef,
  ) {}

  ngAfterViewInit() {
    this.hostWidth = this.elementRef.nativeElement.offsetWidth;
    if (this.cellsToShow) {
      this.cellWidth = 0;
      this.marginLast = 0;
      this.marginFirst = 0;
    }
    if (this.loop) {
      this.marginLast = 0;
      this.marginFirst = 0;
    }
    this.onTouchstart();
    this.onTouchmove();
    this.onTouchend();
    this.contentChanged();
  }

  private onTouchstart() {
    fromEvent<TouchEvent>(this.cellsRef.nativeElement, 'touchstart')
      .pipe(untilDestroyed(this))
      .subscribe((e: TouchEvent) => {
        const { clientX, clientY, screenX, screenY } = e.touches[0];
        this.pointerDown$.next({ clientX, clientY, screenX, screenY });
      });

    this.pointerDown$.pipe(untilDestroyed(this)).subscribe(position => {
      this.pointerDown = true;
      this.translateStart.x = this.translateX;
      this.touchStart.x = position.screenX;
      this.touchStart.y = position.screenY;
      this.touchEnd.x = position.screenX;
      this.touchEnd.y = position.screenY;
      this.events.emit({ name: 'touchStart' });
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

    this.pointerMove$
      .pipe(
        filter(() => this.pointerDown),
        distinctUntilChanged(),
        tap(position => {
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
        this.touchEnd.x = e.screenX;
        this.touchEnd.y = e.screenY;
        this.translateX = this.translateStart.x - this.movementX;
        this.events.emit({ name: 'move' });
      });
  }

  private getLinearSwipeType(position: PointerPosition) {
    if (this.eventType !== 'horizontal-swipe' && this.eventType !== 'vertical-swipe') {
      const movementX = Math.abs(position.screenX - this.touchStart.x);
      const movementY = Math.abs(position.screenY - this.touchStart.y);
      if (movementY > movementX) {
        return 'vertical-swipe';
      } else {
        return 'horizontal-swipe';
      }
    } else {
      return this.eventType;
    }
  }

  private onTouchend() {
    this.pointerUp$.pipe(untilDestroyed(this)).subscribe(() => {
      this.pointerDown = false;
      this.cd.markForCheck();
      if (Math.abs(this.movementX) >= this.minSwipeDistance) {
        this.goToNearestSlide();
      }
      this.touchStart = { x: 0, y: 0 };
      this.touchEnd = { x: 0, y: 0 };
      this.eventType = undefined;
      this.events.emit({ name: 'touchEnd' });
    });

    fromEvent<TouchEvent>(this.cellsRef.nativeElement, 'touchend')
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        this.pointerUp$.next();
      });
  }

  private goToNearestSlide() {
    const nearestIndex = this.getNearestSlideIndex();
    if (nearestIndex === this.active) {
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
    let minimalDistance = this.cellsTranslateX[this.cellsTranslateX.length - 1];
    let result = 0;
    this.cellsTranslateX.forEach((translate, i) => {
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
    if (this.active > this.cellsTranslateX.length - 1) {
      this.active = this.cellsTranslateX.length - 1;
    }
  }

  private setHtmlStylesToSlides() {
    this.cellsTranslateX = [];
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
      translateX = this.cellsTranslateX[i - 1] + this.cellWidth;
      translateX += this.margin;
    }

    this.cellsTranslateX[i] = translateX;
    this.renderer2.setStyle(el, 'transform', `translateX(${translateX}px)`);
  }

  getCellsContainerTransform() {
    if (!this.movementX) {
      this.translateX = this.cellsTranslateX[this.activeIndex];
      if (this.active === 0) {
        this.translateX -= this.marginFirst;
      } else if (this.active === this.cellsTranslateX.length - 1) {
        const totalWidth = this.cellsRef.nativeElement.offsetWidth;
        this.translateX -= totalWidth - this.cellWidth - this.marginLast;
      } else if (this.marginFirst) {
        this.translateX -= this.margin;
      }
    }
    return `translateX(${-this.translateX}px)`;
  }

  prev() {
    if (!this.prevAvailable()) return;
    this.active -= this.cellsToScroll;
    this.events.emit({ name: 'goTo', data: this.active });
    this.emitTransitionEvent();
  }

  next() {
    if (!this.nextAvailable()) return;
    this.active += this.cellsToScroll;
    this.events.emit({ name: 'goTo', data: this.active });
    this.emitTransitionEvent();
  }

  private emitTransitionEvent() {
    this.eventSlideTo$.next();
    timer(this.transition)
      .pipe(takeUntil(this.eventSlideTo$), untilDestroyed(this))
      .subscribe(() => {
        this.events.emit({ name: 'transitionEnd' });
      });
  }

  prevAvailable() {
    return this.active - this.cellsToScroll >= 0 || this.loop;
  }

  nextAvailable() {
    return this.active + this.cellsToScroll <= this.cellsTranslateX.length - 1 - this.cellsToShow || this.loop;
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

type CarouselEvents =
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
