import { canCancelJob, cancelJobDescription } from '@/src/utils/jobCancellation';
import { Job } from '@/constants/types';

const base = {
  id: 'j1', title: 'Rewire', dayRate: 250, duration: 5,
  startDate: '2026-10-20', status: 'in_progress', paymentStatus: 'escrowed',
} as unknown as Job;
const before = new Date(2026, 9, 18);  // 18 Oct
const onStart = new Date(2026, 9, 20); // 20 Oct

describe('canCancelJob', () => {
  it('allows either party to cancel an accepted job', () => {
    const job = { ...base, status: 'accepted', paymentStatus: 'none' } as Job;
    expect(canCancelJob(job, 'poster', onStart)).toBe(true);
    expect(canCancelJob(job, 'tradesperson', onStart)).toBe(true);
  });
  it('allows either party to cancel an unpaid in-progress job', () => {
    const job = { ...base, paymentStatus: 'payin_pending' } as Job;
    expect(canCancelJob(job, 'poster', onStart)).toBe(true);
    expect(canCancelJob(job, 'tradesperson', onStart)).toBe(true);
  });
  it('lets the poster cancel a paid job only before the start date', () => {
    expect(canCancelJob(base, 'poster', before)).toBe(true);
    expect(canCancelJob(base, 'poster', onStart)).toBe(false);
  });
  it('always lets the tradesperson cancel a paid job', () => {
    expect(canCancelJob(base, 'tradesperson', onStart)).toBe(true);
  });
  it('never offers cancellation for open, completed or cancelled jobs', () => {
    for (const status of ['open', 'completed', 'cancelled'] as const) {
      expect(canCancelJob({ ...base, status } as Job, 'tradesperson', before)).toBe(false);
    }
  });
});

describe('cancelJobDescription', () => {
  it('states the full refund for a paid job', () => {
    expect(cancelJobDescription(base, true)).toContain('£1,250 payment will be refunded in full');
  });
  it('says the payment link closes for an unpaid in-progress job', () => {
    expect(cancelJobDescription({ ...base, paymentStatus: 'payin_pending' } as Job, true))
      .toContain('payment link will be closed');
  });
  it('uses the no-escrow copy when escrow is off', () => {
    expect(cancelJobDescription(base, false)).toContain('tradesperson will be notified');
  });
});
