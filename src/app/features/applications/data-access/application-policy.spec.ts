import { TestBed } from '@angular/core/testing';
import {
  ADMIN,
  OTHER_REVIEWER,
  OTHER_SALES,
  REVIEWER,
  SALES,
  summary,
} from '../../../../testing/fixtures';
import { User } from '../../../core/auth/auth.models';
import { AuthStore } from '../../../core/auth/auth.store';
import { applicationActions } from './application-policy';
import { ApplicationStatus } from './application.models';

describe('applicationActions', () => {
  let store: AuthStore;
  beforeEach(() => (store = TestBed.inject(AuthStore)));

  const actionsFor = (user: User, status: ApplicationStatus) => {
    store.setSession({ accessToken: 't', user });
    return applicationActions(store, summary({ status }));
  };

  it('SALES can edit only their own DRAFT / INFO_REQUESTED applications', () => {
    expect(actionsFor(SALES, 'DRAFT').canEdit).toBe(true);
    expect(actionsFor(SALES, 'INFO_REQUESTED').canEdit).toBe(true);
    expect(actionsFor(SALES, 'IN_REVIEW').canEdit).toBe(false);
    expect(actionsFor(OTHER_SALES, 'DRAFT').canEdit).toBe(false);
  });

  it('SALES can never decide, assign or reveal', () => {
    const a = actionsFor(SALES, 'IN_REVIEW');
    expect([a.canDecide, a.canAssign, a.canReveal]).toEqual([false, false, false]);
  });

  it('only the ASSIGNED reviewer can decide, and only while IN_REVIEW', () => {
    expect(actionsFor(REVIEWER, 'IN_REVIEW').canDecide).toBe(true);
    expect(actionsFor(REVIEWER, 'APPROVED').canDecide).toBe(false);
    expect(actionsFor(OTHER_REVIEWER, 'IN_REVIEW').canDecide).toBe(false);
    expect(actionsFor(OTHER_REVIEWER, 'IN_REVIEW').canReveal).toBe(false);
  });

  it('ADMIN can assign and reveal but not decide or edit', () => {
    const a = actionsFor(ADMIN, 'SUBMITTED');
    expect(a).toEqual({ canEdit: false, canDecide: false, canAssign: true, canReveal: true });
  });
});
