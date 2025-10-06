export type Ad = {
  _id: string;
  _creationTime: number;
  userId: string;
  subscriptionId: string;
  platform: string;
  adId: string;
  title: string;
  description: string;
  link?: string;
  mediaUrls: string[];
  thumbnailUrl?: string;
  scrapedAt: number;
  rawData?: any;
};
