import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { summary } from '../../../../testing/fixtures';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { ApplicationsApi } from '../data-access/applications.api';
import { ReviewPanelComponent } from './review-panel.component';

describe('ReviewPanelComponent', () => {
  let fixture: ComponentFixture<ReviewPanelComponent>;
  let component: ReviewPanelComponent;
  const api = { decide: vi.fn(() => of(summary({ status: 'APPROVED' }))) };

  beforeEach(async () => {
    api.decide.mockClear();
    TestBed.configureTestingModule({
      imports: [ReviewPanelComponent],
      providers: [{ provide: ApplicationsApi, useValue: api }],
    });
    fixture = TestBed.createComponent(ReviewPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('applicationId', 'app-1');
    await fixture.whenStable();
  });

  it('requires notes when rejecting or requesting info, but not when approving', () => {
    const form = component.form;
    form.patchValue({ decision: 'REJECT', riskLevel: 'HIGH', notes: 'too short' });
    expect(form.hasError('notesRequired')).toBe(true);

    form.patchValue({ notes: 'Business model is outside our risk appetite.' });
    expect(form.valid).toBe(true);

    form.patchValue({ decision: 'APPROVE', notes: '' });
    expect(form.valid).toBe(true);
  });

  it('does not call the API while invalid; confirms, records and emits when valid', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const decided = vi.fn();
    component.decided.subscribe(decided);

    await component.submit();
    expect(confirm.pending()).toBeNull();
    expect(api.decide).not.toHaveBeenCalled();

    component.form.patchValue({ decision: 'APPROVE', riskLevel: 'LOW' });
    const done = component.submit();
    expect(confirm.pending()?.title).toBe('Approve?');
    confirm.close(true);
    await done;

    expect(api.decide).toHaveBeenCalledWith('app-1', {
      decision: 'APPROVE',
      riskLevel: 'LOW',
      notes: '',
    });
    expect(decided).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Decision recorded: Approve.');
  });

  it('records nothing when the reviewer cancels the confirmation', async () => {
    const confirm = TestBed.inject(ConfirmService);
    component.form.patchValue({
      decision: 'REJECT',
      riskLevel: 'HIGH',
      notes: 'Business model is outside our risk appetite.',
    });
    const done = component.submit();
    expect(confirm.pending()?.tone).toBe('danger');
    confirm.close(false);
    await done;
    expect(api.decide).not.toHaveBeenCalled();
  });
});
