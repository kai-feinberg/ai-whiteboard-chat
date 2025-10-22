export type Advertiser = {
  _id: string;
  pageId: string;
  platform: string;
  pageName: string;
  pageLikeCount: number;
  pageCategories: string[];
  pageProfilePictureUrl?: string;
  pageProfileUri?: string;
  lastScrapedAt: number;
};

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

  // Media storage fields
  thumbnailStorageId?: string;
  mediaStorageIds?: string[];
  mediaMetadata?: Array<{
    type: string; // "image" | "video"
    storageId: string;
    originalUrl: string;
  }>;
  // Lazy loading media items (includes type, storageId, and url which may be null for videos)
  mediaItems?: Array<{
    type: string;
    storageId: string;
    url: string | null;
  }>;

  // New fields (optional for backward compatibility)
  pageId?: string;
  startDate?: number;
  endDate?: number;
  isActive?: boolean;
  totalActiveTime?: number;
  displayFormat?: string;
  ctaText?: string;
  ctaType?: string;
  collationCount?: number;
  caption?: string;
  publisherPlatforms?: string[];
  reachEstimate?: {
    lower: number;
    upper: number;
  };
  spend?: {
    lower: number;
    upper: number;
    currency: string;
  };
  cards?: Array<{
    title?: string;
    body?: string;
    caption?: string;
    linkUrl?: string;
    imageUrl?: string;
    videoUrl?: string;
  }>;
  hasVideo?: boolean;
  videoCount?: number;
  imageCount?: number;

  // Joined data from advertiser
  advertiser?: Advertiser | null;
};
