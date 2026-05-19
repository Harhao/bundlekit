import http from "./index";
import type { Post, PageParams, PageResult } from "./types";

export const getPosts = (params: PageParams): Promise<PageResult<Post>> =>
  http.get("/posts", { params });

export const getPostsByUser = (userId: number): Promise<Post[]> =>
  http.get("/posts", { params: { userId } });
