export interface User {
  id: number;
  username: string;
  created_at: string | null;
}

export interface SystemStatus {
  database: {
    connected: boolean;
    name?: string;
    book_count?: number;
    error?: string;
  };
  b2: {
    connected: boolean;
    bucket_name?: string;
    endpoint?: string;
    epub_count?: number;
    error?: string;
  };
}
