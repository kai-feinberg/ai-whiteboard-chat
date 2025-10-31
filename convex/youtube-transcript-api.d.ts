declare module "youtube-transcript-api" {
  interface TranscriptSegment {
    text: string;
    start: string;
    dur: string;
  }

  interface TranscriptTrack {
    language: string;
    transcript: TranscriptSegment[];
  }

  interface PlayabilityStatus {
    status: string;
    reason?: string;
    playableInEmbed?: boolean;
  }

  interface TranscriptResponse {
    id: string;
    title: string;
    microformat?: any;
    tracks: TranscriptTrack[];
    isLive: boolean;
    languages: Array<{ label: string; languageCode: string }>;
    isLoginRequired: boolean;
    playabilityStatus: PlayabilityStatus;
    author?: string;
    channelId?: string;
    keywords?: string[];
    failedReason?: string;
  }

  class TranscriptClient {
    constructor(config?: any);
    ready: Promise<void>;
    getTranscript(id: string, config?: any): Promise<TranscriptResponse>;
    bulkGetTranscript(ids: string[], config?: any): Promise<TranscriptResponse[]>;
  }

  export default TranscriptClient;
}
