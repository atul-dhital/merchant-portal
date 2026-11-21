import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OTHER_REVIEWER, REVIEWER, summary } from '../../../../testing/fixtures';
import { HistoryEvent } from '../data-access/application.models';
import { ApplicationsApi } from '../data-access/applications.api';
import { AssignmentPanelComponent } from './assignment-panel.component';
import { RiskHistoryComponent } from './risk-history.component';

describe('AssignmentPanelComponent', () => {
  const api = {
    reviewers: vi.fn(() => of([REVIEWER, OTHER_REVIEWER])),
    assign: vi.fn(() => of(summary())),
  };

  async function render(currentReviewerId: string | null) {
    TestBed.configureTestingModule({
      imports: [AssignmentPanelComponent],
      providers: [{ provide: ApplicationsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(AssignmentPanelComponent);
    fixture.componentRef.setInput('applicationId', 'app-1');
    fixture.componentRef.setInput('currentReviewerId', currentReviewerId);
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => api.assign.mockClear());

  it('does not offer the current reviewer as a reassignment target', async () => {
    const fixture = await render(REVIEWER.id);
    const option = (fixture.nativeElement as HTMLElement).querySelector<HTMLOptionElement>(
      `option[value="${REVIEWER.id}"]`,
    )!;
    expect(option.disabled).toBe(true);
    expect(option.textContent).toContain('(current)');
  });

  it('explains when there is no other reviewer to choose', async () => {
    api.reviewers.mockReturnValueOnce(of([REVIEWER]));
    const fixture = await render(REVIEWER.id);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('select')).toBeNull();
    expect(el.textContent).toContain('Assigned to Riya Reviewer. No other reviewer is available.');
  });

  it('assigns the selected reviewer and notifies the parent', async () => {
    const fixture = await render(null);
    const assigned = vi.fn();
    fixture.componentInstance.assigned.subscribe(assigned);
    const el = fixture.nativeElement as HTMLElement;

    const submit = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true); // nothing selected yet

    const select = el.querySelector<HTMLSelectElement>('#reviewer')!;
    select.value = OTHER_REVIEWER.id;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    submit.click();

    expect(api.assign).toHaveBeenCalledWith('app-1', OTHER_REVIEWER.id);
    expect(assigned).toHaveBeenCalledTimes(1);
  });
});

describe('RiskHistoryComponent', () => {
  const events: HistoryEvent[] = [
    { id: '1', at: '2026-01-01T10:00:00Z', type: 'CREATED', actorName: 'Sam Sales' },
    {
      id: '2',
      at: '2026-01-02T10:00:00Z',
      type: 'DECISION',
      actorName: 'Riya Reviewer',
      decision: 'REJECT',
      riskLevel: 'HIGH',
      notes: 'Outside risk appetite.',
    },
    {
      id: '3',
      at: '2026-01-03T10:00:00Z',
      type: 'SENSITIVE_REVEALED',
      actorName: 'Ada Admin',
      field: 'banking.accountNumber',
    },
  ];

  it('shows decisions with risk level and notes, and audited reveals, newest first', async () => {
    const fixture = TestBed.createComponent(RiskHistoryComponent);
    fixture.componentRef.setInput('history', events);
    await fixture.whenStable();

    const items = [...(fixture.nativeElement as HTMLElement).querySelectorAll('li')].map(
      (li) => li.textContent ?? '',
    );
    expect(items[0]).toContain('Viewed bank account number (audited)');
    expect(items[1]).toContain('Decision: Reject');
    expect(items[1]).toContain('HIGH risk');
    expect(items[1]).toContain('Outside risk appetite.');
    expect(items[2]).toContain('Application created');
  });
});
