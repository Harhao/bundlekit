import React, { useState } from "react";

/**
 * Test fixture App。所有集成测试用例都引用这个组件。
 * SSR 渲染输出会包含 __SSR_MARKER__，作为断言锚点。
 */
const App: React.FC = () => {
    const [count, setCount] = useState(0);
    return (
        <div id="app-root" data-testid="app">
            <h1 data-testid="title">__SSR_MARKER__ Hello DevKit</h1>
            <button data-testid="counter" onClick={() => setCount(count + 1)}>
                count: {count}
            </button>
        </div>
    );
};

export default App;
