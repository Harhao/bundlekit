import { createRequest } from "@devkit/request";

const http = createRequest({
  engine: "axios",
  baseURL: "/api",
  timeout: 10000,
  interceptors: {
    request: (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    response: (res) => res.data,
  },
});

export default http;
