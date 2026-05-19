import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useRequest from "@/hooks/useRequest";
import useDebounce from "@/hooks/useDebounce";
import Loading from "@/components/common/Loading";
import { getUsers } from "@/api/user";
import type { User } from "@/api/types";
import styles from "./index.module.less";

const PAGE_SIZE = 5;

const Users: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword, 300);

  const { data, loading, error } = useRequest(
    () => getUsers({ page, pageSize: PAGE_SIZE, keyword: debouncedKeyword }),
    [page, debouncedKeyword]
  );

  const users: User[] = (data as any)?.list ?? (Array.isArray(data) ? data : []);
  const total: number = (data as any)?.total ?? users.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <input
          placeholder="搜索用户姓名..."
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
        />
        <span className={styles.total}>共 {total} 位用户</span>
      </div>

      {loading && <Loading />}
      {error && <div className={styles.error}>加载失败：{error.message}</div>}

      {!loading && !error && (
        <>
          <div className={styles.list}>
            {users.map((u) => (
              <div key={u.id} className={styles.row} onClick={() => navigate(`/posts/${u.id}`)}>
                <img
                  className={styles.avatar}
                  src={u.avatar}
                  alt={u.name}
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${u.name}`; }}
                />
                <div className={styles.info}>
                  <div className={styles.name}>{u.name}</div>
                  <div className={styles.email}>{u.email}</div>
                </div>
                <span className={`${styles.role} ${u.role === "admin" ? styles.admin : u.role === "editor" ? styles.editor : ""}`}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.pagination}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
            <span className={styles.pageInfo}>{page} / {totalPages || 1}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</button>
          </div>
        </>
      )}
    </div>
  );
};

export default Users;
