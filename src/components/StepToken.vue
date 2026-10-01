<template>
  <div class="step-token">
    <div class="ui-card card-main">
      <div class="card-icon-row">
        <div class="card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="8" r="4"></circle>
            <path d="M3 21v-1a6 6 0 0 1 6-6h1"></path>
            <path d="m15 18 2 2 4-5"></path>
            <path d="M16 11.5h5"></path>
          </svg>
        </div>
        <div>
          <div class="card-title">{{ isClaude ? '输入 Claude sessionKey' : '输入会话数据' }}</div>
          <div class="card-desc">{{ isClaude ? '粘贴 Claude 账号的 sessionKey' : '粘贴 ChatGPT 账号的 session JSON' }}</div>
        </div>
      </div>

      <div class="ui-callout is-info token-guide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <div>
          <div class="ui-callout-title">{{ isClaude ? '如何获取 sessionKey？' : '如何获取 Token 数据？' }}</div>
          <ol v-if="!isClaude" class="guide-steps">
            <li>打开 <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">chatgpt.com</a> 登录需兑换的 ChatGPT 账号</li>
            <li>访问 <a href="https://chatgpt.com/api/auth/session" target="_blank" rel="noopener noreferrer">chatgpt.com/api/auth/session</a>，复制页面中的全部 JSON 数据</li>
          </ol>
          <ol v-else class="guide-steps">
            <li>打开 <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">claude.ai</a> 登录需兑换的 Claude 账号</li>
            <li>在浏览器开发者工具的 Cookie 中复制 <span class="inline-code">sessionKey</span> 的值</li>
          </ol>
        </div>
      </div>

      <div class="input-group">
        <textarea
          id="token"
          v-model="token"
          :aria-label="isClaude ? 'Claude sessionKey' : 'Session JSON'"
          :placeholder="tokenPlaceholder"
          class="ui-textarea"
          :class="{ 'has-error': error }"
          rows="4"
        ></textarea>
        <div v-if="error" class="ui-error-text">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ error }}</span>
        </div>
      </div>

      <button
        @click="validateToken"
        class="btn-filled"
        :disabled="!token.trim() || loading"
      >
        <span v-if="loading" class="ui-spinner"></span>
        {{ loading ? '验证中…' : '校验并继续' }}
      </button>
    </div>

    <template v-if="tokenInfo">
      <div class="ui-card ui-list token-info">
        <div class="ui-row">
          <span class="ui-row-label">{{ isClaude ? '账号邮箱' : '邮箱' }}</span>
          <span class="ui-row-value">{{ tokenInfo.email }}</span>
        </div>
        <div v-if="isClaude && tokenInfo.accountName" class="ui-row">
          <span class="ui-row-label">个人组织</span>
          <span class="ui-row-value">{{ tokenInfo.accountName }}</span>
        </div>
        <div v-if="!isClaude" class="ui-row">
          <span class="ui-row-label">昵称</span>
          <span class="ui-row-value">{{ tokenInfo.name }}</span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">账号类型</span>
          <span class="ui-row-value">{{ formatAccountType(tokenInfo.accountType) }}</span>
        </div>
        <div v-if="tokenInfo.subscriptionPlan" class="ui-row">
          <span class="ui-row-label">订阅方案</span>
          <span class="ui-row-value">{{ formatSubscriptionPlan(tokenInfo.subscriptionPlan) }}</span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">订阅状态</span>
          <span class="ui-row-value">{{ formatSubscriptionStatus(tokenInfo) }}</span>
        </div>
        <div v-if="!isClaude" class="ui-row">
          <span class="ui-row-label">支付渠道</span>
          <span class="ui-row-value">{{ formatPaymentChannel(tokenInfo.purchaseOriginPlatform) }}</span>
        </div>
        <div v-if="tokenInfo.billingPeriod" class="ui-row">
          <span class="ui-row-label">计费周期</span>
          <span class="ui-row-value">{{ formatBillingPeriod(tokenInfo.billingPeriod) }}</span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">到期时间</span>
          <span class="ui-row-value">{{ formatExpiresAt(tokenInfo.expiresAt) }}</span>
        </div>
        <div v-if="tokenInfo.renewsAt" class="ui-row">
          <span class="ui-row-label">续费时间</span>
          <span class="ui-row-value">{{ formatExpiresAt(tokenInfo.renewsAt) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { validateToken } from '../services/api'

export default {
  name: 'StepToken',
  props: {
    provider: {
      type: String,
      default: 'openai'
    },
    cardCode: {
      type: String,
      default: ''
    },
    cardInfo: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      token: '',
      tokenInfo: null,
      error: '',
      loading: false
    }
  },
  computed: {
    isClaude() {
      return String(this.provider || '').toLowerCase() === 'claude'
    },
    tokenPlaceholder() {
      return this.isClaude ? '粘贴 Claude sessionKey' : '例如：{"user":{"email":"test@example.com"}}'
    }
  },
  methods: {
    async validateToken() {
      this.loading = true
      this.error = ''
      this.tokenInfo = null

      try {
        const response = await validateToken(
          this.token,
          this.provider,
          this.cardCode,
          this.cardInfo && this.cardInfo.activationToken
        )

        if (response.code === 200) {
          this.tokenInfo = response.data
          this.$emit('validated', { token: response.data.redeemToken, tokenInfo: response.data })
        } else {
          this.tokenInfo = response.data || null
          this.error = response.message || '账号校验失败，请重新提交'
        }
      } catch {
        this.error = '账号校验失败，请重新提交'
      } finally {
        this.loading = false
      }
    },
    formatAccountType(type) {
      const types = {
        'free': 'Free',
        'go': 'Go',
        'prolite': 'Pro Lite',
        'pro': 'Pro',
        'promax': 'Pro 50x',
        'plus': 'Plus',
        'team': 'Team',
        'self_serve_business_usage_based': 'Business Usage',
        'enterprise': '企业版',
        'claude': 'Claude',
        'unknown': '未知'
      }
      return types[type] || type
    },
    formatSubscriptionPlan(plan) {
      const plans = {
        'chatgptfreeplan': 'ChatGPT Free',
        'chatgptfreeworkspaceplan': 'ChatGPT Free Workspace',
        'chatgptgoplan': 'ChatGPT Go',
        'chatgpt2pro20x': 'ChatGPT Pro 20x',
        'chatgptplusplan': 'ChatGPT Plus',
        'chatgptprolite': 'ChatGPT Pro Lite',
        'chatgptproliteplan': 'ChatGPT Pro Lite',
        'chatgptpro': 'ChatGPT Pro',
        'chatgptpromax': 'ChatGPT Pro 50x',
        'chatgptproplan': 'ChatGPT Pro',
        'chatgptteamplan': 'ChatGPT Team',
        'chatgptbusinessplan': 'ChatGPT Team',
        'chatgptenterpriseplan': 'ChatGPT Enterprise'
      }
      const normalized = String(plan || '').trim().toLowerCase()
      return plans[normalized] || plan || '-'
    },
    formatSubscriptionStatus(info) {
      if (!info) return '-'
      if (info.cancelsAt) return '已取消续费'
      if (info.hasActiveSubscription) return '当前有效'
      return '无当前有效订阅'
    },
    formatPaymentChannel(value) {
      const raw = String(value || '').trim()
      if (!raw) return '-'
      const normalized = raw.toLowerCase()
      const channels = {
        'chatgpt_mobile_ios': 'iOS',
        'mobile_ios': 'iOS',
        'ios': 'iOS',
        'chatgpt_web': 'Web',
        'web': 'Web',
        'chatgpt_mobile_android': 'Android',
        'mobile_android': 'Android',
        'android': 'Android'
      }
      if (channels[normalized]) return channels[normalized]
      if (normalized.includes('ios')) return 'iOS'
      if (normalized.includes('android')) return 'Android'
      if (normalized.includes('web')) return 'Web'
      return raw
    },
    formatBillingPeriod(value) {
      const periods = {
        monthly: '月付',
        yearly: '年付',
        annual: '年付'
      }
      const normalized = String(value || '').trim().toLowerCase()
      return periods[normalized] || value || '-'
    },
    formatExpiresAt(value) {
      if (!value) return '-'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return '-'
      const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value
        return acc
      }, {})
      return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
    }
  }
}
</script>

<style scoped>
.card-main {
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-icon-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #eef5ff;
  color: var(--ui-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon svg {
  width: 20px;
  height: 20px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
}

.card-desc {
  margin-top: 2px;
  font-size: 14px;
  color: var(--ui-label-secondary);
}

.guide-steps {
  margin: 4px 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.guide-steps a {
  color: #12665c;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
}

.guide-steps a:hover {
  color: #0a4f48;
}

.inline-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.95em;
  color: var(--ui-label);
}

.guide-steps a:active {
  opacity: 0.5;
}

.input-group {
  display: flex;
  flex-direction: column;
}

.token-info {
  margin-top: 12px;
  animation: fadeIn 0.35s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 600px) {
  .card-main {
    padding: 16px 14px;
  }
}
</style>
