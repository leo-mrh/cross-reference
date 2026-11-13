import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnChanges,
  OnDestroy,
  HostListener,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/** Contador global para manejar el scroll del body con múltiples modales */
let openModalsCount = 0;

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 overflow-y-auto" 
           role="dialog" 
           aria-modal="true" 
           aria-labelledby="modal-title-{{ modalId }}"
           [style.zIndex]="zIndex">
        <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          
          <!-- Backdrop -->
          <div class="fixed inset-0 transition-opacity bg-black/50 backdrop-blur-sm"
               aria-hidden="true"
               (click)="onBackdropClick()"></div>

          <!-- Spacer for vertical centering -->
          <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

          <!-- MODAL PANEL -->
          <div #modalPanel
               (keydown)="onPanelKeydown($event)"
               class="inline-block w-full text-left align-bottom transition-all transform bg-white 
                      rounded-xl overflow-hidden shadow-2xl border border-gray-200 sm:my-8 sm:align-middle relative"
               [ngClass]="maxWidthClass"
               tabindex="-1">

            <!-- HEADER -->
            <div class="flex items-center justify-between px-4 py-3 bg-white rounded-t-xl sm:px-6 
                        sticky top-0 z-10 shadow-sm border-b border-gray-200">
              <h3 class="text-lg font-medium leading-6 text-gray-900" [id]="'modal-title-' + modalId">
                {{ modalTitle }}
              </h3>

              <div class="flex items-center gap-2">
                <div [class.opacity-0]="revealOnScroll && !isScrolled"
                     [class.invisible]="revealOnScroll && !isScrolled"
                     [class.pointer-events-none]="revealOnScroll && !isScrolled"
                     [class.transition-opacity]="revealOnScroll"
                     [class.duration-300]="revealOnScroll">
                  <ng-content select="[header-actions]"></ng-content>
                </div>

                <button type="button"
                        class="text-gray-400 bg-white rounded-md hover:text-gray-500 
                               focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                        (click)="close()">
                  <span class="sr-only">Cerrar</span>
                  <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" 
                       viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- CONTENT -->
            <div class="bg-white max-h-[75vh] overflow-auto" (scroll)="onScroll($event)">
              <ng-content></ng-content>
            </div>

            <!-- FOOTER -->
            <div class="px-4 py-3 bg-gray-50 sm:px-6 flex flex-col-reverse 
                        sm:flex-row sm:items-center sm:justify-between sticky bottom-0 z-10 
                        border-t border-gray-200 gap-3 rounded-b-xl">
              <div class="text-sm text-gray-500 w-full sm:w-auto">
                <ng-content select="[footer-info]"></ng-content>
              </div>

              <div class="flex flex-row gap-2 w-full sm:w-auto sm:justify-end">
                <ng-content select="[footer-actions]"></ng-content>
              </div>
            </div>

          </div>
        </div>
      </div>
    }
  `
})
export class Modal implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() modalTitle = '';
  @Input() maxWidth: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' = 'xl';
  @Input() dismissOnBackdrop = false;
  @Input() dismissOnEscape = true;
  @Input() revealOnScroll = false;
  @Input() zIndex = 50;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('modalPanel') modalPanel?: ElementRef<HTMLElement>;
  isScrolled = false;

  readonly modalId = `${Math.random().toString(36).slice(2)}`;

  private previousActiveElement: HTMLElement | null = null;
  private wasOpen = false;

  get maxWidthClass() {
    const widths: Record<string, string> = {
      sm: 'sm:max-w-sm',
      md: 'sm:max-w-md',
      lg: 'sm:max-w-lg',
      xl: 'sm:max-w-xl',
      '2xl': 'sm:max-w-2xl',
      '3xl': 'sm:max-w-3xl',
      '4xl': 'sm:max-w-4xl',
      '5xl': 'sm:max-w-5xl',
      '6xl': 'sm:max-w-6xl',
      '7xl': 'sm:max-w-7xl',
      'full': 'sm:max-w-full sm:m-4',
    };
    return widths[this.maxWidth] || widths['7xl'];
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['open']) return;
    if (this.open === this.wasOpen) return;
    this.wasOpen = this.open;

    if (this.open) {
      this.previousActiveElement = document.activeElement as HTMLElement;
      setTimeout(() => this.modalPanel?.nativeElement?.focus(), 50);

      openModalsCount++;
      document.body.style.overflow = 'hidden';

      this.isScrolled = false;
    } else {
      if (this.previousActiveElement) {
        this.previousActiveElement.focus();
        this.previousActiveElement = null;
      }

      openModalsCount = Math.max(0, openModalsCount - 1);
      if (openModalsCount === 0) {
        document.body.style.overflow = '';
      }
    }
  }

  ngOnDestroy() {
    if (this.wasOpen) {
      openModalsCount = Math.max(0, openModalsCount - 1);
    }
    if (openModalsCount === 0) {
      document.body.style.overflow = '';
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open && this.dismissOnEscape) this.close();
  }

  onBackdropClick() {
    if (this.dismissOnBackdrop) this.close();
  }

  onScroll(event: Event) {
    const target = event.target as HTMLElement;
    this.isScrolled = target.scrollTop > 10;
  }

  onPanelKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !this.modalPanel) return;

    const focusable = this.modalPanel.nativeElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  close() {
    this.closed.emit();
  }
}