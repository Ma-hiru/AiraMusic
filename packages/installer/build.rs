use std::env;

fn main() {
    windows_reactor_setup::as_framework_dependent();

    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        winresource::WindowsResource::new()
            .set_icon("assets/deployer.ico")
            .compile()
            .expect("failed to compile Windows resources");
    }

    println!("cargo:rerun-if-changed=assets/deployer.ico");
}
