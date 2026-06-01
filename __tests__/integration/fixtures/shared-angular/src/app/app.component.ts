import { Component } from "@angular/core";

/**
 * Test fixture App。所有 angular 集成测试都引用这个组件。
 * 渲染输出会包含 __SSR_MARKER__，作为断言锚点。
 */
@Component({
    selector: "app-root",
    standalone: true,
    template: `<h1>__SSR_MARKER__ Hello DevKit Angular</h1>`,
})
export class AppComponent {}
