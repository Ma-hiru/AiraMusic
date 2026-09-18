use crate::context::budget::{estimate_request, input_budget, summary_limit};
use crate::context::compactor::{LLMCompactor, LLMCompactorPlugin};
use crate::context::messages::{message_groups, validate_messages};
use crate::context::models::{Checkpoint, ContextPolicy, HistoryMessage};
use crate::context::observation::reduce_tools;
use crate::ctx::Ctx;
use crate::llm::models::{ChatMessage, ChatRequest, ChatRole, LLMAdapter};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::models::SessionId;
use crate::session::{SessionManager, SessionPlugin};
use std::sync::Arc;

pub struct LLMContextPlugin;
impl PluginMeta<LLMContextManager> for LLMContextPlugin {
    fn name() -> &'static str {
        "llm-context"
    }
    fn service_name() -> &'static str {
        "llm-context-manager"
    }
}
impl Plugin<ContextPolicy, LLMContextManager> for LLMContextPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![
            LLMCompactorPlugin::service_name(),
            SessionPlugin::service_name(),
        ]
    }
    fn apply(
        &self,
        ctx: &Arc<Ctx>,
        policy: ContextPolicy,
    ) -> anyhow::Result<PluginApplyResult<LLMContextManager>> {
        Ok(PluginApplyResult {
            service: Some(LLMContextManager::new(
                SessionPlugin::get_service(ctx)?,
                LLMCompactorPlugin::get_service(ctx)?,
                policy,
            )?),
            emit_disposers: None,
        })
    }
}

pub struct PreparedContext {
    session_id: SessionId,
    pub request: ChatRequest,
    checkpoint: Option<Checkpoint>,
    source_len: usize,
    prior: Option<Checkpoint>,
}

pub struct LLMContextManager {
    sessions: Arc<SessionManager>,
    compactor: Arc<LLMCompactor>,
    policy: ContextPolicy,
}

impl LLMContextManager {
    pub fn new(
        sessions: Arc<SessionManager>,
        compactor: Arc<LLMCompactor>,
        policy: ContextPolicy,
    ) -> anyhow::Result<Self> {
        anyhow::ensure!(
            policy.trigger_ratio > 0.0 && policy.trigger_ratio <= 1.0,
            "triggerRatio 必须在 (0, 1] 内"
        );
        anyhow::ensure!(
            policy.recent_token_budget > 0
                && policy.summary_output_tokens > 0
                && policy.max_summary_passes > 0,
            "上下文预算和摘要批次上限必须大于零"
        );
        anyhow::ensure!(
            policy.tool_output_tokens >= 128 && policy.stale_tool_output_tokens >= 128,
            "工具结果预算必须至少为 128 tokens，以保留原文读取位置"
        );
        Ok(Self {
            sessions,
            compactor,
            policy,
        })
    }

    /// Supplies messages from the authoritative session snapshot; caller supplies system/tools/config.
    /// No checkpoint is installed until commit validates the request after mutable hooks.
    pub async fn prepare(
        &self,
        session_id: &SessionId,
        mut request: ChatRequest,
        llm: &dyn LLMAdapter,
        force: bool,
    ) -> anyhow::Result<PreparedContext> {
        request.cancel.throw_if_aborted()?;
        let snapshot = self.sessions.context_snapshot(session_id)?;
        snapshot.validate()?;
        let prior = snapshot.checkpoint.clone();
        let through = prior
            .as_ref()
            .map_or(0, |checkpoint| checkpoint.through_seq);
        let all: Vec<HistoryMessage> = snapshot
            .messages
            .iter()
            .enumerate()
            .filter(|(_, message)| message.role != ChatRole::Inner)
            .map(|(index, message)| HistoryMessage {
                seq: index as u64 + 1,
                message: message.clone(),
            })
            .collect();
        // Corruption must never disappear into a checkpoint.
        validate_messages(
            &all.iter()
                .map(|record| record.message.clone())
                .collect::<Vec<_>>(),
        )?;
        let mut active: Vec<_> = all
            .iter()
            .filter(|record| record.seq > through)
            .cloned()
            .collect();
        let groups = message_groups(
            &active
                .iter()
                .map(|record| record.message.clone())
                .collect::<Vec<_>>(),
        )?;
        let latest_user = all
            .iter()
            .rfind(|record| record.message.role == ChatRole::User);
        let last_tool_group = groups
            .iter()
            .rfind(|group| !active[group.start].message.tool_calls.is_empty())
            .filter(|group| latest_user.is_none_or(|user| active[group.start].seq > user.seq))
            .map(|group| group.start);
        let protected_start =
            last_tool_group.unwrap_or_else(|| groups.last().map_or(0, |group| group.start));
        let context: usize = request.config.context_size.into();
        let fresh = self.policy.tool_output_tokens.min((context / 16).max(128));
        reduce_tools(&mut active, protected_start, fresh, fresh);
        Self::assemble(&mut request, prior.as_ref(), &active, latest_user);
        let budget = input_budget(&request.config, &self.policy)?;
        let trigger = (budget as f64 * self.policy.trigger_ratio) as usize;
        if !force && estimate_request(&request).total() < trigger {
            return Ok(PreparedContext {
                session_id: session_id.clone(),
                request,
                checkpoint: None,
                source_len: snapshot.messages.len(),
                prior,
            });
        }
        active = all
            .iter()
            .filter(|record| record.seq > through)
            .cloned()
            .collect();
        reduce_tools(
            &mut active,
            protected_start,
            fresh,
            self.policy.stale_tool_output_tokens.min(fresh),
        );
        Self::assemble(&mut request, prior.as_ref(), &active, latest_user);
        let original_tokens = estimate_request(&request).total();
        if !force && original_tokens < trigger {
            return Ok(PreparedContext {
                session_id: session_id.clone(),
                request,
                checkpoint: None,
                source_len: snapshot.messages.len(),
                prior,
            });
        }
        let fallback = request.clone();
        let draft = async {
            let mut fixed = request.clone();
            fixed.messages.clear();
            let mut minimal = fixed.clone();
            if let Some(user) = latest_user.filter(|user| {
                active
                    .get(protected_start)
                    .is_some_and(|record| user.seq < record.seq)
            }) {
                minimal.messages.push(user.message.clone());
            }
            minimal.messages.extend(
                active[protected_start..]
                    .iter()
                    .map(|record| record.message.clone()),
            );
            anyhow::ensure!(
                estimate_request(&minimal).total() <= budget,
                "固定提示词、工具定义或最新任务/工具结果已经超出预算，历史摘要无法释放足够空间"
            );
            let anchor_tokens = latest_user.map_or(0, |user| user.message.token_count());
            let tail_budget = budget
                .saturating_sub(estimate_request(&fixed).total())
                .saturating_sub(summary_limit(&request.config, &self.policy))
                .saturating_sub(anchor_tokens)
                .saturating_sub(128)
                .min(budget / 2)
                .min(self.policy.recent_token_budget);
            let target = if force { tail_budget / 2 } else { tail_budget };
            let mut keep_start = active.len();
            let mut kept = 0;
            for group in groups.iter().rev() {
                let tokens: usize = active[group.clone()]
                    .iter()
                    .map(|record| record.message.token_count())
                    .sum();
                if kept > 0 && kept + tokens > target && group.start < protected_start {
                    break;
                }
                kept += tokens;
                keep_start = group.start;
            }
            // Prefer a whole user turn. Long turns may checkpoint completed tool steps.
            if let Some(user_start) = (0..keep_start)
                .rev()
                .find(|&index| active[index].message.role == ChatRole::User)
            {
                let turn_tokens: usize = active[user_start..]
                    .iter()
                    .map(|record| record.message.token_count())
                    .sum();
                if turn_tokens <= target {
                    keep_start = user_start;
                }
            }
            if force && keep_start == 0 {
                keep_start = active
                    .iter()
                    .rposition(|record| record.message.role == ChatRole::User)
                    .filter(|index| *index > 0)
                    .unwrap_or(protected_start);
            }
            anyhow::ensure!(
                keep_start > 0 && keep_start < active.len(),
                "没有可压缩的完整旧历史；最新输入或固定提示词超出预算"
            );
            let old = &active[..keep_start];
            let summary = self
                .compactor
                .summarize(
                    llm,
                    request.config.clone(),
                    prior.as_ref().map(|checkpoint| checkpoint.summary.as_str()),
                    old,
                    &self.policy,
                    request.cancel.clone(),
                )
                .await?;
            let checkpoint = Checkpoint {
                through_seq: old.last().unwrap().seq,
                summary,
            };
            Self::assemble(
                &mut request,
                Some(&checkpoint),
                &active[keep_start..],
                latest_user,
            );
            self.validate_request(&request)?;
            anyhow::ensure!(
                estimate_request(&request).total() < original_tokens,
                "压缩没有释放上下文空间"
            );
            Ok::<_, anyhow::Error>(checkpoint)
        }
        .await;
        request.cancel.throw_if_aborted()?;
        match draft {
            Ok(checkpoint) => {
                tracing::info!(session = %session_id, through = checkpoint.through_seq, before_tokens = original_tokens,
                    after_tokens = estimate_request(&request).total(), "上下文检查点已准备");
                Ok(PreparedContext {
                    session_id: session_id.clone(),
                    request,
                    checkpoint: Some(checkpoint),
                    source_len: snapshot.messages.len(),
                    prior,
                })
            }
            Err(error) if !force && original_tokens <= budget => {
                tracing::warn!(session = %session_id, error = %error, "压缩失败，保留仍在预算内的原上下文");
                Ok(PreparedContext {
                    session_id: session_id.clone(),
                    request: fallback,
                    checkpoint: None,
                    source_len: snapshot.messages.len(),
                    prior,
                })
            }
            Err(error) => Err(error),
        }
    }

    fn assemble(
        request: &mut ChatRequest,
        checkpoint: Option<&Checkpoint>,
        tail: &[HistoryMessage],
        latest_user: Option<&HistoryMessage>,
    ) {
        request.messages.clear();
        if let Some(checkpoint) = checkpoint {
            request.messages.push(ChatMessage::assistant(format!(
                "[历史检查点，覆盖原始消息 1..={}；以下是历史摘要]\n{}",
                checkpoint.through_seq, checkpoint.summary
            )));
            if let Some(user) = latest_user.filter(|user| user.seq <= checkpoint.through_seq) {
                request.messages.push(user.message.clone());
            }
        }
        request
            .messages
            .extend(tail.iter().map(|record| record.message.clone()));
    }

    pub fn validate_request(&self, request: &ChatRequest) -> anyhow::Result<()> {
        validate_messages(&request.messages)?;
        let budget = input_budget(&request.config, &self.policy)?;
        let usage = estimate_request(request);
        anyhow::ensure!(
            usage.total() <= budget,
            "上下文超出安全输入预算: {} > {} (system={}, tools={}, messages={})",
            usage.total(),
            budget,
            usage.system,
            usage.tools,
            usage.messages
        );
        Ok(())
    }

    pub fn tool_output_limit(&self, config: &crate::llm::models::LLMConfig) -> usize {
        let context: usize = config.context_size.into();
        self.policy.tool_output_tokens.min((context / 16).max(128))
    }

    pub async fn commit(
        &self,
        session_id: &SessionId,
        prepared: &PreparedContext,
        final_request: &ChatRequest,
    ) -> anyhow::Result<()> {
        anyhow::ensure!(&prepared.session_id == session_id, "检查点属于其他会话");
        final_request.cancel.throw_if_aborted()?;
        self.validate_request(final_request)?;
        self.sessions.ensure_context_revision(
            session_id,
            prepared.source_len,
            prepared.prior.as_ref(),
        )?;
        if let Some(checkpoint) = &prepared.checkpoint {
            self.sessions
                .commit_checkpoint(
                    session_id,
                    prepared.source_len,
                    prepared.prior.as_ref(),
                    checkpoint.clone(),
                )
                .await?;
        }
        Ok(())
    }
}
