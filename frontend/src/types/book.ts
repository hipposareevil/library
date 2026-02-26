export interface Tag {
  id: number;
  name: string;
}

export interface TagWithCount extends Tag {
  count: number;
}

export interface BookListItem {
  id: number;
  title: string;
  title_sort: string | null;
  author: string | null;
  publisher: string | null;
  publish_date: string | null;
  isbn: string | null;
  language: string | null;
  cover_key: string | null;
  has_epub: boolean;
  rating: number;
  series_name: string | null;
  series_index: number | null;
  tags: Tag[];
}

export interface BookDetail extends BookListItem {
  calibre_id: number | null;
  uuid: string | null;
  author_sort: string | null;
  google_id: string | null;
  amazon_id: string | null;
  description: string | null;
  notes: string | null;
  epub_key: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaginatedBooks {
  items: BookListItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface BookSearchParams {
  q?: string;
  author?: string;
  tags?: string;
  year_from?: number;
  year_to?: number;
  rating_min?: number;
  has_epub?: boolean;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export type ViewMode = "grid" | "list" | "masonry" | "table";
