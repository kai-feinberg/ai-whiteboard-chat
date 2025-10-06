export type Subscription = {
  _id: string;
  _creationTime: number;
  userId: string;
  searchTerm?: string;
  company?: string;
  platform: string;
  frequency: string;
  isActive: boolean;
  lastScrapedAt?: number;
};
