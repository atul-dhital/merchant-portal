import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { ShellComponent } from './core/layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Merchant Portal',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canMatch: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Overview · Merchant Portal',
        loadComponent: () =>
          import('./features/overview/overview.component').then((m) => m.OverviewComponent),
      },
      {
        path: 'applications',
        loadChildren: () =>
          import('./features/applications/applications.routes').then((m) => m.APPLICATION_ROUTES),
      },
      {
        path: 'forbidden',
        title: 'Access denied · Merchant Portal',
        loadComponent: () =>
          import('./features/errors/message-page.component').then((m) => m.MessagePageComponent),
        data: {
          heading: 'Access denied',
          message: 'You do not have permission to view this page.',
        },
      },
      {
        path: '**',
        title: 'Not found · Merchant Portal',
        loadComponent: () =>
          import('./features/errors/message-page.component').then((m) => m.MessagePageComponent),
        data: {
          heading: 'Page not found',
          message: 'The page you are looking for does not exist.',
        },
      },
    ],
  },
];
