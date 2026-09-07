export type ApplicationColumnFilters = {
  company?: string;
  position?: string;
  source?: string;
  status?: string;
  applied?: string;
  bidderName?: string;
};

export function hasApplicationColumnFilters(filters: ApplicationColumnFilters) {
  return Object.values(filters).some((value) => (value ?? '').trim().length > 0);
}

export function matchesApplicationColumnFilters(
  row: {
    companyName: string;
    jobTitle: string;
    source: string;
    status: string;
    appliedAt: string;
    bidderName: string | null;
  },
  filters: ApplicationColumnFilters,
) {
  return (
    contains(row.companyName, filters.company) &&
    contains(row.jobTitle, filters.position) &&
    contains(row.source, filters.source) &&
    contains(row.status, filters.status) &&
    contains(appliedSearchText(row.appliedAt), filters.applied) &&
    contains(row.bidderName ?? '', filters.bidderName)
  );
}

function contains(haystack: string, needle?: string) {
  const query = (needle ?? '').trim().toLowerCase();
  if (!query) {
    return true;
  }
  return haystack.toLowerCase().includes(query);
}

function appliedSearchText(appliedAt: string) {
  if (!appliedAt) {
    return '';
  }
  const date = new Date(appliedAt);
  if (Number.isNaN(date.getTime())) {
    return appliedAt;
  }
  return [
    appliedAt,
    date.toISOString(),
    date.toDateString(),
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  ].join(' ');
}
