import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

interface RequestOptions extends http.RequestOptions {
    timeout?: number;
    body?: any;
}

interface Response {
    status: number;
    statusText: string;
    headers: http.IncomingHttpHeaders;
    data: any;
}

/**
 * 自定义Fetch类，基于node内置http/https模块封装
 */
export class Fetch {
    private baseUrl: string;
    private defaultOptions: RequestOptions;

    constructor(baseUrl: string = '', defaultOptions: RequestOptions = {}) {
        this.baseUrl = baseUrl;
        this.defaultOptions = {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
            ...defaultOptions,
        };
    }

    /**
     * 发送请求
     * @param url 请求地址
     * @param options 请求配置
     * @returns Promise<Response>
     */
    async request(url: string, options: RequestOptions = {}): Promise<Response> {
        const finalUrl = new URL(this.baseUrl + url);
        const finalOptions = {
            ...this.defaultOptions,
            ...options,
            headers: {
                ...this.defaultOptions.headers,
                ...options.headers,
            },
            protocol: finalUrl.protocol,
            hostname: finalUrl.hostname,
            port: finalUrl.port,
            path: finalUrl.pathname + finalUrl.search,
        };

        const client = finalUrl.protocol === 'https:' ? https : http;

        return new Promise((resolve, reject) => {
            const req = client.request(finalOptions, (res) => {
                const chunks: Buffer[] = [];

                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const data = Buffer.concat(chunks).toString();
                    resolve({
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        data: typeof finalOptions.headers['Content-Type'] === 'string' && 
                            finalOptions.headers['Content-Type'].includes('application/json')
                            ? JSON.parse(data)
                            : data
                    });
                });
            });

            req.on('error', (error) => {
                reject(new Error(`请求失败: ${error.message}`));
            });

            if (finalOptions.timeout) {
                req.setTimeout(finalOptions.timeout, () => {
                    req.destroy();
                    reject(new Error('请求超时'));
                });
            }

            if (finalOptions.body) {
                req.write(JSON.stringify(finalOptions.body));
            }

            req.end();
        });
    }

    /**
     * GET请求
     * @param url 请求地址
     * @param options 请求配置
     */
    async get(url: string, options: RequestOptions = {}): Promise<Response> {
        return this.request(url, { ...options, method: 'GET' });
    }

    /**
     * POST请求
     * @param url 请求地址
     * @param data 请求数据
     * @param options 请求配置
     */
    async post(url: string, data?: any, options: RequestOptions = {}): Promise<Response> {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: data,
        });
    }

    /**
     * PUT请求
     * @param url 请求地址
     * @param data 请求数据
     * @param options 请求配置
     */
    async put(url: string, data?: any, options: RequestOptions = {}): Promise<Response> {
        return this.request(url, {
            ...options,
            method: 'PUT',
            body: data,
        });
    }

    /**
     * DELETE请求
     * @param url 请求地址
     * @param options 请求配置
     */
    async delete(url: string, options: RequestOptions = {}): Promise<Response> {
        return this.request(url, { ...options, method: 'DELETE' });
    }
}
