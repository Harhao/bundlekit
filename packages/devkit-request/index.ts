import axios from "axios";

export interface RequestConfig {
    engine?: "axios" | "fetch";
    baseURL?: string;
    timeout?: number;
    interceptors?: {
        request?: (config: any) => any;
        response?: (data: any) => any;
    };
}

export interface RequestInstance {
    get<T = any>(url: string, config?: Record<string, any>): Promise<{ data: T }>;
    post<T = any>(url: string, data?: any, config?: Record<string, any>): Promise<{ data: T }>;
    put<T = any>(url: string, data?: any, config?: Record<string, any>): Promise<{ data: T }>;
    delete<T = any>(url: string, config?: Record<string, any>): Promise<{ data: T }>;
}

/** 安全拼接 baseURL + url，避免 double-slash */
function joinUrl(base: string, url: string): string {
    const b = base.replace(/\/$/, "");
    const u = url.replace(/^\//, "");
    return `${b}/${u}`;
}

function createAxiosInstance(config: RequestConfig = {}): RequestInstance {
    const instance = axios.create({
        baseURL: config.baseURL || "/",
        timeout: config.timeout || 10000,
    });

    if (config.interceptors?.request) {
        instance.interceptors.request.use(config.interceptors.request);
    }
    if (config.interceptors?.response) {
        instance.interceptors.response.use(config.interceptors.response);
    }

    return {
        get: (url, cfg) => instance.get(url, cfg),
        post: (url, data, cfg) => instance.post(url, data, cfg),
        put: (url, data, cfg) => instance.put(url, data, cfg),
        delete: (url, cfg) => instance.delete(url, cfg),
    };
}

function createFetchInstance(config: RequestConfig = {}): RequestInstance {
    const baseURL = config.baseURL || "/";
    const timeout = config.timeout || 10000;
    const reqInterceptor = config.interceptors?.request;
    const resInterceptor = config.interceptors?.response;

    function requestWithTimeout(url: string, opts: RequestInit, ms: number) {
        return new Promise<Response>((resolve, reject) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), ms);
            fetch(url, { ...opts, signal: controller.signal })
                .then((res) => { clearTimeout(timer); resolve(res); })
                .catch((err) => { clearTimeout(timer); reject(err); });
        });
    }

    async function request<T>(
        url: string,
        opts: RequestInit,
    ): Promise<{ data: T }> {
        // request 拦截器：可追加 headers
        let finalOpts = { ...opts };
        if (reqInterceptor) {
            const merged = reqInterceptor({ headers: {}, ...finalOpts });
            finalOpts = merged ?? finalOpts;
        }

        const res = await requestWithTimeout(joinUrl(baseURL, url), finalOpts, timeout);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        let data: T = await res.json();

        // response 拦截器：可转换返回值
        if (resInterceptor) {
            data = resInterceptor(data) ?? data;
        }

        return { data };
    }

    return {
        get: (url, cfg) => request(url, { method: "GET", ...(cfg || {}) }),
        post: (url, body, cfg) => request(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...((cfg as any)?.headers || {}) },
            body: JSON.stringify(body),
            ...(cfg || {}),
        }),
        put: (url, body, cfg) => request(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...((cfg as any)?.headers || {}) },
            body: JSON.stringify(body),
            ...(cfg || {}),
        }),
        delete: (url, cfg) => request(url, { method: "DELETE", ...(cfg || {}) }),
    };
}

export function createRequest(config: RequestConfig = {}): RequestInstance {
    if (config.engine === "fetch") {
        return createFetchInstance(config);
    }
    return createAxiosInstance(config);
}
