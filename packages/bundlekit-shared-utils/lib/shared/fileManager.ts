import fse from 'fs-extra';
import { resolve } from 'node:path';

// 文件操作类
export class FileManager {

    // 命令执行地址路径
    private context: string;

    constructor(context?: string) {
        this.context = context || process.cwd();
    }

    /**
     * 切换命令执行地址路径
     * @param context string 命令执行地址路径
     * returns boolean 是否切换成功
     * @throws Error 路径不存在时抛出错误
     */
    public changeContext(context: string) {
        let isExistPath = this.isFilePathExist(context);
        if (isExistPath) {
            this.context = context;
            return;
        }
        throw new Error(`file path ${context} does not exist`);
    }

    /**
     * 返回文件对决路径
     * @param filePath string 文件相对路径
     * @returns string 文件绝对路径
     */
    public getAbsolutePath(filePath: string) {
        return resolve(this.context, filePath);
    }

    /**
     * 读取文件内容
     * @param filePath 文件相对路径
     * @returns string 文件内容
     */
    public readFileContent(filePath: string) {
        let absoluteFilePath = this.getAbsolutePath(filePath);
        return fse.readFileSync(absoluteFilePath, 'utf-8');
    }

    /**
     * 写入文件内容
     * @param filePath string 文件相对路径
     * @param content string ｜ object 文件内容
    */
    public writeFileContent(filePath: string, content: string | object) {
        let absoluteFilePath = this.getAbsolutePath(filePath);
        const contentToWrite = typeof content === 'object' ? JSON.stringify(content) : content;
        fse.writeFileSync(absoluteFilePath, contentToWrite);
    }

    /**
     * 判断文件或者目录是否存在
     * @param filePath string 文件相对路径
     * @returns boolean 是否存在
     */
    public isFilePathExist(filePath: string) {
        let absoluteFilePath = this.getAbsolutePath(filePath);
        return fse.pathExistsSync(absoluteFilePath);
    }

    /**
     * 创建文件目录
     * @param filePath string 文件相对路径
     * @returns void 不存在则创建目录
     */
    public createDirectory(filePath: string) {
        let absoluteFilePath = this.getAbsolutePath(filePath);
        fse.ensureDirSync(absoluteFilePath);
    }

    /**
     * 创建文件目录和文件
     * @param filePath string 文件相对路径
     * @param content string ｜ object 文件内容
     * @returns void 不存在则创建文件目录，存在则写入文件内容
     */
    public createFile(filePath: string, content?: string | object) {
        let absoluteFilePath = this.getAbsolutePath(filePath);
        const dirPath = resolve(absoluteFilePath, '..');
        fse.ensureDirSync(dirPath);
        fse.ensureFileSync(absoluteFilePath);
        if (content) {
            this.writeFileContent(filePath, content);
        }
    }

    /**
     * 拷贝文件
     * @param sourcePath string 源文件相对路径
     * @param destinationPath  string 目标文件相对路径
     * @param options fse.CopyOptionsSync | undefined 复制配置选项
     */
    public copyFile(sourcePath: string, destinationPath: string, options?: fse.CopyOptionsSync | undefined) {
        let sourceAbsolutePath = this.getAbsolutePath(sourcePath);
        let destinationAbsolutePath = this.getAbsolutePath(destinationPath);
        let realOptions = options || {};
        fse.copySync(sourceAbsolutePath, destinationAbsolutePath,realOptions);
    }

    /**
     * 移除文件
     * @param filePath string 文件相对路径
     * @returns void 不存在则创建文件目录，存在则写入文件内容
     */
    public removeFile(filePath: string) {
        let absoluteFilePath = this.getAbsolutePath(filePath);
        fse.removeSync(absoluteFilePath);
    }

    /**
     * 读取json文件内容
     * 注意：此方法会将文件内容解析为json对象
     * @param filePath string 文件相对路径
     * @returns string json 文件内容
     */
    public readJsonFile(filePath: string) {
        let absoluteFilePath = this.getAbsolutePath(filePath);
        return fse.readJsonSync(absoluteFilePath);
    }

    /**
     * 写入json文件内容
     * @param filePath string 文件相对路径
     * @param content json 文件内容
     * @returns void 不存在则创建文件目录，存在则写入文件内容
     * 注意：此方法会将文件内容解析为json对象
     */
    public writeJsonFile(filePath: string, content: object) {
        let absoluteFilePath = this.getAbsolutePath(filePath);
        // 确保目录和文件存在
        const dirPath = resolve(absoluteFilePath, '..');
        fse.ensureDirSync(dirPath);
        fse.ensureFileSync(absoluteFilePath);
        fse.writeJsonSync(absoluteFilePath, content);
    }
}