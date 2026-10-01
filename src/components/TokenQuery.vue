<template>
  <div class="token-query">
    <div class="subpage-nav">
      <button type="button" class="subpage-back-button" @click="$emit('back')">
        <ArrowLeft :size="17" aria-hidden="true" />
        <span>返回兑换</span>
      </button>
    </div>

    <section class="token-query-form query-input-card ui-card">
      <div class="token-query-form-head">
        <label for="token-query-input">ChatGPT Token</label>
      </div>
      <textarea
        id="token-query-input"
        v-model="tokenInput"
        class="ui-textarea token-query-textarea"
        :class="{ 'has-error': error }"
        placeholder="粘贴 Token、授权 JSON 或 Bearer Token"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :disabled="loading"
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
      ></textarea>

      <div v-if="error" class="ui-callout is-danger token-query-error">
        <CircleAlert :size="18" aria-hidden="true" />
        <span>{{ error }}</span>
      </div>

      <button type="button" class="btn-filled query-submit-button token-query-submit" :disabled="loading || !tokenInput.trim()" @click="submit">
        <LoaderCircle v-if="loading" class="token-query-spinner" :size="19" aria-hidden="true" />
        <Search v-else :size="19" aria-hidden="true" />
        <span>{{ loading ? '正在查询账号信息' : '开始查询' }}</span>
      </button>
    </section>

    <section v-if="result" class="token-query-result" aria-live="polite">
      <section class="token-overview" :class="statusClass">
        <div class="token-overview-main">
          <div class="token-status-icon" aria-hidden="true">
            <CircleAlert v-if="result.subscription.isDelinquent" :size="28" />
            <CircleX v-else-if="result.subscription.status === 'expired'" :size="28" />
            <CircleCheck v-else :size="28" />
          </div>
          <div class="token-status-copy">
            <span>账号状态</span>
            <strong>{{ result.subscription.statusText }}</strong>
            <small>{{ result.subscription.statusDescription }}</small>
          </div>
          <span class="token-plan-badge">{{ result.subscription.planName }}</span>
        </div>
      </section>

      <div class="token-highlights">
        <article class="token-highlight-card is-plan">
          <div class="token-highlight-icon"><Crown :size="20" aria-hidden="true" /></div>
          <div class="token-highlight-copy">
            <span>当前套餐</span>
            <strong>{{ result.subscription.planName }}</strong>
            <small>{{ planCodeLabel }}</small>
          </div>
        </article>
        <article class="token-highlight-card is-renewal">
          <div class="token-highlight-icon"><RefreshCw :size="20" aria-hidden="true" /></div>
          <div class="token-highlight-copy">
            <span>自动续费</span>
            <strong>{{ result.subscription.willRenew ? '已开启' : '已关闭' }}</strong>
            <small>{{ renewalHint }}</small>
          </div>
        </article>
        <article class="token-highlight-card is-grace" :class="{ 'is-warning': result.subscription.isDelinquent }">
          <div class="token-highlight-icon"><Timer :size="20" aria-hidden="true" /></div>
          <div class="token-highlight-copy">
            <span>宽限期</span>
            <strong>{{ gracePeriodLabel }}</strong>
            <small>{{ gracePeriodHint }}</small>
          </div>
        </article>
      </div>

      <section class="token-renewal-actions" aria-label="自动续费设置">
        <div class="token-renewal-actions-copy">
          <strong>自动续费设置</strong>
          <small>{{ result.subscription.hasActiveSubscription ? '选择需要应用到当前订阅的续费状态' : '当前账号没有可设置的有效订阅' }}</small>
        </div>
        <div class="token-renewal-buttons">
          <button
            type="button"
            class="btn-gray token-renewal-button is-close"
            :disabled="renewalLoading !== null || !result.subscription.hasActiveSubscription || !result.subscription.willRenew"
            @click="setRenewal(false)"
          >
            <LoaderCircle v-if="renewalLoading === false" class="token-query-spinner" :size="18" aria-hidden="true" />
            <CircleX v-else :size="18" aria-hidden="true" />
            <span>{{ renewalLoading === false ? '正在关闭' : '关闭续费' }}</span>
          </button>
          <button
            type="button"
            class="btn-filled token-renewal-button is-open"
            :disabled="renewalLoading !== null || !result.subscription.hasActiveSubscription || result.subscription.willRenew"
            @click="setRenewal(true)"
          >
            <LoaderCircle v-if="renewalLoading === true" class="token-query-spinner" :size="18" aria-hidden="true" />
            <CircleCheck v-else :size="18" aria-hidden="true" />
            <span>{{ renewalLoading === true ? '正在开启' : '开启续费' }}</span>
          </button>
        </div>
      </section>

      <div v-if="renewalMessage" class="ui-callout is-info token-renewal-feedback">
        <CircleCheck :size="18" aria-hidden="true" />
        <span>{{ renewalMessage }}</span>
      </div>
      <div v-if="renewalError" class="ui-callout is-danger token-renewal-feedback">
        <CircleAlert :size="18" aria-hidden="true" />
        <span>{{ renewalError }}</span>
      </div>

      <section class="token-details-panel">
        <div class="token-details-head">
          <div>
            <h3>订阅详情</h3>
          </div>
          <small>账号当前订阅信息</small>
        </div>
        <div class="token-detail-account-row">
          <div class="token-account-icon" aria-hidden="true">
            <UserRound :size="20" />
          </div>
          <div class="token-account-copy">
            <span>当前账号</span>
            <strong>{{ accountEmailLabel }}</strong>
            <small v-if="accountMeta">{{ accountMeta }}</small>
          </div>
          <button type="button" class="token-query-reset" @click="reset">
            <RotateCcw :size="16" aria-hidden="true" />
            <span>重新查询</span>
          </button>
        </div>
        <div class="token-details-grid">
          <article class="token-detail-item">
          <span>订阅开始</span>
          <strong>{{ formatDate(result.subscription.startedAt) }}</strong>
          <small>{{ result.subscription.startedAtEstimated ? '根据计费周期推算' : '当前订阅周期' }}</small>
          </article>
          <article class="token-detail-item">
          <span>到期时间</span>
          <strong>{{ formatDate(result.subscription.expiresAt) }}</strong>
          <small>{{ expirationHint }}</small>
          </article>
          <article class="token-detail-item">
          <span>{{ renewalDateLabel }}</span>
          <strong>{{ renewalDate }}</strong>
          <small>{{ renewalDateHint }}</small>
          </article>
          <article class="token-detail-item">
          <span>计费周期</span>
          <strong>{{ billingPeriodLabel }}</strong>
          <small v-if="result.subscription.currency">币种 {{ result.subscription.currency }}</small>
          </article>
          <article class="token-detail-item">
          <span>购买渠道</span>
          <strong>{{ purchasePlatformLabel }}</strong>
          <small>{{ result.subscription.purchaseOriginPlatform }}</small>
          </article>
          <article class="token-detail-item">
          <span>账户 ID</span>
          <strong class="token-detail-id">{{ result.profile.accountId || '未识别' }}</strong>
          <small>上游账户标识</small>
          </article>
        </div>
      </section>
    </section>
  </div>
</template>

<script>
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  CircleX,
  Crown,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Timer,
  UserRound
} from '@lucide/vue'
import { queryToken, refreshTokenQuery, setTokenAutoRenew } from '../services/api'

export default {
  name: 'TokenQuery',
  components: {
    ArrowLeft,
    CircleAlert,
    CircleCheck,
    CircleX,
    Crown,
    LoaderCircle,
    RefreshCw,
    RotateCcw,
    Search,
    Timer,
    UserRound
  },
  emits: ['back'],
  data() {
    return {
      tokenInput: '',
      loading: false,
      error: '',
      result: null,
      queryTokenValue: '',
      renewalLoading: null,
      renewalMessage: '',
      renewalError: ''
    }
  },
  computed: {
    statusClass() {
      return `is-${this.result?.subscription?.status || 'unknown'}`
    },
    accountEmailLabel() {
      return this.result?.profile?.email || '未识别邮箱'
    },
    accountMeta() {
      return this.result?.profile?.name || ''
    },
    planCodeLabel() {
      const subscription = this.result?.subscription
      if (!subscription) return '未识别套餐代码'
      return subscription.hasActiveSubscription
        ? (subscription.subscriptionPlan || subscription.planType || '未识别套餐代码')
        : (subscription.planType || subscription.subscriptionPlan || '未识别套餐代码')
    },
    billingPeriodLabel() {
      const labels = { monthly: '每月', yearly: '每年', annual: '每年' }
      return labels[this.result?.subscription?.billingPeriod] || '未知'
    },
    purchasePlatformLabel() {
      const labels = {
        chatgpt_web: 'Web / 其他',
        chatgpt_mobile_ios: 'Apple App Store',
        chatgpt_mobile_android: 'Google Play',
        apple: 'Apple App Store',
        apple_app_store: 'Apple App Store',
        google: 'Google Play',
        google_play: 'Google Play'
      }
      const value = this.result?.subscription?.purchaseOriginPlatform
      return labels[value] || value || '未知'
    },
    renewalHint() {
      if (this.result.subscription.isDelinquent) {
        return this.result.subscription.willRenew ? '欠费状态下仍保留续费设置' : '欠费且已关闭自动续费'
      }
      return this.result.subscription.willRenew ? '到期后自动进入下一周期' : '本周期结束后不再扣费'
    },
    renewalDateLabel() {
      if (this.result.subscription.willRenew) return '下次续费'
      return this.result.subscription.cancelsAt ? '取消时间' : '有效期至'
    },
    renewalDateHint() {
      if (this.result.subscription.willRenew) return '预计自动扣费时间'
      return this.result.subscription.cancelsAt ? '当前周期结束后失效' : '当前没有后续续费计划'
    },
    renewalDate() {
      const value = this.result.subscription.willRenew
        ? this.result.subscription.renewsAt
        : this.result.subscription.cancelsAt || this.result.subscription.expiresAt
      return this.formatDate(value)
    },
    gracePeriodLabel() {
      if (!this.result.subscription.isDelinquent) return '不在宽限期'
      return this.formatRemaining(this.result.subscription.gracePeriodEndAt)
    },
    gracePeriodHint() {
      const value = this.result.subscription.gracePeriodEndAt
      return value ? `截止 ${this.formatDate(value)}` : '当前没有宽限期信息'
    },
    expirationHint() {
      if (!this.result.subscription.hasActiveSubscription) return '订阅已结束'
      return this.formatRemaining(this.result.subscription.expiresAt, '剩余 ')
    }
  },
  methods: {
    async submit() {
      if (!this.tokenInput.trim() || this.loading) return
      this.loading = true
      this.error = ''
      const response = await queryToken(this.tokenInput)
      this.loading = false
      if (response.code !== 200) {
        this.result = null
        this.error = response.message || '查询失败'
        return
      }
      this.result = response.data
      this.queryTokenValue = response.data.queryToken
      this.tokenInput = ''
    },
    async setRenewal(enabled) {
      if (this.renewalLoading !== null) return
      this.renewalLoading = enabled
      this.renewalMessage = ''
      this.renewalError = ''
      const response = await setTokenAutoRenew(this.queryTokenValue, enabled)
      if (response.code !== 200) {
        this.renewalLoading = null
        this.renewalError = response.message || '续费设置失败'
        return
      }

      this.queryTokenValue = response.queryToken
      const refreshed = await refreshTokenQuery(this.queryTokenValue)
      this.renewalLoading = null
      this.renewalMessage = enabled ? '自动续费已开启' : '自动续费已关闭'
      if (refreshed.code === 200) {
        this.result = refreshed.data
        this.queryTokenValue = refreshed.data.queryToken
        return
      }

      this.result.subscription.willRenew = enabled
      this.result.subscription.status = enabled ? 'active' : 'canceling'
      this.result.subscription.statusText = enabled ? '订阅正常，将自动续费' : '订阅有效，已关闭自动续费'
      this.result.subscription.statusDescription = enabled
        ? '当前套餐状态正常，下个计费周期将自动续费。'
        : '套餐可使用至当前周期结束，之后不会自动扣费。'
      this.renewalError = `${refreshed.message || '订阅详情刷新失败'}，可重新查询确认最新详情`
    },
    reset() {
      this.result = null
      this.error = ''
      this.tokenInput = ''
      this.queryTokenValue = ''
      this.renewalLoading = null
      this.renewalMessage = ''
      this.renewalError = ''
    },
    formatDate(value) {
      if (!value) return '暂无'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return value
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date).replaceAll('/', '-')
    },
    formatRemaining(value, prefix = '剩 ') {
      if (!value) return '暂无'
      const start = new Date(this.result.serverTime).getTime()
      const end = new Date(value).getTime()
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '已结束'
      const totalHours = Math.floor((end - start) / 3600000)
      const days = Math.floor(totalHours / 24)
      const hours = totalHours % 24
      return `${prefix}${days}天${hours}小时`
    }
  }
}
</script>

<style scoped>
.token-query {
  width: 100%;
}

.token-account-icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid rgba(16, 163, 127, 0.16);
  border-radius: 13px;
  background: #e7f5f0;
  color: #0b8f70;
}

.token-query-form {
  margin-top: 10px;
}

.token-query-form-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}

.token-query-form-head label {
  color: var(--ui-label-secondary);
  font-size: 13px;
  font-weight: 750;
}

.token-query-textarea {
  min-height: 154px;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
}

.token-query-error {
  margin-top: 12px;
}

.token-query-submit {
  width: 100%;
}

.token-query-spinner {
  animation: token-spin 0.9s linear infinite;
}

.token-query-result {
  margin-top: 18px;
}

.token-overview {
  position: relative;
  overflow: hidden;
  padding: 18px;
  border: 1px solid rgba(16, 163, 127, 0.18);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.97);
  color: var(--ui-label);
  box-shadow: 0 14px 34px rgba(39, 72, 57, 0.08);
}

.token-overview::before,
.token-overview::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(16, 163, 127, 0.045);
  pointer-events: none;
}

.token-overview::before {
  width: 220px;
  height: 220px;
  top: -138px;
  right: -38px;
}

.token-overview::after {
  width: 110px;
  height: 110px;
  right: 126px;
  bottom: -76px;
}

.token-overview.is-grace_period,
.token-overview.is-canceling {
  border-color: rgba(217, 138, 34, 0.28);
  background: #fffaf2;
  box-shadow: 0 14px 34px rgba(98, 61, 24, 0.08);
}

.token-overview.is-grace_period {
  padding: 14px 16px;
}

.token-overview.is-grace_period .token-status-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
}

.token-overview.is-grace_period .token-status-copy strong {
  margin-top: 2px;
  font-size: 20px;
}

.token-overview.is-grace_period .token-status-copy small {
  margin-top: 3px;
}

.token-overview.is-expired,
.token-overview.is-delinquent {
  border-color: rgba(220, 76, 69, 0.26);
  background: #fff7f6;
  box-shadow: 0 14px 34px rgba(92, 35, 35, 0.08);
}

.token-overview-main {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16px;
}

.token-status-icon {
  width: 50px;
  height: 50px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid rgba(16, 163, 127, 0.16);
  border-radius: 16px;
  background: #e7f5f0;
  color: #0b8f70;
}

.is-grace_period .token-status-icon,
.is-canceling .token-status-icon {
  border-color: rgba(217, 138, 34, 0.2);
  background: #fff0dc;
  color: #df7c12;
}

.is-expired .token-status-icon,
.is-delinquent .token-status-icon {
  border-color: rgba(220, 76, 69, 0.2);
  background: #ffe9e7;
  color: #d94842;
}

.token-status-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.token-status-copy span {
  color: var(--ui-label-secondary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.token-status-copy strong {
  margin-top: 4px;
  font-size: 21px;
  font-weight: 820;
  line-height: 1.25;
}

.token-status-copy small {
  margin-top: 5px;
  color: var(--ui-label-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.token-plan-badge {
  margin-left: auto;
  padding: 8px 13px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #e7f5f0;
  color: #0b8f70;
  font-size: 13px;
  font-weight: 800;
}

.token-detail-account-row {
  min-width: 0;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--fresh-border);
  background: #fbfefd;
}

.token-account-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.token-account-copy span {
  color: var(--ui-label-secondary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.token-account-copy strong {
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: var(--ui-label);
  font-size: 15px;
}

.token-account-copy small {
  margin-top: 4px;
  color: #0b8f70;
  font-size: 12px;
  font-weight: 700;
}

.token-query-reset {
  min-height: 38px;
  margin-left: auto;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  border: 1px solid var(--fresh-border);
  border-radius: 12px;
  background: #ffffff;
  color: var(--ui-label-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.token-query-reset:hover {
  border-color: rgba(16, 163, 127, 0.26);
  background: #f3fbf8;
  color: #0b8f70;
}

.token-highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.token-renewal-actions {
  margin-top: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid var(--fresh-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 28px rgba(39, 72, 57, 0.065);
}

.token-renewal-actions-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.token-renewal-actions-copy strong {
  color: var(--ui-label);
  font-size: 15px;
}

.token-renewal-actions-copy small {
  margin-top: 4px;
  color: var(--ui-label-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.token-renewal-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(112px, 1fr));
  gap: 10px;
  flex: 0 0 auto;
}

.token-renewal-buttons .token-renewal-button {
  min-height: 34px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font: inherit;
  font-size: 13px;
  font-weight: 750;
}

.token-renewal-button.is-close:not(:disabled) {
  border-color: transparent;
  background: #159875;
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(21, 152, 117, 0.18);
}

.token-renewal-button.is-close:hover:not(:disabled) {
  border-color: transparent;
  background: #0b8f70;
}

.token-renewal-button.is-open:not(:disabled) {
  background: #c95a52;
  box-shadow: 0 8px 18px rgba(201, 90, 82, 0.18);
}

.token-renewal-button.is-open:hover:not(:disabled) {
  background: #b94740;
}

.token-renewal-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.token-renewal-feedback {
  margin-top: 12px;
}

.token-highlight-card {
  min-width: 0;
  min-height: 94px;
  padding: 12px 13px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid var(--fresh-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 28px rgba(39, 72, 57, 0.065);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.token-highlight-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 32px rgba(39, 72, 57, 0.09);
}

.token-highlight-icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 12px;
  background: #f0edff;
  color: #6557d8;
}

.token-highlight-card.is-renewal .token-highlight-icon {
  background: #e7f5f0;
  color: #0b8f70;
}

.token-highlight-card.is-grace .token-highlight-icon {
  background: #edf7f3;
  color: #16916f;
}

.token-highlight-card.is-grace.is-warning {
  border-color: rgba(217, 138, 34, 0.24);
}

.token-highlight-card.is-grace.is-warning .token-highlight-icon {
  background: #fff1df;
  color: #e27d0f;
}

.token-highlight-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.token-highlight-copy > span,
.token-detail-item > span {
  color: var(--ui-label-secondary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.token-highlight-copy strong {
  margin-top: 4px;
  overflow-wrap: anywhere;
  font-size: 16px;
  line-height: 1.35;
}

.token-highlight-copy small {
  margin-top: 3px;
  overflow-wrap: anywhere;
  color: var(--ui-label-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.token-details-panel {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid var(--fresh-border);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 32px rgba(39, 72, 57, 0.065);
}

.token-details-head {
  min-height: 74px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--fresh-border);
}

.token-details-head h3 {
  margin: 0;
  color: var(--ui-green);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
}

.token-details-head > small {
  color: var(--ui-label-secondary);
  font-size: 12px;
}

.token-details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.token-detail-item {
  min-width: 0;
  min-height: 106px;
  padding: 17px 20px;
  display: flex;
  justify-content: center;
  flex-direction: column;
  border-bottom: 1px solid var(--fresh-border);
}

.token-detail-item:nth-child(odd) {
  border-right: 1px solid var(--fresh-border);
}

.token-detail-item:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.token-detail-item strong {
  margin-top: 7px;
  overflow-wrap: anywhere;
  font-size: 16px;
  line-height: 1.35;
}

.token-detail-item small {
  min-height: 17px;
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: var(--ui-label-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.token-detail-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px !important;
}

@keyframes token-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
  .token-highlight-card {
    padding: 12px 13px;
  }
}

@media (max-width: 600px) {
  .token-query-form {
    padding: 16px;
  }

  .token-query-textarea {
    min-height: 128px;
  }

  .token-overview {
    padding: 18px;
    border-radius: 18px;
  }

  .token-overview-main {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .token-status-icon {
    width: 48px;
    height: 48px;
    border-radius: 16px;
  }

  .token-status-copy {
    flex: 1;
  }

  .token-status-copy strong {
    font-size: 19px;
  }

  .token-plan-badge {
    margin-left: 64px;
  }

  .token-detail-account-row {
    padding: 14px 16px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .token-account-copy {
    flex: 1;
  }

  .token-query-reset {
    width: 100%;
    min-height: 42px;
    margin-left: 54px;
    justify-content: center;
  }

  .token-highlights {
    grid-template-columns: 1fr;
  }

  .token-renewal-actions {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .token-renewal-buttons {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .token-renewal-button {
    min-width: 0;
    padding: 0 8px;
  }

  .token-highlight-card {
    min-height: 0;
  }

  .token-details-head {
    min-height: 68px;
    padding: 15px 16px;
  }

  .token-details-head > small {
    display: none;
  }

  .token-details-grid {
    grid-template-columns: 1fr;
  }

  .token-detail-item {
    min-height: 96px;
    padding: 15px 16px;
    border-right: 0 !important;
    border-bottom: 1px solid var(--fresh-border) !important;
  }

  .token-detail-item:last-child {
    border-bottom: 0 !important;
  }
}
</style>
