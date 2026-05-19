import React from "react";
import { NavLink } from "react-router-dom";
import useCounterStore from "@/stores/counter";
import styles from "./index.module.less";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const count = useCounterStore((s) => s.count);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo}>
          Devkit Example
        </NavLink>
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ""}>
            Home
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => isActive ? styles.active : ""}>
            Users
          </NavLink>
        </nav>
        <div className={styles.counter}>
          全局计数：<span>{count}</span>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
};

export default Layout;
