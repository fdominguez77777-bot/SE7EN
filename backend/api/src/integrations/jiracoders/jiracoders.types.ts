export type JiracodersEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  count?: number;
};

export type JiracodersUserRef = {
  id?: number;
  name?: string | null;
  avatar?: string | null;
  groupId?: number | null;
  createdAt?: string | null;
};

export type JiracodersProfileRef = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  experience?: string | unknown[] | null;
  education?: string | unknown[] | null;
};

export type JiracodersBidderRef = {
  id?: number;
  name?: string | null;
};

export type JiracodersApplicationListItem = {
  id: number;
  userId?: number;
  companyName?: string | null;
  position?: string | null;
  source?: string | null;
  url?: string | null;
  status?: string | null;
  outcome?: string | null;
  createdAt?: string | null;
  user?: JiracodersUserRef | null;
  profile?: JiracodersProfileRef | null;
  bidder?: JiracodersBidderRef | null;
};

export type JiracodersInterviewEvent = {
  id?: number;
  summary?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
  rating?: number | null;
};

export type JiracodersInterview = {
  id?: number;
  jobApplicationId?: number;
  eventId?: number;
  event?: JiracodersInterviewEvent | null;
};

export type JiracodersStatusHistory = {
  id?: number;
  jobApplicationId?: number;
  status?: string | null;
  outcome?: string | null;
  userId?: number | null;
  changedAt?: string | null;
  changedByUser?: JiracodersUserRef | null;
};

export type JiracodersApplicationDetails = JiracodersApplicationListItem & {
  jobDescription?: string | null;
  resume?: string | null;
  salary?: number | string | null;
  expYears?: number | null;
  note?: string | null;
  profileId?: number | null;
  bidderId?: number | null;
  interviews?: JiracodersInterview[] | null;
  statusHistory?: JiracodersStatusHistory[] | null;
};

export type JiracodersBidderStat = {
  id: number;
  name?: string | null;
  username?: string | null;
  isActive?: boolean;
  applicationsCount?: number;
};

export type JiracodersListQuery = {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: string;
  cursor?: string;
  includeCount?: boolean;
  fromDate?: string;
  toDate?: string;
};
