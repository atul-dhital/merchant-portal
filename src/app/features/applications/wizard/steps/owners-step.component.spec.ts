import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { OwnersArray, createOwnerGroup } from '../application-form';
import { MAX_OWNERS, OwnersStepComponent } from './owners-step.component';

describe('OwnersStepComponent', () => {
  let fixture: ComponentFixture<OwnersStepComponent>;
  let owners: OwnersArray;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [OwnersStepComponent] });
    const fb = TestBed.inject(NonNullableFormBuilder);
    owners = fb.array([createOwnerGroup(fb)]) as unknown as OwnersArray;
    fixture = TestBed.createComponent(OwnersStepComponent);
    fixture.componentRef.setInput('array', owners);
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    [...el().querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(label));

  it('adds owners up to the limit and removes them', async () => {
    expect(button('Remove')).toBeUndefined(); // the only owner cannot be removed

    for (let i = 1; i < MAX_OWNERS; i++) {
      button('Add another owner')!.click();
      await fixture.whenStable();
    }
    expect(owners.length).toBe(MAX_OWNERS);
    expect(button('Add another owner')).toBeUndefined();
    expect(el().querySelectorAll('fieldset')).toHaveLength(MAX_OWNERS);

    button('Remove owner 2')!.click();
    await fixture.whenStable();
    expect(owners.length).toBe(MAX_OWNERS - 1);
  });

  it('keeps the national ID hidden until the user asks to show it', async () => {
    const input = el().querySelector<HTMLInputElement>('#owner-0-nid')!;
    expect(input.type).toBe('password');

    button('Show')!.click();
    await fixture.whenStable();
    expect(input.type).toBe('text');
    expect(button('Hide')!.getAttribute('aria-pressed')).toBe('true');
  });
});
