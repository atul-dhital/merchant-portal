import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router, Routes } from '@angular/router';
import { catchError, of } from 'rxjs';
import { permissionGuard } from '../../core/auth/auth.guards';
import { ApplicationDraft } from './data-access/application.models';
import { ApplicationsApi } from './data-access/applications.api';
import { unsavedChangesGuard } from './wizard/unsaved-changes.guard';

/** Loads an editable draft; the API decides ownership/status (403/404 → redirect). */
const draftResolver: ResolveFn<ApplicationDraft> = (route) => {
  const router = inject(Router);
  return inject(ApplicationsApi)
    .getDraft(route.paramMap.get('id')!)
    .pipe(
      catchError((err: unknown) => {
        const target =
          err instanceof HttpErrorResponse && err.status === 404 ? '/not-found' : '/forbidden';
        return of(new RedirectCommand(router.parseUrl(target)));
      }),
    );
};

export const APPLICATION_ROUTES: Routes = [
  {
    path: '',
    title: 'Applications · Merchant Portal',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'new',
    title: 'New application · Merchant Portal',
    canActivate: [permissionGuard('application:create')],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./wizard/application-wizard.component').then((m) => m.ApplicationWizardComponent),
  },
  {
    path: ':id/edit',
    title: 'Edit application · Merchant Portal',
    canActivate: [permissionGuard('application:edit')],
    canDeactivate: [unsavedChangesGuard],
    resolve: { draft: draftResolver },
    loadComponent: () =>
      import('./wizard/application-wizard.component').then((m) => m.ApplicationWizardComponent),
  },
  {
    path: ':id',
    title: 'Application · Merchant Portal',
    loadComponent: () =>
      import('./detail/application-detail.component').then((m) => m.ApplicationDetailComponent),
  },
];
