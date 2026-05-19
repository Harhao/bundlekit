import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Loading from "@/components/common/Loading";

const Home = lazy(() => import("@/pages/Home"));
const Users = lazy(() => import("@/pages/Users"));
const Posts = lazy(() => import("@/pages/Posts"));

const App: React.FC = () => (
  <BrowserRouter>
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/users" element={<Users />} />
          <Route path="/posts/:id" element={<Posts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  </BrowserRouter>
);

export default App;
