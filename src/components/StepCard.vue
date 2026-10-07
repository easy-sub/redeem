<template>
  <div class="step-card">
    <form class="ui-card card-main" @submit.prevent="validateCard">
      <div class="card-icon-row">
        <div class="card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2.2a2 2 0 0 0 0 3.6V16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-2.2a2 2 0 0 0 0-3.6V8z"></path>
            <path d="m9 12.5 2 2 4-5"></path>
          </svg>
        </div>
        <div>
          <div class="card-title">输入 CDK</div>
          <div class="card-desc">请输入用于兑换 {{ providerLabel }} 订阅的 CDK</div>
        </div>
      </div>

      <div class="input-group">
        <input
          id="cardCode"
          v-model="inputCardCode"
          type="text"
          aria-label="CDK"
          placeholder="请输入您的CDK卡密"
          class="ui-input"
          :class="{ 'has-error': error }"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
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
        :disabled="!inputCardCode.trim() || loading"
      >
        <span v-if="loading" class="ui-spinner"></span>
        {{ loading ? '验证中…' : '校验并继续' }}
      </button>
    </form>

    <template v-if="cardInfo">
      <div class="ui-card ui-list card-info">
        <div class="ui-row">
          <span class="ui-row-label">{{ cardInfo.productType === 'codex_credits' ? 'Credits 商品' : '订阅方案' }}</span>
          <span class="ui-row-value">{{ cardInfo.productName }}</span>
        </div>
        <div v-if="cardInfo.productType === 'codex_credits'" class="ui-row">
          <span class="ui-row-label">充值数量</span>
          <span class="ui-row-value">{{ cardInfo.creditQuantity }} Credits</span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">服务</span>
          <span class="ui-row-value">{{ cardInfo.productAlias }}</span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">CDK 状态</span>
          <span class="ui-row-value" :class="getStatusClass(cardInfo.cardStatus)">{{ cardInfo.cardStatusText }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { Check, Copy } from '@lucide/vue'
import { validateCard } from '../services/api'
import { extractErrorURL } from '../utils/errorUrl'

export default {
  name: 'StepCard',
  components: { Check, Copy },
  emits: ['validated', 'validating'],
  props: {
    provider: {
      type: String,
      default: 'openai'
    },
    cardCode: {
      type: String,
      default: ''
    },
    requestNonce: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      inputCardCode: this.cardCode,
      cardInfo: null,
      error: '',
      loading: false,
      copyErrorStatus: '',
      copyErrorTimer: null
    }
  },
  computed: {
    providerLabel() { return ({ openai: 'ChatGPT', claude: 'Claude', grok: 'Grok' })[this.provider] || 'ChatGPT' },
    copyErrorTitle() {
      if (this.copyErrorStatus === 'success') return '已复制网址'
      if (this.copyErrorStatus === 'error') return '复制失败，请重试'
      return '复制网址'
    },
    errorURL() { return extractErrorURL(this.error) }
  },
  watch: {
    cardCode(val) {
      this.inputCardCode = val
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
    async validateCard() {
      if (this.loading || !this.inputCardCode.trim()) return
      this.$emit('validating')
      this.loading = true
      this.error = ''
      this.resetCopyErrorStatus()
      this.cardInfo = null

      const response = await validateCard(this.inputCardCode, this.provider, this.requestNonce)

      if (response.code === 200) {
        this.cardInfo = response.data
        this.$emit('validated', { cardCode: this.inputCardCode, cardInfo: response.data })
      } else {
        this.error = response.message || 'CDK 校验失败'
      }

      this.loading = false
    },
    getStatusClass(status) {
      switch (status) {
        case 1: return 'status-available'
        case 2: return 'status-used'
        default: return 'status-unavailable'
      }
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
  background: #e6f5ee;
  color: var(--ui-green);
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

.input-group {
  display: flex;
  flex-direction: column;
}

.card-info {
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
