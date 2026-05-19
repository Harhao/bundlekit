import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import useRequest from "@/hooks/useRequest";
import Loading from "@/components/common/Loading";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { getUserById } from "@/api/user";
import { getPostsByUser } from "@/api/post";
import { truncate } from "@/utils/format";
import type { Post } from "@/api/types";
import styles from "./index.module.less";

const PostsContent: React.FC<{ userId: number }> = ({ userId }) => {
  const { data: user, loading: uLoading, error: uError } = useRequest(
    () => getUserById(userId),
    [userId]
  );
  const { data: posts, loading: pLoading, error: pError } = useRequest(
    () => getPostsByUser(userId),
    [userId]
  );

  if (uLoading || pLoading) return <Loading />;
  if (uError) return <div style={{ color: "#ff4d4f" }}>用户加载失败：{uError.message}</div>;
  if (pError) return <div style={{ color: "#ff4d4f" }}>文章加载失败：{pError.message}</div>;

  const postList: Post[] = Array.isArray(posts) ? posts : [];

  return (
    <>
      {user && (
        <div className={styles.userCard}>
          <img
            src={(user as any).avatar}
            alt={(user as any).name}
            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${(user as any).name}`; }}
          />
          <div className={styles.meta}>
            <h2>{(user as any).name}</h2>
            <p>{(user as any).email} · {(user as any).role}</p>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h3>文章列表（{postList.length} 篇）</h3>
        {postList.length === 0 ? (
          <div className={styles.empty}>该用户暂无文章</div>
        ) : (
          <div className={styles.postList}>
            {postList.map((p) => (
              <div key={p.id} className={styles.postItem}>
                <h4>{p.title}</h4>
                <p>{truncate(p.body, 100)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

const Posts: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = Number(id);

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate("/users")}>
        ← 返回用户列表
      </button>
      <ErrorBoundary>
        <PostsContent userId={userId} />
      </ErrorBoundary>
    </div>
  );
};

export default Posts;
