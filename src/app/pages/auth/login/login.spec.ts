import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Login } from './login';
import { AuthService } from '../../../services/auth.service';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authMock: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authMock = {
      login: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle password visibility from password to text and back', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const passwordInput = el.querySelector<HTMLInputElement>('#password');
    expect(passwordInput).toBeTruthy();
    expect(passwordInput!.getAttribute('type')).toBe('password');

    const toggleBtn = el.querySelector<HTMLButtonElement>('button[aria-controls="password"]');
    expect(toggleBtn).toBeTruthy();

    toggleBtn!.click();
    fixture.detectChanges();
    expect(passwordInput!.getAttribute('type')).toBe('text');
    expect(toggleBtn!.getAttribute('aria-pressed')).toBe('true');

    toggleBtn!.click();
    fixture.detectChanges();
    expect(passwordInput!.getAttribute('type')).toBe('password');
    expect(toggleBtn!.getAttribute('aria-pressed')).toBe('false');
  });

  it('should show inline validation messages for invalid email and empty password', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const emailInput = el.querySelector<HTMLInputElement>('#email')!;
    emailInput.value = 'no-es-email';
    emailInput.dispatchEvent(new Event('input'));
    emailInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el.querySelector('#email-error')).toBeTruthy();

    const passwordInput = el.querySelector<HTMLInputElement>('#password')!;
    passwordInput.value = '';
    passwordInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el.querySelector('#password-error')).toBeTruthy();
  });

  it('should set loading state and disable button while submitting', async () => {
    authMock.login.mockImplementation(() => new Promise<boolean>(() => {}));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const emailInput = el.querySelector<HTMLInputElement>('#email')!;
    emailInput.value = 'test@daimlertruck.com';
    emailInput.dispatchEvent(new Event('input'));
    const passwordInput = el.querySelector<HTMLInputElement>('#password')!;
    passwordInput.value = 'secret';
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector<HTMLFormElement>('form')!;
    const submitBtn = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submitBtn.disabled).toBe(false);

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(component.isSubmitting).toBe(true);
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.querySelector('[role="status"]')).toBeTruthy();
  });

  it('should call onSubmit on submit (enter key path) without changing handler', async () => {
    authMock.login.mockResolvedValue(false);
    const spy = vi.spyOn(component, 'onSubmit');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const passwordInput = el.querySelector<HTMLInputElement>('#password')!;
    passwordInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const form = el.querySelector<HTMLFormElement>('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalled();
  });

  it('should expose error with role alert for accessibility', async () => {
    authMock.login.mockResolvedValue(false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const emailInput = el.querySelector<HTMLInputElement>('#email')!;
    emailInput.value = 'test@daimlertruck.com';
    emailInput.dispatchEvent(new Event('input'));
    const passwordInput = el.querySelector<HTMLInputElement>('#password')!;
    passwordInput.value = 'secret';
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector<HTMLFormElement>('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    const alertEl = el.querySelector('#login-error');
    expect(alertEl).toBeTruthy();
    expect(alertEl!.getAttribute('role')).toBe('alert');
    expect(alertEl!.textContent).toContain('Credenciales inválidas');
  });
});
