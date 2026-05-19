import React from "react";
import { Link } from "react-router-dom";
import useCounterStore from "@/stores/counter";
import styles from "./index.module.less";

const Home: React.FC = () => {
  const { count, inc, dec, reset } = useCounterStore();

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>Devkit Example App</h1>
        <p>全面覆盖核心特性的集成测试示例：路由 / 状态管理 / API / CSS Modules / Less</p>

        <div className={styles.counter}>
          <button className={`${styles.btn} ${styles.danger}`} onClick={dec}>−</button>
          <span className={styles.value}>{count}</span>
          <button className={styles.btn} onClick={inc}>+</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className={`${styles.btn} ${styles.reset}`} onClick={reset}>重置</button>
        </div>
      </div>

      <div className={styles.nav}>
        <Link to="/users">查看用户列表</Link>
        <Link to="/posts/1">查看文章详情</Link>
      </div>

      <div className={styles.info}>
        <div className={styles.card}>
          <h3>Zustand</h3>
          <p>全局计数器跨页面同步</p>
        </div>
        <div className={styles.card}>
          <h3>CSS Modules</h3>
          <p>Less 变量 + 作用域样式</p>
        </div>
        <div className={styles.card}>
          <h3>React Router v6</h3>
          <p>客户端路由导航</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
