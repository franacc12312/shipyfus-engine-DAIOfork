export interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface TweetResult {
  status: 'posted' | 'failed';
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}
