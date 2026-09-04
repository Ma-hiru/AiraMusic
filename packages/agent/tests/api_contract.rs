use agent::agui::models::{AguiEvent, AguiReasoningRole};
use agent::server::models::{AgentReady, AgentServiceStatus, HealthResponse, ThreadSummary};
use serde_json::json;
use ts_rs::TS;

#[test]
fn run_started_uses_the_canonical_agui_wire_shape() {
    let event = AguiEvent::RunStarted {
        session_id: "thread-1".to_string(),
        run_id: "run-1".to_string(),
    };

    assert_eq!(
        serde_json::to_value(event).unwrap(),
        json!({
            "type": "RUN_STARTED",
            "threadId": "thread-1",
            "runId": "run-1"
        })
    );
}

#[test]
fn tool_call_start_uses_agui_tool_call_field_names() {
    let event = AguiEvent::ToolCallStart {
        session_id: "thread-1".to_string(),
        run_id: "run-1".to_string(),
        tool_call_id: "call-1".to_string(),
        tool_call_name: "search".to_string(),
    };

    assert_eq!(
        serde_json::to_value(event).unwrap(),
        json!({
            "type": "TOOL_CALL_START",
            "threadId": "thread-1",
            "runId": "run-1",
            "toolCallId": "call-1",
            "toolCallName": "search"
        })
    );
}

#[test]
fn tool_call_result_includes_a_message_identity() {
    let event = AguiEvent::ToolCallResult {
        session_id: "thread-1".to_string(),
        run_id: "run-1".to_string(),
        message_id: "tool-result-call-1".to_string(),
        tool_call_id: "call-1".to_string(),
        content: "result".to_string(),
    };

    assert_eq!(
        serde_json::to_value(event).unwrap(),
        json!({
            "type": "TOOL_CALL_RESULT",
            "threadId": "thread-1",
            "runId": "run-1",
            "messageId": "tool-result-call-1",
            "toolCallId": "call-1",
            "content": "result"
        })
    );
}

#[test]
fn reasoning_message_start_includes_the_canonical_role() {
    let event = AguiEvent::ReasoningMessageStart {
        session_id: "thread-1".to_string(),
        run_id: "run-1".to_string(),
        message_id: "reasoning-1".to_string(),
        role: AguiReasoningRole::Reasoning,
    };

    assert_eq!(
        serde_json::to_value(event).unwrap(),
        json!({
            "type": "REASONING_MESSAGE_START",
            "threadId": "thread-1",
            "runId": "run-1",
            "messageId": "reasoning-1",
            "role": "reasoning"
        })
    );
}

#[test]
fn service_dtos_serialize_and_generate_camel_case_types() {
    let health = HealthResponse {
        status: AgentServiceStatus::Ready,
        protocol_version: 1,
    };
    let thread = ThreadSummary {
        id: "thread-1".to_string(),
        name: "New conversation".to_string(),
        created_at: 10,
        updated_at: 20,
    };

    assert_eq!(
        serde_json::to_value(health).unwrap(),
        json!({ "status": "ready", "protocolVersion": 1 })
    );
    assert_eq!(
        serde_json::to_value(thread).unwrap(),
        json!({
            "id": "thread-1",
            "name": "New conversation",
            "createdAt": 10,
            "updatedAt": 20
        })
    );

    let declaration = HealthResponse::decl(&ts_rs::Config::default());
    assert!(declaration.contains("protocolVersion: number"));
    assert!(!declaration.contains("protocol_version"));
}

#[test]
fn readiness_record_is_a_single_machine_readable_contract() {
    let ready = AgentReady {
        event_type: "ready".to_string(),
        port: 43_127,
        protocol_version: 1,
    };

    assert_eq!(
        serde_json::to_string(&ready).unwrap(),
        r#"{"type":"ready","port":43127,"protocolVersion":1}"#
    );
}
