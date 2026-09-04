## 现状

- 该目录下的大部分ts封装出自（复制）于旧版 ts agent, 不是优雅封装。比如：tool.ts、tool.ts、tool-registry.ts、error.ts、result.ts。
- client.ts 是对于 rust axum 的http restful api的ts类型化封装（fetch+类型）
- process.ts 是进程薄壳
- 以后打算重构