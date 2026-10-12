export interface JobFilterState {
  selectedTrades: string[];
  location: string;
  minDayRate: number | null;
}

/**
 * True when the filters are in their default state: no restriction, or only the
 * viewer's own trade (the pre-selected default), with no location or rate filter.
 */
export function isDefaultJobFilter(filters: JobFilterState, userTrade: string | null | undefined): boolean {
  if (filters.location !== '' || filters.minDayRate !== null) return false;
  const { selectedTrades } = filters;
  if (selectedTrades.length === 0) return true;
  const trade = userTrade?.trim();
  return !!trade && selectedTrades.length === 1 && selectedTrades[0] === trade;
}
