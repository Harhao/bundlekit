import http from "./index";
import type { User, PageParams, PageResult } from "./types";

export const getUsers = (params: PageParams): Promise<PageResult<User>> =>
  http.get("/users", { params });

export const getUserById = (id: number): Promise<User> =>
  http.get(`/users/${id}`);
