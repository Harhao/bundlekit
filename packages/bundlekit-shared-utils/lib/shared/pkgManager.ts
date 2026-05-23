import ora from 'ora';
import ini from 'ini';
import os from 'node:os';
import fs from 'node:fs';
import semver from 'semver';
import path from 'node:path';
import minimist from 'minimist';
import stripAnsi from 'strip-ansi';

import { LRUCache as LRU } from 'lru-cache';
import { FileManager } from './fileManager';
import { createRequire } from 'node:module';
import { spawn, SpawnOptions, spawnSync } from 'node:child_process';
import { Logger } from './logger';

export enum EPackageMangerTool {
    NPM = "npm",
    YARN = "yarn",
    PNPM = "pnpm",
};

// 注册表
const registries = {
    npm: 'https://registry.npmjs.org',
    yarn: 'https://registry.yarnpkg.com',
    taobao: 'https://registry.npmmirror.com',
    pnpm: 'https://registry.npmjs.org',
    cnpm: 'https://r.cnpmjs.org',
    tencent: 'https://mirrors.cloud.tencent.com/npm/',
    npmMirror: 'https://skimdb.npmjs.com/registry/',
};

type PackageManagerCommand = 'install' | 'add' | 'upgrade' | 'remove';
type PackageManagerConfig = Record<PackageManagerCommand, string[]>;

interface PackageManagerOptions {
    context?: string;
    forcePackageManager?: EPackageMangerTool;
}

export class PackageManager {

    private fse: FileManager;
    private bin: EPackageMangerTool | null = null;

    private context: string;
    private needsPeerDepsFix: boolean = false;
    private _registries: Record<string, string> = {};
    private _registerToolsProjects: LRU<string, boolean>;
    private metadataCache = new LRU({
        max: 200,
    });

    private logger = new Logger();

    constructor({ context, forcePackageManager }: PackageManagerOptions = {}) {

        this.context = context || process.cwd();
        this.fse = new FileManager(this.context);

        this._registerToolsProjects = new LRU({
            maxSize: 500,
            sizeCalculation: () => 1
        });

        if (forcePackageManager) {
            this.bin = forcePackageManager;
        } else if (context) {
            if (this.hasProjectYarn(context)) {
                this.bin = EPackageMangerTool.YARN;
            } else if (this.hasProjectPnpm(context)) {
                this.bin = EPackageMangerTool.PNPM;
            } else if (this.hasProjectNpm(context)) {
                this.bin = EPackageMangerTool.NPM;
            }
        }

        if (!this.bin) {
            this.bin = this.hasYarnCommand() ? EPackageMangerTool.YARN :
                this.hasPnpmVersionOrLater('3.0.0') ? EPackageMangerTool.PNPM :
                    EPackageMangerTool.NPM;
        }

        if (this.bin === EPackageMangerTool.NPM) {
            const MIN_SUPPORTED_NPM_VERSION = '6.9.0';
            const npmVersion = stripAnsi(spawnSync('npm', ['--version']).stdout.toString())

            if (semver.lt(npmVersion, MIN_SUPPORTED_NPM_VERSION)) {
                throw new Error("NPM版本过低，请升级NPM版本");
            }
            if (semver.gte(npmVersion, '7.0.0')) {
                this.needsPeerDepsFix = true
            }
        }

        if (!['yarn', 'pnpm', 'npm'].includes(this.bin)) {
            throw new Error(`不支持的包管理器: ${this.bin}`);
        }
        this.logger.log(this.bin, "包管理器");
    }

    /**
     * 获取包作用域范围
     * @param packageName string 包名称
     * @returns string | undefined 包作用域范围
     */
    private extractPackageScope(packageName: string) {

        const scopedNameRegExp = /^(@[^/]+)\/.*$/
        const result = packageName.match(scopedNameRegExp)

        if (!result) {
            return undefined
        }

        return result[1]
    }

    /**
     * 获取注册表
     * @param scope 作用域
     * @returns 注册表
     */
    async getRegistry(scope?: string): Promise<string> {
        const cacheKey = scope || ''
        if (this._registries[cacheKey]) {
            return this._registries[cacheKey]
        }

        const args = minimist(process.argv, {
            alias: {
                r: 'registry'
            }
        });

        let registry: string | undefined;
        if (args.registry as string) {
            registry = args.registry
        } else {
            const execOpts = { 
                cwd: this.context,
                env: { ...process.env, COREPACK_ENABLE_STRICT: '0' }
            };
            try {
                if (scope) {
                    registry = (await this.execa(this.bin, ['config', 'get', scope + ':registry'], execOpts)).stdout
                }
                if (!registry || registry === 'undefined') {
                    registry = (await this.execa(this.bin, ['config', 'get', 'registry'], execOpts)).stdout
                }
            } catch (e) {
                // Yarn 2 uses `npmRegistryServer` instead of `registry`
                registry = (await this.execa(this.bin, ['config', 'get', 'npmRegistryServer'], execOpts)).stdout
            }
        }

        this._registries[cacheKey] = stripAnsi(registry).trim()
        return this._registries[cacheKey]
    }

    /**
     * 执行命令
     * @param command 命令
     * @param args 命令参数
     * @param options 命令选项
     * @returns 命令执行结果
     */
    private async execa(command: string, args: string[], options?: SpawnOptions): Promise<{ stdout: string; stderr: string; exitCode: number }> {

        return new Promise((resolve, reject) => {

            const spawnOptions: SpawnOptions = {
                shell: true,
                ...(options || {})
            };

            // 如果没有指定 stdio，默认使用 pipe
            if (!spawnOptions.stdio) {
                spawnOptions.stdio = 'pipe';
            }

            const child = spawn(command, args, spawnOptions);

            let stdout: string = '';
            let stderr: string = '';

            if (child.stdout) {
                child.stdout.on('data', (data: Buffer) => {
                    stdout += data.toString();
                });
            }

            if (child.stderr) {
                child.stderr.on('data', (data: Buffer) => {
                    stderr += data.toString();
                });
            }

            child.on('close', (code: number) => {
                if (code !== 0) {
                    reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}\n${stderr}`));
                } else {
                    resolve({ stdout, stderr, exitCode: code });
                }
            });

            child.on('error', (err: Error) => {
                reject(err);
            });
        });
    }

    /**
     * 获取仓库授权配置信息
     * @param scope 仓库范围
     * @returns 授权配置信息
     */
    async getAuthConfig(scope: string) {

        const possibleRcPaths = [
            path.resolve(this.context, '.npmrc'),
            path.resolve(os.homedir(), '.npmrc'),
        ]
        if (process.env.PREFIX) {
            possibleRcPaths.push(path.resolve(process.env.PREFIX, '/etc/npmrc'))
        }

        let npmConfig = {}
        for (const loc of possibleRcPaths) {
            if (this.fse.isFilePathExist(loc)) {
                try {
                    const content = this.fse.readFileContent(loc);
                    const parsedConfig = ini.parse(content);
                    npmConfig = Object.assign({}, parsedConfig, npmConfig);
                } catch (e) {
                    this.logger.debug(`读取 .npmrc 失败（已忽略）: ${(e as any)?.message ?? e}`);
                }
            }
        }

        const registry = await this.getRegistry(scope)
        const registryWithoutProtocol = registry
            .replace(/https?:/, '') // remove leading protocol
            .replace(/([^/])$/, '$1/') // ensure ending with slash
        const authTokenKey = `${registryWithoutProtocol}:_authToken`
        const authUsernameKey = `${registryWithoutProtocol}:username`
        const authPasswordKey = `${registryWithoutProtocol}:_password`

        const auth = {} as Record<string, string>;

        if (authTokenKey in npmConfig) {
            auth.token = npmConfig[authTokenKey]
        }
        if (authPasswordKey in npmConfig) {
            auth.username = npmConfig[authUsernameKey]
            auth.password = Buffer.from(npmConfig[authPasswordKey], 'base64').toString()
        }
        return auth
    }

    /**
     * 设置注册表环境变量
     */
    async setRegistryEnvs() {

        const registry = await this.getRegistry();

        this.logger.log(registry, "镜像地址");

        process.env.npm_config_registry = registry;
        process.env.YARN_NPM_REGISTRY_SERVER = registry;
        process.env.PNPM_REGISTRY = registry;

        this.setBinaryMirrors()
    }

    /**
     * 设置镜像（仅对淘宝镜像生效）。
     * 探测 binary-mirror-config 失败时静默忽略，不向 stderr 输出。
     */
    async setBinaryMirrors() {

        const registry = await this.getRegistry()

        if (registry !== registries.taobao) {
            return
        }

        try {
            const binaryMirrorConfigMetadata = await this.getMetadata('binary-mirror-config', { full: true })
            const latest = binaryMirrorConfigMetadata['dist-tags'] && binaryMirrorConfigMetadata['dist-tags'].latest
            const mirrors = binaryMirrorConfigMetadata.versions[latest].mirrors.china
            for (const key in mirrors.ENVS) {
                process.env[key] = mirrors.ENVS[key]
            }

            const cypressMirror = mirrors.cypress
            const defaultPlatforms = {
                darwin: 'osx64',
                linux: 'linux64',
                win32: 'win64'
            }
            const platforms = cypressMirror.newPlatforms || defaultPlatforms
            const targetPlatform = platforms[require('os').platform()]

            if (targetPlatform && !process.env.CYPRESS_INSTALL_BINARY) {
                const projectPkg = this.fse.readJsonFile('package.json');
                if (projectPkg && projectPkg.devDependencies && projectPkg.devDependencies.cypress) {
                    const wantedCypressVersion = await this.getRemoteVersion('cypress', projectPkg.devDependencies.cypress)
                    process.env.CYPRESS_INSTALL_BINARY =
                        `${cypressMirror.host}/${wantedCypressVersion}/${targetPlatform}/cypress.zip`
                }
            }
        } catch (e) {
            // 静默：binary-mirror 探测失败不影响主安装流程，仅 debug 级别记录
            this.logger.debug(`binary-mirror 探测失败（已忽略）: ${(e as any)?.message ?? e}`);
        }
    }

    /**
     * 尝试加载一个包, 引用动态包模块
     * @param context 上下文
     * @param packageName 包名称
     * @returns 包模块或 null
     */
    public resolvePackage(context: string, packageName: string) {
        try {
            const cwdDir = context || this.context;
            const require = createRequire(import.meta.url);
            const modulePath = path.resolve(cwdDir, 'node_modules', packageName);
            const module = require(modulePath);
            return module?.default || module;
        } catch (error) {
             // 如果绝对路径引入失败，尝试使用包名引入
             try {
                const bundlerModule = require(packageName);
                return bundlerModule?.default || bundlerModule;
            } catch {
                return null;
            }
        }
    }

    /**
     * 获取包元数据
     * @param packageName 包名称
     * @param full 是否获取完整元数据
     * @returns 包元数据
     */
    async getMetadata(packageName: string, { full = false } = {}) {

        const scope = this.extractPackageScope(packageName)
        const registry = await this.getRegistry(scope)

        const metadataKey = `${this.bin}-${registry}-${packageName}`
        let metadata = this.metadataCache.get(metadataKey) as any;

        if (metadata) {
            return metadata
        }

        const headers = {} as Record<string, string>;

        if (!full) {
            headers.Accept = 'application/vnd.npm.install-v1+json;q=1.0, application/json;q=0.9, */*;q=0.8'
        }

        const authConfig = await this.getAuthConfig(scope);

        if ('password' in authConfig) {
            const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64')
            headers.Authorization = `Basic ${credentials}`
        }
        if ('token' in authConfig) {
            headers.Authorization = `Bearer ${authConfig.token}`
        }

        const url = `${registry.replace(/\/$/g, '')}/${packageName}`
        try {
            const res = await fetch(url, { method: 'GET', headers });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${url}`)
            }
            metadata = await res.json();
            if (metadata?.error) {
                throw new Error(metadata.error)
            }
            this.metadataCache.set(metadataKey, metadata)
            return metadata
        } catch (e) {
            this.logger.debug(`Failed to get response from ${url}: ${(e as any)?.message ?? e}`);
            throw e
        }
    }

    /**
     * 获取远程版本
     * @param packageName 包名称
     * @param versionRange 版本范围
     * @returns string 远程版本
     */
    async getRemoteVersion(packageName: string, versionRange: string = 'latest') {
        const metadata = await this.getMetadata(packageName)
        if (Object.keys(metadata['dist-tags']).includes(versionRange)) {
            return metadata['dist-tags'][versionRange]
        }
        const versions = Array.isArray(metadata.versions) ? metadata.versions : Object.keys(metadata.versions)
        return semver.maxSatisfying(versions, versionRange)
    }

    /**
     * 执行包管理器命令
     * @param bin EPackageMangerTool 包管理器
     * @param args 包管理器命令参数
     * @param cwd 执行命令的上下文路径
     * @returns string 命令执行结果
     */
    private async executeCommand(bin: EPackageMangerTool, args: string[], cwd: string) {

        try {

            const command = bin === EPackageMangerTool.NPM ? 'npm' : bin;

            this.logger.log(`${command} ${args.join(' ')}`, "安装命令");

            // stdin 用 'ignore' 而非 'inherit'：
            // 在 ink raw-mode 环境下，继承 stdin 会导致 pnpm 等待 EOF 而永久阻塞。
            // 包管理器 install/add 命令完全不需要 stdin。
            const result = await this.execa(command, args, {
                cwd,
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe'] as const,
                env: {
                    ...process.env,
                    COREPACK_ENABLE_STRICT: '0',
                },
            });

            return true;

        } catch (error) {
            // pnpm 在 peer dependencies 警告时可能返回非零退出码
            // 检查是否是这种情况（安装实际成功但有警告）
            const errorMsg = (error as Error).message || '';
            if (bin === EPackageMangerTool.PNPM && errorMsg.includes('exit code')) {
                // 检查 stderr 中是否有实际的安装失败信息
                const hasRealError = errorMsg.includes('ERR_PNPM') || 
                                    errorMsg.includes('ERROR') ||
                                    errorMsg.includes('failed');
                if (!hasRealError) {
                    // 可能只是 peer dependencies 警告，认为安装成功
                    this.logger.debug(`pnpm 返回非零退出码但可能安装成功: ${errorMsg}`);
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * 获取包管理器命令参数
     * @param bin EPackageMangerTool 包管理器
     * @returns string[] 包管理器配置
     */
    private getPackageManagerConfig(bin: EPackageMangerTool): Record<PackageManagerCommand, string[]> {

        const PACKAGE_MANAGER_PNPM4_CONFIG: PackageManagerConfig = {
            install: ['install', '--reporter', 'append-only'],
            add: ['add', '--reporter', 'append-only'],
            upgrade: ['update', '--reporter', 'append-only'],
            remove: ['uninstall', '--reporter', 'append-only']
        };

        const PACKAGE_MANAGER_PNPM3_CONFIG: PackageManagerConfig = {
            install: ['install', '--loglevel', 'error'],
            add: ['add', '--loglevel', 'error'],
            upgrade: ['update', '--loglevel', 'error'],
            remove: ['uninstall', '--loglevel', 'error']
        };

        const PACKAGE_MANAGER_CONFIG: Record<EPackageMangerTool, PackageManagerConfig> = {
            [EPackageMangerTool.NPM]: {
                install: ['install', '--loglevel', 'error'],
                add: ['install', '--loglevel', 'error'],
                upgrade: ['update', '--loglevel', 'error'],
                remove: ['uninstall', '--loglevel', 'error']
            },
            [EPackageMangerTool.YARN]: {
                install: [],
                add: ['add'],
                upgrade: ['upgrade'],
                remove: ['remove']
            },
            [EPackageMangerTool.PNPM]: this.hasPnpmVersionOrLater('4.0.0') ?
                PACKAGE_MANAGER_PNPM4_CONFIG :
                PACKAGE_MANAGER_PNPM3_CONFIG
        };

        return PACKAGE_MANAGER_CONFIG[bin];
    }

    /**
     * 判断是否存在pnpm命令
     * @param version 版本号
     * @returns boolean 表示是否存在pnpm命令
     */
    private hasPnpmVersionOrLater(version: string): boolean {
        try {
            const result = spawnSync('pnpm', ['--version'], { stdio: ['pipe', 'pipe', 'ignore'] });
            if (result.status !== 0) return false;
            const pnpmVersion = stripAnsi(result.stdout.toString().trim()) || '0.0.0';
            return semver.gte(pnpmVersion, version);
        } catch (e) {
            return false;
        }
    }

    /**
     * 判断是否存在yarn命令
     * @returns boolean 表示是否存在yarn命令
     */
    private hasYarnCommand(): boolean {
        try {
            const result = spawnSync('yarn', ['--version'], { stdio: 'ignore' });
            return result.status === 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * 获取已安装包版本
     * @param packageName 包名称
     * @returns string | null 包版本
     */
    public async getInstalledVersion(packageName: string): Promise<string | null> {
        try {
            const require = createRequire(this.context);
            const packagePath = require.resolve(`${packageName}/package.json`);
            const packageJson = this.fse.readJsonFile(packagePath);
            return packageJson.version;
        } catch (e) {
            console.warn(`Failed to get version for ${packageName}:`, e);
            return null;
        }
    }

    // 移除包
    public async remove(packageName: string) {
        return await this.runCommand('remove', [packageName]);
    }

    /**
     * 安装依赖
     * @returns Promise<void> 
     */
    public async install() {
        const args = [];
        if (this.needsPeerDepsFix) {
            args.push('--legacy-peer-deps');
        }
        return await this.runCommand('install', args);
    }

    /**
     * 判断是否pnpm管理的项目
     * @param context 当前执行命令上下文
     * @returns boolean 表示是否存在pnpm.lock文件，存在则表示当前项目使用pnpm进行包管理
     */
    public hasProjectPnpm(context: string) {
        const cacheKey = `${context}:pnpm`;
        if (this._registerToolsProjects.has(cacheKey)) {
            return this.checkPnpm(this._registerToolsProjects.get(cacheKey));
        }
        const lockFile = this.fse.getAbsolutePath("pnpm-lock.yaml");
        const result = this.fse.isFilePathExist(lockFile);
        this._registerToolsProjects.set(cacheKey, result);
        return this.checkPnpm(result);
    }

    /**
     * 是否npm管理的项目
     * @param context string 执行命令的上下文pat
     * @returns boolean 是或否
     */
    public hasProjectNpm(context: string) {
        const cacheKey = `${context}:npm`;
        if (this._registerToolsProjects.has(cacheKey)) {
            return this._registerToolsProjects.get(cacheKey);
        }
        const lockFile = this.fse.getAbsolutePath("package-lock.json");
        const result = this.fse.isFilePathExist(lockFile);
        this._registerToolsProjects.set(cacheKey, result);
        return result;
    }

    /**
     * 检测本地是否已安装了pnpm3或以上版本
     * @returns boolean 表示是否存在pnpm
     */
    private hasPnpm3OrLater(): boolean {
        try {
            const result = spawnSync('pnpm', ['--version'], { stdio: ['pipe', 'pipe', 'ignore'] });
            if (result.status !== 0) return false;
            const pnpmVersion = stripAnsi(result.stdout.toString().trim()) || '0.0.0';
            return semver.gte(pnpmVersion, '3.0.0');
        } catch (e) {
            return false;
        }
    }


    /**
     * 检测本地是否已安装了pnpm
     * @param result lru缓存结果
     * @returns boolean 表示是否存在pnpm
     */
    private checkPnpm(result: boolean | undefined): boolean {
        if (result && !this.hasPnpm3OrLater()) {
            return false;
        }
        return !!result;
    }

    /**
     * 检查是否是yarn管理的项目
     * @param context 当前执行命令上下文
     * @returns boolean 表示是否存在yarn.lock文件，存在则表示当前项目使用yarn进行包管理
     */
    public hasProjectYarn(context: string) {
        const cacheKey = `${context}:yarn`;
        if (this._registerToolsProjects.has(cacheKey)) {
            return this._registerToolsProjects.get(cacheKey);
        }
        const lockFile = this.fse.getAbsolutePath("yarn.lock");
        const result = this.fse.isFilePathExist(lockFile);
        this._registerToolsProjects.set(cacheKey, result);
        return result;
    }

    /**
     * 添加安装依赖
     * @param packageName 依赖包名称
     * @param options 安装选项
     * @returns Promise<void> 
     */
    public async add(
        packageName: string,
        options: Partial<{
            dev: boolean;
            tilde: boolean;
            noSave: boolean;
        }> = { dev: true, tilde: false, noSave: false }
    ) {

        const args = options.dev ? ['-D'] : [];

        if (options.noSave) {
            if (this.bin === EPackageMangerTool.PNPM) {
                args.push('--no-save');  // pnpm 使用 --no-save
            } else if (this.bin === EPackageMangerTool.YARN) {
                args.push('--pure-lockfile');
            } else {
                args.push('--no-save');  // npm 也是用 --no-save
            }
        }

        if (options.tilde) {
            if (this.bin === EPackageMangerTool.YARN) {
                // 主要为了锁定版本
                args.push('--tilde');
            } else {
                process.env.npm_config_save_prefix = '~'
            }
        }

        if (this.needsPeerDepsFix) {
            args.push('--legacy-peer-deps')
        }

        return await this.runCommand('add', [packageName, ...args]);
    }


    /**
     * 执行包管理器命令 
     * @param command 包管理器命令
     * @param args 包管理器命令参数
     */
    public async runCommand(command: PackageManagerCommand, args: string[] = []): Promise<boolean> {

        const prevNodeEnv = process.env.NODE_ENV;
        delete process.env.NODE_ENV;

        try {
            await this.setRegistryEnvs();
            const config = this.getPackageManagerConfig(this.bin!);
            const commandArgs = [...config[command], ...args];

            if (this.needsPeerDepsFix) {
                commandArgs.push('--legacy-peer-deps');
            }

            return await this.executeCommand(this.bin!, commandArgs, this.context);
        } finally {
            process.env.NODE_ENV = prevNodeEnv;
        }
    }
}
