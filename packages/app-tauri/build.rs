fn main() {
    // 自定义命令需要在 ACL 里显式声明，否则远程来源（127.0.0.1 的页面）
    // 调用会得到 `aira_invoke not allowed. Plugin not found`。
    // 这里生成 allow-/deny- 前缀的权限，capabilities/default.json 再引用它们。
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "aira_invoke",
            "aira_store",
            "aira_event",
            "aira_message_send",
            "aira_net_fetch",
            "aira_fs_select",
            "aira_fs_save",
            "aira_log_export",
        ]),
    ))
    .expect("failed to run tauri-build");
}
