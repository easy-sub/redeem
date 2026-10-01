<template>
  <div class="step-card">
    <div class="ui-card card-main">
      <div class="card-icon-row">
        <div class="card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2.2a2 2 0 0 0 0 3.6V16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-2.2a2 2 0 0 0 0-3.6V8z"></path>
            <path d="m9 12.5 2 2 4-5"></path>
          </svg>
        </div>
        <div>
          <div class="card-title">输入 CDK</div>
          <div class="card-desc">请输入用于兑换订阅的 CDK</div>
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
          @keyup.enter="validateCard"
        />
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
        @click="validateCard"
        class="btn-filled"
        :disabled="!inputCardCode.trim() || loading"
      >
        <span v-if="loading" class="ui-spinner"></span>
        {{ loading ? '验证中…' : '校验并继续' }}
      </button>
    </div>

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
import { validateCard } from '../services/api'

export default {
  name: 'StepCard',
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
      loading: false
    }
  },
  watch: {
    cardCode(val) {
      this.inputCardCode = val
    }
  },
  methods: {
    async validateCard() {
      this.$emit('validating')
      this.loading = true
      this.error = ''
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
