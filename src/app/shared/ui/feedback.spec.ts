import { TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmService } from './confirm.service';
import { ToastContainerComponent } from './toast-container.component';
import { TOAST_DURATION_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a toast and dismisses it automatically', () => {
    vi.useFakeTimers();
    const toasts = TestBed.inject(ToastService);
    toasts.show('Saved');
    expect(toasts.toasts().map((t) => t.message)).toEqual(['Saved']);
    vi.advanceTimersByTime(TOAST_DURATION_MS);
    expect(toasts.toasts()).toEqual([]);
  });

  it('keeps at most three toasts on screen', () => {
    const toasts = TestBed.inject(ToastService);
    ['a', 'b', 'c', 'd'].forEach((m) => toasts.show(m));
    expect(toasts.toasts().map((t) => t.message)).toEqual(['b', 'c', 'd']);
  });

  it('renders toasts in a polite live region with a dismiss button', async () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    TestBed.inject(ToastService).show('Decision recorded');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[aria-live="polite"]')!.textContent).toContain('Decision recorded');

    el.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')!.click();
    await fixture.whenStable();
    expect(el.textContent).not.toContain('Decision recorded');
  });
});

describe('ConfirmService + ConfirmDialogComponent', () => {
  it('resolves true when confirmed and false when cancelled', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const yes = confirm.ask({ title: 'A', message: '' });
    confirm.close(true);
    expect(await yes).toBe(true);

    const no = confirm.ask({ title: 'B', message: '' });
    confirm.close(false);
    expect(await no).toBe(false);
  });

  it('cancels a pending question when a new one is asked', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const first = confirm.ask({ title: 'First', message: '' });
    void confirm.ask({ title: 'Second', message: '' });
    expect(await first).toBe(false);
    expect(confirm.pending()?.title).toBe('Second');
  });

  it('renders an accessible dialog and answers through its buttons', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    const confirm = TestBed.inject(ConfirmService);
    const answer = confirm.ask({
      title: 'Reject?',
      message: 'This cannot be undone.',
      confirmLabel: 'Record decision',
      tone: 'danger',
    });
    await fixture.whenStable();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-title');
    expect(dialog.textContent).toContain('This cannot be undone.');

    const confirmButton = [...dialog.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Record decision'),
    )!;
    expect(confirmButton.classList).toContain('btn-danger');
    confirmButton.click();
    expect(await answer).toBe(true);
    await fixture.whenStable();
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('treats Escape (the dialog "cancel" event) as "no"', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    const answer = TestBed.inject(ConfirmService).ask({ title: 'Leave?', message: '' });
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector('dialog')!
      .dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(await answer).toBe(false);
  });
});
