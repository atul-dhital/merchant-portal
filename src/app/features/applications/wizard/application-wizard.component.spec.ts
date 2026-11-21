import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { applicationData, summary } from '../../../../testing/fixtures';
import { ApplicationData } from '../data-access/application.models';
import { ApplicationsApi } from '../data-access/applications.api';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { createOwnerGroup } from './application-form';
import { ApplicationWizardComponent } from './application-wizard.component';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

describe('ApplicationWizardComponent', () => {
  let fixture: ComponentFixture<ApplicationWizardComponent>;
  let component: ApplicationWizardComponent;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ApplicationWizardComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApplicationsApi,
          useValue: {
            isRegistrationNumberAvailable: () => of(true),
            createDraft: () => of({ id: 'app-1', reference: 'MA-1', updatedAt: '' }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ApplicationWizardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const clickButton = async (label: string) => {
    [...el().querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!.click();
    await fixture.whenStable();
  };
  const heading = () => el().querySelector('h2')!.textContent!.trim();

  it('blocks "Next" on an invalid step and shows field-level errors', async () => {
    await clickButton('Next');

    expect(heading()).toContain('Step 1 of 5: Business');
    expect(el().querySelector('[role="alert"]')!.textContent).toContain(
      'Some answers need attention',
    );
    expect(el().querySelector('#legalName')!.getAttribute('aria-invalid')).toBe('true');
    expect(el().textContent).toContain('This field is required.');
  });

  it('moves to the next step once the current step is valid', async () => {
    component.form.controls.business.setValue({
      legalName: 'Test Merchant Pvt. Ltd.',
      tradingName: '',
      businessType: 'PRIVATE_LIMITED',
      registrationNumber: 'TEST-12345',
      incorporationDate: '2020-01-01',
      website: '',
      category: 'RETAIL',
    });
    // Let the debounced async registration check finish.
    await new Promise((r) => setTimeout(r, 450));
    await clickButton('Next');

    expect(heading()).toContain('Step 2 of 5: Contact');
  });

  it('does not allow jumping ahead past an invalid step', async () => {
    const stepButtons = el().querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Application steps"] button',
    );
    expect(stepButtons[2].disabled).toBe(true);
  });

  it('flags combined ownership above 100% across the owners array', () => {
    const owners = component.form.controls.owners;
    owners.push(createOwnerGroup(TestBed.inject(NonNullableFormBuilder)));
    owners.at(0).controls.ownershipPercent.setValue(70);
    owners.at(1).controls.ownershipPercent.setValue(40);
    expect(owners.getError('ownershipTotal')).toEqual({ actual: 110, max: 100 });

    owners.at(1).controls.ownershipPercent.setValue(30);
    expect(owners.hasError('ownershipTotal')).toBe(false);
  });
});

describe('unsavedChangesGuard', () => {
  const component = (dirty: boolean): HasUnsavedChanges => ({ hasUnsavedChanges: () => dirty });
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;
  const run = (c: HasUnsavedChanges) =>
    TestBed.runInInjectionContext(() => unsavedChangesGuard(c, route, state, state));

  it('lets the user leave when everything is saved, without asking', () => {
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask');
    expect(run(component(false))).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks in a dialog when changes are unsaved, and stays if the user cancels', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const result = run(component(true)) as Promise<boolean>;
    expect(confirm.pending()?.title).toBe('Leave without saving?');
    confirm.close(false);
    expect(await result).toBe(false);
  });
});

describe('ApplicationWizardComponent with an existing draft', () => {
  const validData = (): ApplicationData => {
    const data = applicationData();
    data.owners[0].nationalId = 'TESTNID0001';
    data.banking.accountNumber = '000000001234';
    return data;
  };
  const api = {
    isRegistrationNumberAvailable: vi.fn(() => of(true)),
    saveDraft: vi.fn(),
    createDraft: vi.fn(),
    submit: vi.fn(() => of(summary({ id: 'app-9', status: 'SUBMITTED' }))),
  };
  let fixture: ComponentFixture<ApplicationWizardComponent>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    Object.values(api).forEach((fn) => fn.mockClear());
    TestBed.configureTestingModule({
      imports: [ApplicationWizardComponent],
      providers: [provideRouter([]), { provide: ApplicationsApi, useValue: api }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ApplicationWizardComponent);
    fixture.componentRef.setInput('draft', {
      id: 'app-9',
      reference: 'MA-2026-0009',
      status: 'DRAFT',
      data: validData(),
    });
    await fixture.whenStable();
    // Let the debounced registration check finish and re-render.
    await new Promise((r) => setTimeout(r, 450));
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('loads the draft without marking fields invalid or saving it back', () => {
    expect(fixture.componentInstance.form.valid).toBe(true);
    expect(el().querySelectorAll('.is-invalid')).toHaveLength(0);
    expect(api.isRegistrationNumberAvailable).toHaveBeenCalledWith('TEST-000001', 'app-9');
    expect(api.saveDraft).not.toHaveBeenCalled();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });

  it('enables every step once the async check has finished (zoneless re-render)', () => {
    const steps = el().querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Application steps"] button',
    );
    expect([...steps].every((b) => !b.disabled)).toBe(true);
  });

  it('asks for confirmation, then submits the latest values and opens the application', async () => {
    const confirm = TestBed.inject(ConfirmService);
    fixture.componentInstance.goTo(4);
    await fixture.whenStable();
    [...el().querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Submit application'))!
      .click();

    expect(confirm.pending()?.title).toBe('Submit application?');
    expect(api.submit).not.toHaveBeenCalled();
    confirm.close(true);
    await fixture.whenStable();

    expect(api.submit).toHaveBeenCalledWith('app-9', validData());
    expect(TestBed.inject(ToastService).toasts()[0].message).toContain('submitted for review');
    expect(navigate).toHaveBeenCalledWith(['/applications', 'app-9']);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });

  it('does not submit when the user cancels the confirmation', async () => {
    const confirm = TestBed.inject(ConfirmService);
    fixture.componentInstance.goTo(4);
    await fixture.whenStable();
    [...el().querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Submit application'))!
      .click();
    confirm.close(false);
    await fixture.whenStable();
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('shows a progress bar reflecting completed steps', () => {
    const bar = el().querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });
});
