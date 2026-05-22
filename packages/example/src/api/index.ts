import { createRequest } from "@bundlekit/request";

const http = createRequest({
  engine: "axios",
  baseURL: "/api",
  timeout: 10000,
  interceptors: {
    request: (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    response: (res) => {
      const { code, data, message } = res.data as { code: number; data: unknown; message: string };
      if (code !== 0) {
        return Promise.reject(new Error(message ?? "请求失败"));
      }
      return data;
    },
  },
});

export default http;
