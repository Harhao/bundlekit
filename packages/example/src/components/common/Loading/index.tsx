import React from "react";
import styles from "./index.module.less";

interface LoadingProps {
  text?: string;
}

const Loading: React.FC<LoadingProps> = ({ text = "加载中..." }) => (
  <div className={styles.wrap}>
    <div className={styles.spinner} />
    <span>{text}</span>
  </div>
);

export default Loading;
