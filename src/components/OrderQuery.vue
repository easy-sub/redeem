<template>
  <div class="order-query">
    <div v-if="!embedded" class="query-nav">
      <button @click="goBack" class="btn-plain query-back-button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>返回兑换</span>
      </button>
    </div>

    <div class="ui-card card-main">
      <div class="card-icon-row">
        <div class="card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </div>
        <div>
          <div class="card-title">{{ modeTitle }}</div>
          <div class="card-desc">{{ modeDesc }}</div>
        </div>
      </div>

      <div class="input-group">
        <textarea
          id="cardCodes"
          v-model="cardCodesText"
          aria-label="CDK"
          class="ui-textarea"
          :class="{ 'has-error': error }"
          rows="5"
          placeholder="每行一个 CDK，最多 50 个"
          @keydown.ctrl.enter.prevent="submit"
          @keydown.meta.enter.prevent="submit"
        ></textarea>
        <div class="input-meta">
          <span>已识别 {{ parsedCardCodes.length }} 个</span>
          <button v-if="cardCodesText" type="button" @click="reset" class="link-button">清空</button>
        </div>
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
        @click="submit"
        class="btn-filled"
        :disabled="!parsedCardCodes.length || loading"
      >
        <span v-if="loading" class="ui-spinner"></span>
        {{ loading ? loadingText : actionText }}
      </button>
    </div>

    <template v-if="hasQueryResult">
      <div class="ui-card query-summary">
        <div class="summary-stats">
          <div class="summary-stat">
            <span>输入 CDK</span>
            <strong>{{ queryTotal }}</strong>
          </div>
          <div class="summary-stat">
            <span>找到订单</span>
            <strong>{{ orderCount }}</strong>
          </div>
          <div class="summary-stat">
            <span>未找到有效订单</span>
            <strong>{{ unmatchedCount }}</strong>
          </div>
        </div>
      </div>

      <section v-if="unmatchedCardCodes.length" class="ui-card unmatched-card">
        <div class="unmatched-head">
          <div>
            <div class="unmatched-title">未找到有效订单的 CDK</div>
            <div class="unmatched-subtitle">共 {{ unmatchedCount }} 个</div>
          </div>
          <button type="button" class="btn-tinted unmatched-copy-button" @click="copyUnmatchedCardCodes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>{{ unmatchedCopied ? '已复制' : '复制 CDK' }}</span>
          </button>
        </div>

        <div class="unmatched-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>未找到有效订单可能是订单尚未创建，或原订单失败后 CDK 已释放，不代表该 CDK 一定可以兑换。</span>
        </div>

        <pre class="unmatched-list">{{ unmatchedCardCodes.join('\n') }}</pre>
      </section>

      <div v-if="queryResults.length" class="result-list">
        <div
          v-for="(item, index) in queryResults"
          :key="`${item.cardCode}-${index}`"
          class="ui-card result-card"
        >
          <div class="result-head">
            <span class="result-code">{{ item.cardCode }}</span>
            <span class="ui-row-value" :class="getStatusClass(item.status)">
              {{ getStatusText(item.status) }}
            </span>
          </div>

          <div class="result-grid">
            <div>
              <span>订单编号</span>
              <strong>{{ item.orderId }}</strong>
            </div>
            <div>
              <span>订阅方案</span>
              <strong>{{ item.productName }}</strong>
            </div>
            <div>
              <span>目标账号</span>
              <strong>{{ item.email }}</strong>
            </div>
            <div>
              <span>CDK 状态</span>
              <strong>{{ item.cardStatusText }}</strong>
            </div>
            <div v-if="item.paymentCard">
              <span>支付卡</span>
              <strong>{{ item.paymentCard }}</strong>
            </div>
            <div>
              <span>创建时间</span>
              <strong>{{ formatTime(item.createTime) }}</strong>
            </div>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<script>
import { queryOrdersByCards } from '../services/api'
import {
  ORDER_STATUS,
  getOrderStatusClass,
  getOrderStatusText
} from '../constants/orderStatus'

const MAX_CARD_CODES = 50
const normalizeCardCodeForMatch = (code) => String(code || '').trim().toLowerCase()

export default {
  name: 'OrderQuery',
  props: {
    embedded: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      cardCodesText: '',
      queryResults: [],
      submittedCardCodes: [],
      loading: false,
      error: '',
      queryCompleted: false,
      unmatchedCopied: false,
      copyResetTimer: null
    }
  },
  computed: {
    parsedCardCodes() {
      return this.cardCodesText
        .split(/[\s,，;；]+/)
        .map((code) => code.trim())
        .filter(Boolean)
    },
    modeTitle() {
      return '查询订阅订单'
    },
    modeDesc() {
      return '输入一个或多个 CDK，查询已产生的订阅订单'
    },
    actionText() {
      return '查询订单'
    },
    loadingText() {
      return '查询中...'
    },
    queryTotal() {
      return this.submittedCardCodes.length
    },
    orderCount() {
      return this.queryResults.length
    },
    unmatchedCardCodes() {
      const orderCardCodes = new Set(
        this.queryResults
          .map((item) => normalizeCardCodeForMatch(item?.cardCode))
          .filter(Boolean)
      )
      return this.submittedCardCodes.filter((code) => !orderCardCodes.has(normalizeCardCodeForMatch(code)))
    },
    unmatchedCount() {
      return this.unmatchedCardCodes.length
    },
    hasQueryResult() {
      return this.queryCompleted
    }
  },
  beforeUnmount() {
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer)
    }
  },
  methods: {
    validateInput() {
      const cardCodes = this.parsedCardCodes

      if (!cardCodes.length) {
        this.error = '请输入 CDK'
        return null
      }

      if (cardCodes.length > MAX_CARD_CODES) {
        this.error = `单次最多处理 ${MAX_CARD_CODES} 个 CDK`
        return null
      }

      const duplicated = cardCodes.find((code, index) => cardCodes.indexOf(code) !== index)
      if (duplicated) {
        this.error = `存在重复 CDK：${duplicated}`
        return null
      }

      return cardCodes
    },
    async submit() {
      const cardCodes = this.validateInput()
      if (!cardCodes) return

      this.loading = true
      this.error = ''
      this.queryResults = []
      this.submittedCardCodes = cardCodes
      this.queryCompleted = false
      this.resetCopyState()

      const response = await queryOrdersByCards(cardCodes)

      if (response.code === 200) {
        this.queryResults = (Array.isArray(response.data) ? response.data : [])
          .filter((item) => item.status !== ORDER_STATUS.CARD_RETURNED)
        this.queryCompleted = true
      } else {
        this.error = response.message || '查询失败'
      }

      this.loading = false
    },
    async copyUnmatchedCardCodes() {
      const content = this.unmatchedCardCodes.join('\n')
      if (!content) return

      try {
        await navigator.clipboard.writeText(content)
        this.resetCopyState()
        this.unmatchedCopied = true
        this.copyResetTimer = setTimeout(() => {
          this.unmatchedCopied = false
          this.copyResetTimer = null
        }, 1600)
      } catch {
        this.error = '复制失败，请手动复制未找到有效订单的 CDK'
      }
    },
    resetCopyState() {
      if (this.copyResetTimer) {
        clearTimeout(this.copyResetTimer)
        this.copyResetTimer = null
      }
      this.unmatchedCopied = false
    },
    getStatusClass(status) {
      return getOrderStatusClass(status)
    },
    getStatusText(status) {
      return getOrderStatusText(status)
    },
    formatTime(timeStr) {
      if (!timeStr) return ''
      try {
        const date = new Date(timeStr)
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      } catch {
        return timeStr
      }
    },
    reset() {
      this.cardCodesText = ''
      this.queryResults = []
      this.submittedCardCodes = []
      this.error = ''
      this.queryCompleted = false
      this.resetCopyState()
    },
    goBack() {
      this.$emit('back')
    }
  }
}
</script>

<style scoped>
.query-nav {
  display: flex;
  margin: 0 0 10px;
}

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

.input-group {
  display: flex;
  flex-direction: column;
}

.input-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--ui-label-secondary);
}

.link-button {
  border: none;
  background: transparent;
  color: var(--ui-blue);
  font: inherit;
  cursor: pointer;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.query-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  margin-top: 12px;
  margin-bottom: 10px;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  flex: 1;
}

.summary-stat {
  min-width: 0;
}

.summary-stat span {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--ui-label-secondary);
}

.summary-stat strong {
  display: block;
  font-size: 20px;
  line-height: 1.1;
}

.result-card {
  padding: 13px 14px;
  animation: fadeIn 0.35s ease;
}

.result-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.result-code {
  min-width: 0;
  margin-right: 12px;
  font-size: 15px;
  font-weight: 700;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.result-head .ui-row-value {
  flex-shrink: 0;
  white-space: nowrap;
}

.result-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  margin-top: 10px;
}

.result-grid div {
  min-width: 0;
}

.result-grid span {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--ui-label-secondary);
}

.result-grid strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}

.unmatched-card {
  margin-bottom: 10px;
  padding: 14px;
}

.unmatched-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.unmatched-title {
  font-size: 16px;
  font-weight: 700;
}

.unmatched-subtitle {
  margin-top: 3px;
  color: var(--ui-label-secondary);
  font-size: 12px;
}

.unmatched-copy-button {
  min-width: 102px;
  flex-shrink: 0;
  border-radius: 8px;
}

.unmatched-copy-button svg {
  width: 16px;
  height: 16px;
}

.unmatched-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(217, 138, 34, 0.1);
  color: #8a5816;
  font-size: 13px;
  line-height: 1.5;
}

.unmatched-notice svg {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  flex-shrink: 0;
}

.unmatched-list {
  max-height: 220px;
  margin: 12px 0 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--ui-separator);
  border-radius: 8px;
  background: var(--ui-fill);
  color: var(--ui-label);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.copy-button,
.download-button {
  border-radius: 12px;
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
  .order-query {
    margin-top: -8px;
  }

  .query-nav {
    margin: 0 0 2px -6px;
  }

  .card-main {
    margin-top: 8px;
    padding: 14px 12px;
    gap: 14px;
  }

  .card-icon-row {
    align-items: flex-start;
    gap: 10px;
  }

  .card-icon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
  }

  .card-title {
    font-size: 17px;
  }

  .card-desc {
    font-size: 13px;
    line-height: 1.45;
  }

  .input-meta {
    font-size: 12px;
  }

  .result-grid {
    grid-template-columns: 1fr;
  }

  .query-summary {
    align-items: stretch;
    flex-direction: column;
    padding: 12px;
  }

  .summary-stats {
    gap: 10px;
  }

  .summary-stat strong {
    font-size: 18px;
  }

  .unmatched-card {
    padding: 12px;
  }

  .unmatched-head {
    align-items: stretch;
    flex-direction: column;
  }

  .unmatched-copy-button {
    width: 100%;
  }

  .unmatched-notice {
    padding: 9px 10px;
    font-size: 12px;
  }

  .unmatched-list {
    max-height: 200px;
    font-size: 12px;
  }

  .result-card {
    padding: 12px;
  }

  .result-head {
    gap: 8px;
  }

  .result-code {
    margin-right: 8px;
    font-size: 14px;
    line-height: 1.35;
  }

  .result-head .ui-row-value {
    font-size: 13px;
    line-height: 1.35;
  }

}
</style>
