// Copy for the review success modal. The date comes from the server, which
// schedules the payout on the reviewed tradesperson's tier, not the poster's.
export function payoutReleaseText(payoutScheduledAt: string | null | undefined, amount: number): string | null {
  if (!payoutScheduledAt) return null;
  const date = new Date(payoutScheduledAt);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `£${amount} will be released to the tradesperson on ${formatted}.`;
}
