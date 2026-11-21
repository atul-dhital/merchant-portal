import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ColumnChartComponent } from './column-chart.component';
import { StatusMeterListComponent } from './status-meter-list.component';

describe('ColumnChartComponent', () => {
  async function render(values: number[]) {
    const fixture = TestBed.createComponent(ColumnChartComponent);
    fixture.componentRef.setInput(
      'data',
      values.map((value, i) => ({ label: `M${i + 1}`, value })),
    );
    fixture.componentRef.setInput('label', 'New applications per month');
    fixture.componentRef.setInput('unit', 'new applications');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws one focusable column per value, each with an accessible label', async () => {
    const el = await render([6, 5, 7]);
    const columns = el.querySelectorAll<HTMLElement>('li.slot');
    expect(columns).toHaveLength(3);
    expect(columns[2].getAttribute('aria-label')).toBe('M3: 7 new applications');
    expect(columns[0].tabIndex).toBe(0);
    expect(el.querySelector('ul')!.getAttribute('aria-label')).toBe('New applications per month');
  });

  it('scales heights to a round axis maximum and labels only the latest value', async () => {
    const el = await render([4, 8]); // axis 0..8 in steps of 2
    const bars = el.querySelectorAll<HTMLElement>('.bar');
    expect(bars[0].style.height).toBe('50%');
    expect(bars[1].style.height).toBe('100%');
    expect([...el.querySelectorAll('.y-axis span')].map((s) => s.textContent?.trim())).toEqual([
      '0',
      '2',
      '4',
      '6',
      '8',
    ]);
    expect(el.querySelectorAll('.cap')).toHaveLength(1);
    expect(el.querySelector('.cap')!.textContent?.trim()).toBe('8');
  });
});

describe('StatusMeterListComponent', () => {
  it('lists every status in workflow order with count, share and a filter link', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(StatusMeterListComponent);
    fixture.componentRef.setInput('counts', { total: 4, byStatus: { DRAFT: 1, APPROVED: 3 } });
    await fixture.whenStable();
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')];

    expect(links).toHaveLength(6);
    const name = (a: HTMLElement) => a.textContent!.replace(/\s+/g, ' ').trim();
    expect(name(links[0])).toBe('Draft 1 · 25% , show these applications');
    expect(name(links[4])).toBe('Approved 3 · 75% , show these applications');
    expect(links[1].textContent).toContain('0');
    expect(links[0].getAttribute('href')).toBe('/applications?status=DRAFT');
  });
});
