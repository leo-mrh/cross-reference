import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach } from 'vitest';
import { Show } from './show';

@Component({
  selector: 'app-menu',
  standalone: true,
  template: '',
})
class MenuStub {}

describe('Show', () => {
  let fixture: ComponentFixture<Show>;
  let component: Show;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Show],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(Show, {
        set: { imports: [MenuStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Show);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
