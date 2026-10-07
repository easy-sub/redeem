<template>
  <div class="step-token">
    <form class="ui-card card-main" @submit.prevent="validateToken">
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
          <div class="card-title">{{ isGrok ? '输入 Grok SSO' : isClaude ? '输入 Claude sessionKey' : '输入会话数据' }}</div>
          <div class="card-desc">{{ isGrok ? '粘贴 Grok 账号的 SSO Cookie' : isClaude ? '粘贴 Claude 账号的 sessionKey' : '粘贴 ChatGPT 账号的 session JSON' }}</div>
        </div>
      </div>

      <div class="ui-callout is-info token-guide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <div>
          <div class="ui-callout-title">{{ isGrok ? '如何获取 Grok SSO？' : isClaude ? '如何获取 sessionKey？' : '如何获取 Token 数据？' }}</div>
          <ol v-if="isGrok" class="guide-steps">
            <li>打开 <a href="https://grok.com" target="_blank" rel="noopener noreferrer">grok.com</a> 登录需兑换的 Grok 账号</li>
            <li>在浏览器开发者工具的 Cookie 中复制 <span class="inline-code">sso</span> 的值，也支持 Cookie JSON 或 sso=TOKEN</li>
          </ol>
          <ol v-else-if="!isClaude" class="guide-steps">
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
          :aria-label="isGrok ? 'Grok SSO' : isClaude ? 'Claude sessionKey' : 'Session JSON'"
          :placeholder="tokenPlaceholder"
          class="ui-textarea"
          :class="{ 'has-error': error }"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          rows="4"
        ></textarea>
        <div v-if="error" class="ui-error-text">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ error }}</span>
          <button v-if="errorURL" type="button" class="copy-error-button" :title="copyErrorTitle" :aria-label="copyErrorTitle" @click="copyErrorURL">
            <Check v-if="copyErrorStatus === 'success'" :size="15" aria-hidden="true" />
            <Copy v-else :size="15" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="submit"
        class="btn-filled"
        :disabled="!token.trim() || loading"
      >
        <span v-if="loading" class="ui-spinner"></span>
        {{ loading ? '验证中…' : '校验并继续' }}
      </button>
    </form>

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
import { Check, Copy } from '@lucide/vue'
import { validateToken } from '../services/api'
import { extractErrorURL } from '../utils/errorUrl'

export default {
  name: 'StepToken',
  emits: ['validated', 'card-verified'],
  components: { Check, Copy },
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
    },
    requestNonce: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      token: '',
      tokenInfo: null,
      error: '',
      loading: false,
      copyErrorStatus: '',
      copyErrorTimer: null
    }
  },
  computed: {
    isGrok() { return this.provider === 'grok' },
    isClaude() {
      return String(this.provider || '').toLowerCase() === 'claude'
    },
    tokenPlaceholder() {
      return this.isGrok ? '粘贴 Grok sso Cookie 的值、sso=TOKEN 或 Cookie JSON' : this.isClaude ? '粘贴 Claude sessionKey' : '粘贴完整的 Session JSON 内容…'
    },
    copyErrorTitle() {
      if (this.copyErrorStatus === 'success') return '已复制网址'
      if (this.copyErrorStatus === 'error') return '复制失败，请重试'
      return '复制网址'
    },
    errorURL() {
      return extractErrorURL(this.error)
    }
  },
  beforeUnmount() {
    this.resetCopyErrorStatus()
  },
  methods: {
    async copyErrorURL() {
      if (!this.errorURL) return
      try {
        await navigator.clipboard.writeText(this.errorURL)
        this.copyErrorStatus = 'success'
        clearTimeout(this.copyErrorTimer)
        this.copyErrorTimer = setTimeout(() => { this.copyErrorStatus = '' }, 1600)
      } catch {
        this.copyErrorStatus = 'error'
      }
    },
    resetCopyErrorStatus() {
      if (this.copyErrorTimer) clearTimeout(this.copyErrorTimer)
      this.copyErrorTimer = null
      this.copyErrorStatus = ''
    },
    async validateToken() {
      if (this.loading || !this.token.trim()) return
      this.loading = true
      this.error = ''
      this.resetCopyErrorStatus()
      this.tokenInfo = null

      try {
        const response = await validateToken(
          this.token,
          this.provider,
          this.cardCode,
          this.cardInfo && this.cardInfo.activationToken,
          this.requestNonce,
          (cardInfo) => this.$emit('card-verified', cardInfo)
        )

        if (response.code === 200) {
          this.tokenInfo = response.data
          this.$emit('validated', { token: response.data.redeemToken, tokenInfo: response.data })
        } else {
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
        'prolite': 'Pro 100',
        'pro': 'Pro 200',
        'promax': 'Pro 500',
        'plus': 'Plus',
        'team': 'Team',
        'self_serve_business_usage_based': 'Business Usage',
        'enterprise': '企业版',
        'claude': 'Claude',
        'unknown': '未知',
        'PRODUCT_TIER_SUPER_GROK_LITE': 'SuperGrok Lite',
        'PRODUCT_TIER_GROK_PRO': 'SuperGrok',
        'PRODUCT_TIER_SUPER_GROK_PLUS': 'SuperGrok Plus',
        'PRODUCT_TIER_SUPER_GROK_PRO': 'SuperGrok Heavy',

      }
      return types[type] || type
    },
    formatSubscriptionPlan(plan) {
      const plans = {
        'chatgptfreeplan': 'ChatGPT Free',
        'product_tier_super_grok_lite': 'SuperGrok Lite',
        'product_tier_grok_pro': 'SuperGrok',
        'product_tier_super_grok_plus': 'SuperGrok Plus',
        'product_tier_super_grok_pro': 'SuperGrok Heavy',

        'chatgptfreeworkspaceplan': 'ChatGPT Free Workspace',
        'chatgptgoplan': 'ChatGPT Go',
        'chatgpt2pro20x': 'ChatGPT Pro 200',
        'chatgptplusplan': 'ChatGPT Plus',
        'chatgptprolite': 'ChatGPT Pro 100',
        'chatgptproliteplan': 'ChatGPT Pro 100',
        'chatgptpro': 'ChatGPT Pro 200',
        'chatgptpromax': 'ChatGPT Pro 500',
        'chatgptproplan': 'ChatGPT Pro 200',
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
  color: #165dff;
  text-decoration: none;
  font-weight: 500;
  word-break: break-all;
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
