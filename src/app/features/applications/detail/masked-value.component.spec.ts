import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApplicationsApi } from '../data-access/applications.api';
import { MaskedValueComponent, REVEAL_DURATION_MS } from './masked-value.component';

describe('MaskedValueComponent', () => {
  let fixture: ComponentFixture<MaskedValueComponent>;
  const api = { reveal: vi.fn(() => of('000000001234')) };

  async function render(canReveal: boolean) {
    TestBed.configureTestingModule({
      imports: [MaskedValueComponent],
      providers: [{ provide: ApplicationsApi, useValue: api }],
    });
    fixture = TestBed.createComponent(MaskedValueComponent);
    fixture.componentRef.setInput('applicationId', 'app-1');
    fixture.componentRef.setInput('field', 'banking.accountNumber');
    fixture.componentRef.setInput('masked', '•••• 1234');
    fixture.componentRef.setInput('label', 'Bank account number');
    fixture.componentRef.setInput('canReveal', canReveal);
    await fixture.whenStable();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const button = (label: string) =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      b.textContent?.includes(label),
    );

  beforeEach(() => api.reveal.mockClear());
  afterEach(() => vi.useRealTimers());

  it('is masked by default and offers no reveal without permission', async () => {
    await render(false);
    expect(text()).toContain('•••• 1234');
    expect(text()).not.toContain('000000001234');
    expect(button('Reveal')).toBeUndefined();
  });

  it('reveals via the API on request and re-masks automatically after 30 seconds', async () => {
    await render(true);
    vi.useFakeTimers(); // after the initial render; drive change detection manually below

    button('Reveal')!.click();
    fixture.detectChanges();
    expect(api.reveal).toHaveBeenCalledWith('app-1', 'banking.accountNumber');
    expect(text()).toContain('000000001234');

    vi.advanceTimersByTime(REVEAL_DURATION_MS - 1);
    fixture.detectChanges();
    expect(text()).toContain('000000001234');

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(text()).not.toContain('000000001234');
    expect(text()).toContain('•••• 1234');
  });

  it('can be hidden manually', async () => {
    await render(true);
    button('Reveal')!.click();
    await fixture.whenStable();
    button('Hide')!.click();
    await fixture.whenStable();
    expect(text()).not.toContain('000000001234');
  });

  it('re-masks when the component is reused for another application', async () => {
    await render(true);
    button('Reveal')!.click();
    await fixture.whenStable();
    expect(text()).toContain('000000001234');

    fixture.componentRef.setInput('applicationId', 'app-2');
    fixture.componentRef.setInput('masked', '•••• 5678');
    await fixture.whenStable();
    expect(text()).not.toContain('000000001234');
    expect(text()).toContain('•••• 5678');
  });
});
