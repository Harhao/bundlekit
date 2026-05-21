import getPortDefault from "get-port";

/**
 * 拿一个空闲端口。每个集成测试用独立端口避免冲突。
 */
export async function getFreePort(): Promise<number> {
    return getPortDefault();
}
