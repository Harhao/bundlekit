export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface PageParams {
  page: number;
  pageSize: number;
  keyword?: string;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
  role: string;
}

export interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}
