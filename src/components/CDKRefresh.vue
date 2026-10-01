<template>
  <div class="cdk-refresh">
    <transition name="refresh-toast">
      <div v-if="refreshDisabledToastVisible" class="refresh-disabled-toast" role="alert" aria-live="assertive">
        <CircleAlert :size="20" aria-hidden="true" />
        <span>{{ refreshDisabledMessage }}</span>
        <button type="button" aria-label="关闭提示" @click="hideRefreshDisabledToast">
          <X :size="17" aria-hidden="true" />
        </button>
      </div>
    </transition>

    <div class="ui-card card-main">
      <div class="card-icon-row">
        <div class="card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 7h-9"></path>
            <path d="m16 3 4 4-4 4"></path>
            <path d="M4 17h9"></path>
            <path d="m8 21-4-4 4-4"></path>
          </svg>
        </div>
        <div>
          <div class="card-title">批量调换 CDK</div>
          <div class="card-desc">每行一个 CDK，单次最多调换 50 个</div>
        </div>
      </div>

      <div class="input-group">
        <textarea
          id="refreshCardCodes"
          v-model="cardCodesText"
          aria-label="待调换 CDK"
          class="ui-textarea"
          :class="{ 'has-error': error }"
          :disabled="loading"
          rows="5"
          placeholder="每行一个 CDK，最多 50 个"
          @keydown.ctrl.enter.prevent="submit"
          @keydown.meta.enter.prevent="submit"
        ></textarea>
        <div class="input-meta">
          <span>已识别 {{ parsedCardCodes.length }} 个</span>
          <button v-if="cardCodesText" type="button" class="link-button" :disabled="loading" @click="reset">清空</button>
        </div>
      </div>

      <label class="confirm-row">
        <input v-model="confirmed" type="checkbox" :disabled="loading" />
        <span>我已知晓：调换成功后，原 CDK 将立即失效且不可恢复。</span>
      </label>

      <div v-if="error" class="ui-error-text">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{{ error }}</span>
      </div>

      <button class="btn-filled" :disabled="!parsedCardCodes.length || !confirmed || loading" @click="submit">
        <span v-if="loading" class="ui-spinner"></span>
        {{ loading ? '调换中...' : '确认调换' }}
      </button>
    </div>

    <template v-if="queryCompleted">
      <div class="ui-card refresh-summary">
        <div class="summary-stat">
          <span>输入 CDK</span>
          <strong>{{ submittedCardCodes.length }}</strong>
        </div>
        <div class="summary-stat success-stat">
          <span>调换成功</span>
          <strong>{{ successResults.length }}</strong>
        </div>
        <div class="summary-stat failed-stat">
          <span>未调换成功</span>
          <strong>{{ failedResults.length }}</strong>
        </div>
      </div>

      <section v-if="successResults.length" class="result-section">
        <div class="section-head">
          <div>
            <div class="section-title">调换成功</div>
            <div class="section-desc">请及时复制并妥善保存新 CDK</div>
          </div>
          <button type="button" class="btn-tinted copy-all-button" @click="copyAllNewCDKs">
            {{ copiedAll ? '已复制' : '复制全部新 CDK' }}
          </button>
        </div>

        <div class="result-list">
          <article v-for="(item, index) in successResults" :key="`${item.oldCDK}-${index}`" class="ui-card result-card success-card">
            <div class="status-line">
              <span class="success-badge">调换成功</span>
              <span>{{ item.productName || item.plan || '订阅方案' }}</span>
            </div>
            <div class="code-pair">
              <div>
                <span>原 CDK（已失效）</span>
                <code>{{ item.oldCDK }}</code>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M5 12h14"></path>
                <path d="m13 6 6 6-6 6"></path>
              </svg>
              <div class="new-code-row">
                <span>新 CDK</span>
                <code>{{ item.newCDK }}</code>
                <button type="button" class="link-button" @click="copySingle(item.newCDK)">
                  {{ copiedCode === item.newCDK ? '已复制' : '复制' }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-if="failedResults.length" class="ui-card failed-card">
        <div class="section-head">
          <div>
            <div class="section-title">未调换成功</div>
            <div class="section-desc">CDK 不存在或不可调换</div>
          </div>
          <button type="button" class="btn-tinted copy-failed-button" @click="copyFailedCDKs">
            {{ copiedFailed ? '已复制' : '复制失败 CDK' }}
          </button>
        </div>
        <pre>{{ failedResults.map((item) => item.oldCDK).join('\n') }}</pre>
      </section>
    </template>
  </div>
</template>

<script>
import { CircleAlert, X } from '@lucide/vue'
import { refreshCards } from '../services/api'

const MAX_CARD_CODES = 50
const REFRESH_STATE_STORAGE_KEY = 'redeem.client.cdk-refresh-state'
const CDK_REFRESH_DISABLED_MESSAGE = '调换功能已关闭，如有问题请联系客服'

const readPersistedRefreshState = () => {
  if (typeof window === 'undefined') return null
  try {
    const value = JSON.parse(window.sessionStorage.getItem(REFRESH_STATE_STORAGE_KEY) || 'null')
    const cardCodes = Array.isArray(value?.cardCodes)
      ? value.cardCodes.map((code) => String(code || '').trim()).filter(Boolean).slice(0, MAX_CARD_CODES)
      : []
    const idempotencyKey = String(value?.idempotencyKey || '').trim()
    if (!cardCodes.length || !idempotencyKey) return null
    const completed = value.status === 'completed' && Array.isArray(value.results)
    return {
      cardCodes,
      idempotencyKey,
      status: completed ? 'completed' : 'pending',
      results: completed ? value.results : []
    }
  } catch {
    return null
  }
}

const writePersistedRefreshState = (value) => {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(REFRESH_STATE_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 浏览器禁用本地存储时，当前页面内的幂等重试仍然可用。
  }
}

const clearPersistedRefreshState = () => {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(REFRESH_STATE_STORAGE_KEY)
  } catch {
    // 忽略本地存储不可用，避免影响当前页面操作。
  }
}

const createUUID = () => {
  const cryptoAPI = typeof globalThis !== 'undefined' ? globalThis.crypto : null
  if (typeof cryptoAPI?.randomUUID === 'function') {
    return cryptoAPI.randomUUID()
  }
  if (typeof cryptoAPI?.getRandomValues !== 'function') return ''
  const bytes = new Uint8Array(16)
  cryptoAPI.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export default {
  name: 'CDKRefresh',
  components: {
    CircleAlert,
    X
  },
  data() {
    const persistedState = readPersistedRefreshState()
    const completed = persistedState?.status === 'completed'
    return {
      cardCodesText: persistedState?.cardCodes.join('\n') || '',
      submittedCardCodes: persistedState?.cardCodes || [],
      results: completed ? persistedState.results : [],
      confirmed: Boolean(persistedState),
      loading: false,
      error: '',
      queryCompleted: Boolean(completed),
      idempotencyKey: persistedState?.idempotencyKey || '',
      resumePending: persistedState?.status === 'pending',
      copiedAll: false,
      copiedFailed: false,
      copiedCode: '',
      copyResetTimer: null,
      refreshDisabledToastVisible: false,
      refreshDisabledToastTimer: null,
      refreshDisabledMessage: CDK_REFRESH_DISABLED_MESSAGE
    }
  },
  computed: {
    parsedCardCodes() {
      return this.cardCodesText
        .split(/[\s,，;；]+/)
        .map((code) => code.trim())
        .filter(Boolean)
    },
    successResults() {
      return this.results.filter((item) => item.code === 200 && item.newCDK)
    },
    failedResults() {
      return this.results.filter((item) => item.code !== 200 || !item.newCDK)
    },
    refreshDisabled() {
      return this.failedResults.some((item) => item.error === CDK_REFRESH_DISABLED_MESSAGE)
    }
  },
  watch: {
    cardCodesText() {
      if (this.loading) return
      this.results = []
      this.submittedCardCodes = []
      this.queryCompleted = false
      this.idempotencyKey = ''
      this.resumePending = false
      this.error = ''
      clearPersistedRefreshState()
      this.resetCopyState()
      this.hideRefreshDisabledToast()
    }
  },
  mounted() {
    if (this.refreshDisabled) this.showRefreshDisabledToast()
    if (!this.resumePending) return
    this.resumePending = false
    this.error = '检测到上次未完成的调换，请再次点击“确认调换”恢复结果'
  },
  beforeUnmount() {
    this.resetCopyState()
    this.hideRefreshDisabledToast()
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
      const seen = new Set()
      for (const code of cardCodes) {
        const normalized = code.toLowerCase()
        if (seen.has(normalized)) {
          this.error = `存在重复 CDK：${code}`
          return null
        }
        seen.add(normalized)
      }
      if (!this.confirmed) {
        this.error = '请先确认旧 CDK 调换后将立即失效'
        return null
      }
      return cardCodes
    },
    async submit() {
      const cardCodes = this.validateInput()
      if (!cardCodes || this.loading) return

      this.loading = true
      this.error = ''
      this.results = []
      this.submittedCardCodes = cardCodes
      this.queryCompleted = false
      this.resetCopyState()
      this.hideRefreshDisabledToast()
      if (!this.idempotencyKey) {
        this.idempotencyKey = createUUID()
        if (!this.idempotencyKey) {
          this.error = '当前浏览器缺少部分能力，请升级浏览器后重试'
          this.loading = false
          return
        }
      }

      writePersistedRefreshState({
        status: 'pending',
        cardCodes,
        idempotencyKey: this.idempotencyKey,
        updatedAt: new Date().toISOString()
      })

      const response = await refreshCards(cardCodes, this.idempotencyKey)
      if (response.code === 200) {
        this.results = Array.isArray(response.data?.results) ? response.data.results : []
        this.queryCompleted = true
        if (this.refreshDisabled) this.showRefreshDisabledToast()
        writePersistedRefreshState({
          status: 'completed',
          cardCodes,
          idempotencyKey: this.idempotencyKey,
          results: this.results,
          updatedAt: new Date().toISOString()
        })
      } else {
        this.error = response.message || 'CDK 调换失败'
      }
      this.loading = false
    },
    async copyText(content, type, code = '') {
      if (!content) return
      try {
        await navigator.clipboard.writeText(content)
        this.resetCopyState()
        if (type === 'all') this.copiedAll = true
        if (type === 'failed') this.copiedFailed = true
        if (type === 'single') this.copiedCode = code
        this.copyResetTimer = setTimeout(() => this.resetCopyState(), 1600)
      } catch {
        this.error = '复制失败，请手动复制 CDK'
      }
    },
    copyAllNewCDKs() {
      return this.copyText(this.successResults.map((item) => item.newCDK).join('\n'), 'all')
    },
    copyFailedCDKs() {
      return this.copyText(this.failedResults.map((item) => item.oldCDK).join('\n'), 'failed')
    },
    copySingle(code) {
      return this.copyText(code, 'single', code)
    },
    showRefreshDisabledToast() {
      this.hideRefreshDisabledToast()
      this.refreshDisabledToastVisible = true
      this.refreshDisabledToastTimer = window.setTimeout(() => {
        this.refreshDisabledToastVisible = false
        this.refreshDisabledToastTimer = null
      }, 5000)
    },
    hideRefreshDisabledToast() {
      if (this.refreshDisabledToastTimer) {
        window.clearTimeout(this.refreshDisabledToastTimer)
        this.refreshDisabledToastTimer = null
      }
      this.refreshDisabledToastVisible = false
    },
    resetCopyState() {
      if (this.copyResetTimer) {
        clearTimeout(this.copyResetTimer)
        this.copyResetTimer = null
      }
      this.copiedAll = false
      this.copiedFailed = false
      this.copiedCode = ''
    },
    reset() {
      if (this.loading) return
      this.cardCodesText = ''
      this.submittedCardCodes = []
      this.results = []
      this.confirmed = false
      this.loading = false
      this.error = ''
      this.queryCompleted = false
      this.idempotencyKey = ''
      this.resumePending = false
      clearPersistedRefreshState()
      this.resetCopyState()
      this.hideRefreshDisabledToast()
    }
  }
}
</script>

<style scoped>
.cdk-refresh {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 18px;
}

.card-icon-row,
.section-head,
.status-line {
  display: flex;
  align-items: center;
}

.card-icon-row {
  gap: 12px;
}

.card-icon {
  display: flex;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #eef5ff;
  color: var(--ui-blue);
}

.card-icon svg {
  width: 21px;
  height: 21px;
}

.card-title,
.section-title {
  font-size: 18px;
  font-weight: 700;
}

.card-desc,
.section-desc {
  margin-top: 2px;
  color: var(--ui-label-secondary);
  font-size: 13px;
}

.input-group {
  display: flex;
  flex-direction: column;
}

.input-meta,
.section-head {
  justify-content: space-between;
  gap: 12px;
}

.input-meta {
  display: flex;
  margin-top: 8px;
  color: var(--ui-label-secondary);
  font-size: 13px;
}

.link-button {
  border: 0;
  background: transparent;
  color: var(--ui-blue);
  font: inherit;
  cursor: pointer;
}

.confirm-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 11px 12px;
  border-radius: 8px;
  background: rgba(217, 138, 34, 0.1);
  color: #805414;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}

.confirm-row input {
  width: 17px;
  height: 17px;
  margin-top: 1px;
  accent-color: var(--ui-blue);
}

.refresh-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 14px;
}

.summary-stat span {
  display: block;
  margin-bottom: 4px;
  color: var(--ui-label-secondary);
  font-size: 12px;
}

.summary-stat strong {
  font-size: 21px;
}

.success-stat strong {
  color: var(--ui-green);
}

.failed-stat strong {
  color: var(--ui-red);
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.copy-all-button,
.copy-failed-button {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  white-space: nowrap;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-card,
.failed-card {
  padding: 14px;
}

.success-card {
  border: 1px solid rgba(31, 157, 114, 0.18);
}

.status-line {
  justify-content: space-between;
  gap: 10px;
  color: var(--ui-label-secondary);
  font-size: 13px;
}

.success-badge {
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(31, 157, 114, 0.12);
  color: var(--ui-green);
  font-weight: 700;
}

.code-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin-top: 13px;
}

.code-pair > svg {
  width: 20px;
  color: var(--ui-label-tertiary);
}

.code-pair span {
  display: block;
  margin-bottom: 4px;
  color: var(--ui-label-secondary);
  font-size: 12px;
}

.code-pair code {
  display: block;
  overflow-wrap: anywhere;
  color: var(--ui-label);
  font-size: 13px;
  font-weight: 700;
}

.new-code-row {
  min-width: 0;
}

.new-code-row .link-button {
  margin-top: 6px;
  font-size: 13px;
}

.failed-card pre {
  max-height: 220px;
  margin: 12px 0 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--ui-separator);
  border-radius: 8px;
  background: var(--ui-fill);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.refresh-disabled-toast {
  position: fixed;
  top: max(20px, env(safe-area-inset-top));
  right: 20px;
  z-index: 100;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 10px;
  width: min(400px, calc(100vw - 40px));
  min-height: 52px;
  padding: 10px 10px 10px 14px;
  border: 1px solid rgba(210, 59, 48, 0.28);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 12px 30px rgba(28, 25, 23, 0.16);
  color: var(--ui-red);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.refresh-disabled-toast button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: currentColor;
  cursor: pointer;
}

.refresh-disabled-toast button:hover {
  background: rgba(210, 59, 48, 0.08);
}

.refresh-toast-enter-active,
.refresh-toast-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.refresh-toast-enter-from,
.refresh-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 560px) {
  .refresh-disabled-toast {
    top: max(12px, env(safe-area-inset-top));
    right: 12px;
    width: calc(100vw - 24px);
  }

  .section-head {
    align-items: flex-start;
  }

  .code-pair {
    grid-template-columns: 1fr;
  }

  .code-pair > svg {
    transform: rotate(90deg);
  }
}
</style>
