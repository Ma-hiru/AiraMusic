use agent::llm::models::{ChatTurnUsage, ChatUsage};
use serde_json::json;

#[test]
fn old_usage_records_keep_missing_details_and_request_coverage_unknown() {
    let source = json!({
        "records": [{"step": 1, "usage": {"prompt_tokens": 120, "completion_tokens": 30}}]
    });
    let usage: ChatTurnUsage = serde_json::from_value(source.clone()).unwrap();
    assert_eq!(serde_json::to_value(usage).unwrap(), source);
}

#[test]
fn explicit_zero_details_are_preserved_without_inventing_missing_details() {
    let source = json!({
        "prompt_tokens": 120,
        "completion_tokens": 30,
        "cached_tokens": 0,
        "reasoning_tokens": 0
    });
    let usage: ChatUsage = serde_json::from_value(source.clone()).unwrap();
    assert_eq!(usage.cached_tokens, Some(0));
    assert_eq!(usage.reasoning_tokens, Some(0));
    assert_eq!(usage.cache_write_tokens, None);
    assert_eq!(usage.total_tokens, None);
    assert_eq!(serde_json::to_value(usage).unwrap(), source);
}

#[test]
fn request_coverage_is_independent_from_reported_usage() {
    let mut usage = ChatTurnUsage::tracked();
    usage.request_started(1);
    usage.add((
        1,
        ChatUsage {
            prompt_tokens: 120,
            completion_tokens: 30,
            ..ChatUsage::default()
        },
    ));
    usage.request_started(2);
    let value = serde_json::to_value(usage).unwrap();
    assert_eq!(value["requests"], 2);
    assert_eq!(value["last_step"], 2);
    assert_eq!(value["records"].as_array().unwrap().len(), 1);
}
