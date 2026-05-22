import ora from 'ora';
import chalk from 'chalk';
import type { Ora } from 'ora';

/**
 * 控制台加载动画工具类
 * 封装了ora库的功能，提供更易用的API
 */
export class Spinner {

    // 是否处于暂停状态
    private isPaused: boolean = false;
    // ora实例
    private spinner: Ora = ora();
    // 最后一条消息记录，用于恢复显示
    private lastMsg: { symbol: string; text: string} | null = null;

    /**
     * 显示带加载动画的消息
     * @param symbol - 消息前的符号，默认使用绿色对勾
     * @param msg - 要显示的消息文本
     */
    public logWithSpinner(symbol: string, msg?: string) {
        if (!msg) {
            msg = symbol;
            symbol = chalk.green('✔');
        }
        if (this.lastMsg) {
            this.spinner?.stopAndPersist({
                symbol: this.lastMsg.symbol,
                text: msg
            });
        }
        this.spinner!!.text = " " + msg;
        this.lastMsg = {
            symbol: symbol + " ",
            text: msg
        };
        this.spinner?.start();
    }

    /**
     * 停止加载动画
     * @param persist - 是否保留最后显示的消息
     */
    public stopSpinner(persist: boolean) {
        if (!this.spinner.isSpinning) {
            return;
        }
        if (this.lastMsg && persist !== false) {
            this.spinner.stopAndPersist({
                symbol: this.lastMsg.symbol,
                text: this.lastMsg.text
            });
        } else {
            this.spinner.stop();
        }
        this.lastMsg = null;
    }

    /**
     * 暂停加载动画
     * 可以稍后通过resumeSpinner恢复
     */
    public pauseSpinner() {
        if (this.spinner.isSpinning) {
            this.spinner.stop();
            this.isPaused = true;
        }
    }

    /**
     * 恢复被暂停的加载动画
     */
    public resumeSpinner() {
        if (this.isPaused) {
            this.spinner.start();
            this.isPaused = false;
        }
    }

    /**
     * 显示失败状态的加载动画
     * @param msg - 失败消息文本
     */
    public failSpinner(msg: string) {
        this.spinner.fail(msg);
    }
}