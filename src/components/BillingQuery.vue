<template>
  <section class="billing-query">
    <div class="subpage-nav">
      <button type="button" class="subpage-back-button" @click="$emit('back')">
        <ArrowLeft :size="17" aria-hidden="true" />
        <span>返回兑换</span>
      </button>
    </div>

    <div v-if="phase === 'input'" class="billing-input query-input-card ui-card">
      <label for="billingToken">ChatGPT Token</label>
      <textarea
        id="billingToken"
        v-model="tokenInput"
        class="ui-textarea billing-textarea"
        rows="9"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="粘贴 Token、授权 JSON 或 Bearer Token"
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
      ></textarea>

      <div v-if="error" class="ui-callout is-danger billing-error">
        <CircleAlert :size="18" aria-hidden="true" />
        <span>{{ error }}</span>
      </div>

      <button type="button" class="btn-filled query-submit-button billing-submit" :disabled="!tokenInput.trim()" @click="submit">
        <Search :size="18" aria-hidden="true" />
        <span>查询账单</span>
      </button>
    </div>

    <div v-else-if="phase === 'loading'" class="billing-loading ui-card" aria-live="polite">
      <div class="billing-loading-icon">
        <LoaderCircle :size="30" aria-hidden="true" />
      </div>
      <strong>正在读取账单信息</strong>
      <span>正在同步订阅、支付方式和最近账单</span>
      <div class="billing-loading-line"><i></i></div>
    </div>

    <div v-else class="billing-result">
      <section class="billing-account-band">
        <div class="billing-account-icon" aria-hidden="true">
          <UserRound :size="22" />
        </div>
        <div class="billing-account-copy">
          <span>账号</span>
          <strong>{{ accountLabel }}</strong>
          <small>{{ planLabel }}</small>
        </div>
        <button type="button" class="billing-icon-button" title="重新查询" aria-label="重新查询" @click="reset">
          <RefreshCw :size="18" aria-hidden="true" />
        </button>
      </section>

      <div v-if="result.notice" class="ui-callout is-warning billing-notice">
        <Info :size="18" aria-hidden="true" />
        <span>{{ result.notice }}</span>
      </div>

      <section class="billing-facts" aria-label="账单摘要">
        <article class="billing-fact">
          <span>当前套餐</span>
          <strong>{{ planLabel }}</strong>
          <small>{{ subscriptionStatus }}</small>
        </article>
        <article class="billing-fact">
          <span>订阅费用</span>
          <strong>{{ subscriptionAmount }}</strong>
          <small>{{ subscriptionPeriod }}</small>
        </article>
        <article class="billing-fact">
          <span>{{ nextBillingLabel }}</span>
          <strong>{{ nextBilling }}</strong>
          <small>{{ autoRenewText }}</small>
        </article>
        <article class="billing-fact">
          <span>支付方式</span>
          <strong>{{ paymentMethodLabel }}</strong>
          <small>{{ paymentMethodExpiry }}</small>
        </article>
        <article class="billing-fact billing-fact-wide">
          <span>账单主体</span>
          <strong>{{ customerLabel }}</strong>
          <small>{{ customerAddress }}</small>
        </article>
      </section>

      <section class="billing-invoices">
        <div class="billing-invoices-head">
          <div>
            <span>INVOICES</span>
            <h3>账单记录</h3>
          </div>
          <strong>{{ result.invoices.length }} 条</strong>
        </div>

        <div v-if="result.invoices.length" class="billing-table-wrap">
          <table class="billing-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>金额</th>
                <th>状态</th>
                <th>描述</th>
                <th>文件</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="invoice in result.invoices" :key="invoice.id || invoice.number">
                <td data-label="日期">{{ formatDate(invoice.created_at) }}</td>
                <td data-label="金额" class="billing-amount">{{ formatMoney(invoice.amount_minor, invoice.currency) }}</td>
                <td data-label="状态">
                  <span class="billing-status" :class="invoiceStatusClass(invoice.status)">{{ invoiceStatusText(invoice.status) }}</span>
                </td>
                <td data-label="描述" class="billing-description">{{ invoice.description || invoice.number || 'ChatGPT 订阅' }}</td>
                <td data-label="文件">
                  <div class="billing-files">
                    <a
                      v-if="invoice.invoice_pdf_url"
                      :href="invoice.invoice_pdf_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="打开发票"
                    >
                      <FileDown :size="16" aria-hidden="true" />
                      <span>发票</span>
                    </a>
                    <a
                      v-if="invoice.receipt_pdf_url"
                      :href="invoice.receipt_pdf_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="打开收据"
                    >
                      <ExternalLink :size="16" aria-hidden="true" />
                      <span>收据</span>
                    </a>
                    <span v-if="!invoice.invoice_pdf_url && !invoice.receipt_pdf_url" class="billing-no-file">暂无</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="billing-empty">
          <FileText :size="24" aria-hidden="true" />
          <strong>暂无账单记录</strong>
          <span>{{ result.notice || '当前账号没有可展示的 Stripe 账单' }}</span>
        </div>
      </section>
    </div>
  </section>
</template>

<script>
import {
  ArrowLeft,
  CircleAlert,
  ExternalLink,
  FileDown,
  FileText,
  Info,
  LoaderCircle,
  RefreshCw,
  Search,
  UserRound
} from '@lucide/vue'
import { queryBilling } from '../services/api'

const PLAN_NAMES = {
  free: 'ChatGPT Free',
  go: 'ChatGPT Go',
  plus: 'ChatGPT Plus',
  pro: 'ChatGPT Pro 200',
  promax: 'ChatGPT Pro 500',
  prolite: 'ChatGPT Pro 100',
  chatgptfreeplan: 'ChatGPT Free',
  chatgptgoplan: 'ChatGPT Go',
  chatgptplusplan: 'ChatGPT Plus',
  chatgptprolite: 'ChatGPT Pro 100',
  chatgptproliteplan: 'ChatGPT Pro 100',
  chatgptpro: 'ChatGPT Pro 200',
  chatgptproplan: 'ChatGPT Pro 200',
  chatgpt2pro20x: 'ChatGPT Pro 200',
  chatgptpromax: 'ChatGPT Pro 500'
}

export default {
  name: 'BillingQuery',
  components: {
    ArrowLeft,
    CircleAlert,
    ExternalLink,
    FileDown,
    FileText,
    Info,
    LoaderCircle,
    RefreshCw,
    Search,
    UserRound
  },
  emits: ['back'],
  data() {
    return {
      phase: 'input',
      tokenInput: '',
      error: '',
      result: {
        profile: {},
        subscription: null,
        paymentMethod: null,
        customer: null,
        invoices: [],
        notice: ''
      }
    }
  },
  computed: {
    accountLabel() {
      return this.result.profile?.email || this.result.customer?.email || '未识别邮箱'
    },
    planLabel() {
      const subscription = this.result.subscription
      const hasActivePlan = ['active', 'canceling'].includes(subscription?.status) && subscription?.plan_name
      return this.formatPlan(hasActivePlan ? subscription.plan_name : (this.result.profile?.plan_type || subscription?.plan_name))
    },
    subscriptionStatus() {
      const statuses = { active: '订阅使用中', canceling: '将在周期结束时停止', inactive: '当前无有效订阅' }
      return statuses[this.result.subscription?.status] || '状态以 ChatGPT 为准'
    },
    subscriptionAmount() {
      const subscription = this.result.subscription
      if (!subscription || !subscription.amount_minor) return '暂无'
      return this.formatMoney(subscription.amount_minor, subscription.currency)
    },
    subscriptionPeriod() {
      return this.formatBillingPeriod(this.result.subscription?.billing_period) || '计费周期暂缺'
    },
    nextBilling() {
      return this.result.subscription?.next_billing_at ? this.formatDate(this.result.subscription.next_billing_at) : '暂无'
    },
    nextBillingLabel() {
      return this.result.subscription?.auto_renew ? '下次计费' : '有效期至'
    },
    autoRenewText() {
      if (!this.result.subscription) return ''
      return this.result.subscription.auto_renew ? '自动续费已开启' : '自动续费已关闭'
    },
    paymentMethodLabel() {
      const method = this.result.paymentMethod
      if (!method) return '暂无'
      return [String(method.brand || '').toUpperCase(), method.last4 ? `•••• ${method.last4}` : ''].filter(Boolean).join(' ')
    },
    paymentMethodExpiry() {
      const method = this.result.paymentMethod
      if (!method?.exp_month || !method?.exp_year) return ''
      return `${String(method.exp_month).padStart(2, '0')}/${method.exp_year}`
    },
    customerLabel() {
      return this.result.customer?.name || this.result.customer?.email || '暂无'
    },
    customerAddress() {
      const address = this.result.customer?.address
      if (!address) return ''
      return [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
        .filter(Boolean)
        .join(', ')
    }
  },
  methods: {
    async submit() {
      if (!this.tokenInput.trim()) return
      this.phase = 'loading'
      this.error = ''
      const response = await queryBilling(this.tokenInput)
      if (response.code !== 200) {
        this.error = response.message || '账单查询失败'
        this.phase = 'input'
        return
      }
      this.result = response.data
      this.tokenInput = ''
      this.phase = 'result'
    },
    reset() {
      this.tokenInput = ''
      this.error = ''
      this.result = { profile: {}, subscription: null, paymentMethod: null, customer: null, invoices: [], notice: '' }
      this.phase = 'input'
    },
    formatPlan(value) {
      const raw = String(value || '').trim()
      if (!raw) return '未知套餐'
      return PLAN_NAMES[raw.toLowerCase()] || raw
    },
    formatBillingPeriod(value) {
      const periods = { monthly: '每月', month: '每月', yearly: '每年', annual: '每年', year: '每年' }
      return periods[String(value || '').toLowerCase()] || ''
    },
    formatMoney(amountMinor, currency) {
      const amount = Number(amountMinor || 0) / 100
      const code = String(currency || 'USD').toUpperCase()
      try {
        return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: code }).format(amount)
      } catch {
        return `${code} ${amount.toFixed(2)}`
      }
    },
    formatDate(value) {
      if (!value) return '暂无'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    },
    invoiceStatusText(status) {
      const statuses = { paid: '已支付', open: '待支付', draft: '草稿', void: '已作废', uncollectible: '无法收回' }
      return statuses[String(status || '').toLowerCase()] || status || '未知'
    },
    invoiceStatusClass(status) {
      return `is-${String(status || 'unknown').toLowerCase()}`
    }
  }
}
</script>

<style scoped>
.billing-query {
  width: 100%;
}

.billing-invoices-head span {
  display: block;
  color: var(--ui-green);
  font-size: 11px;
  font-weight: 800;
}

.billing-account-icon {
  width: 46px;
  height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid rgba(31, 157, 114, 0.22);
  border-color: rgba(47, 115, 217, 0.2);
  border-radius: 10px;
  background: var(--fresh-blue-soft);
  color: var(--ui-blue);
}

.billing-loading {
  margin-top: 10px;
  padding: 20px;
  border: 1px solid rgba(220, 233, 227, 0.94);
  border-radius: 14px;
  box-shadow: var(--fresh-shadow-soft);
}

.billing-input label {
  display: block;
  margin-bottom: 9px;
  color: var(--ui-label-secondary);
  font-size: 13px;
  font-weight: 750;
}

.billing-textarea {
  min-height: 220px;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
}

.billing-error {
  margin-top: 12px;
}

.billing-submit {
  width: 100%;
}

.billing-loading {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}

.billing-loading-icon {
  color: var(--ui-blue);
  animation: billing-spin 1s linear infinite;
}

.billing-loading strong {
  margin-top: 18px;
  font-size: 18px;
}

.billing-loading > span {
  margin-top: 7px;
  color: var(--ui-label-secondary);
  font-size: 13px;
}

.billing-loading-line {
  width: min(280px, 80%);
  height: 5px;
  margin-top: 22px;
  overflow: hidden;
  border-radius: 5px;
  background: var(--ui-fill);
}

.billing-loading-line i {
  display: block;
  width: 45%;
  height: 100%;
  background: linear-gradient(90deg, var(--ui-blue), var(--ui-green));
  animation: billing-loading 1.25s ease-in-out infinite;
}

.billing-result {
  margin-top: 18px;
}

.billing-account-band {
  min-height: 92px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 13px;
  border: 1px solid var(--fresh-border);
  border-radius: 14px;
  background: linear-gradient(145deg, #ffffff, #f8fbfa);
  box-shadow: 0 7px 20px rgba(39, 72, 57, 0.05);
}

.billing-account-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.billing-account-copy span,
.billing-fact > span {
  color: var(--ui-label-secondary);
  font-size: 12px;
  font-weight: 700;
}

.billing-account-copy strong {
  margin-top: 4px;
  overflow-wrap: anywhere;
  font-size: 18px;
}

.billing-account-copy small {
  margin-top: 4px;
  color: var(--ui-blue);
  font-weight: 750;
}

.billing-icon-button {
  width: 38px;
  height: 38px;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid var(--fresh-border);
  border-radius: 10px;
  background: #fff;
  color: var(--ui-label-secondary);
  cursor: pointer;
}

.billing-icon-button:hover {
  color: var(--ui-blue);
  border-color: rgba(47, 115, 217, 0.3);
}

.billing-notice {
  margin-top: 12px;
}

.billing-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.billing-fact {
  min-width: 0;
  min-height: 112px;
  padding: 16px;
  display: flex;
  justify-content: flex-end;
  flex-direction: column;
  border: 1px solid var(--fresh-border);
  border-radius: 14px;
  background: linear-gradient(145deg, #ffffff, #f8fbfa);
  box-shadow: 0 7px 20px rgba(39, 72, 57, 0.045);
}

.billing-fact-wide {
  grid-column: 1 / -1;
}

.billing-fact strong {
  margin-top: 8px;
  overflow-wrap: anywhere;
  font-size: 17px;
  line-height: 1.35;
}

.billing-fact small {
  min-height: 18px;
  margin-top: 5px;
  overflow-wrap: anywhere;
  color: var(--ui-label-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.billing-invoices {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid var(--fresh-border);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 7px 20px rgba(39, 72, 57, 0.05);
}

.billing-invoices-head {
  min-height: 70px;
  padding: 15px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--fresh-border);
}

.billing-invoices-head h3 {
  margin-top: 4px;
  font-size: 18px;
}

.billing-invoices-head > strong {
  color: var(--ui-label-secondary);
  font-size: 13px;
}

.billing-table-wrap {
  overflow-x: auto;
}

.billing-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.billing-table th,
.billing-table td {
  padding: 13px 14px;
  border-bottom: 1px solid var(--fresh-border);
  text-align: left;
  vertical-align: middle;
  font-size: 13px;
}

.billing-table th {
  background: var(--fresh-soft);
  color: var(--ui-label-secondary);
  font-size: 12px;
}

.billing-table th:nth-child(1) { width: 112px; }
.billing-table th:nth-child(2) { width: 112px; }
.billing-table th:nth-child(3) { width: 92px; }
.billing-table th:nth-child(5) { width: 154px; }
.billing-table tbody tr:last-child td { border-bottom: 0; }

.billing-amount {
  font-weight: 750;
}

.billing-description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.billing-status {
  display: inline-flex;
  align-items: center;
  min-height: 25px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--ui-fill);
  color: var(--ui-label-secondary);
  font-size: 12px;
  font-weight: 750;
}

.billing-status.is-paid {
  background: #e6f6ee;
  color: #157d60;
}

.billing-status.is-open,
.billing-status.is-draft {
  background: #fff4df;
  color: #a66a12;
}

.billing-status.is-void,
.billing-status.is-uncollectible {
  background: #fdeceb;
  color: var(--ui-red);
}

.billing-files {
  display: flex;
  align-items: center;
  gap: 10px;
}

.billing-files a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ui-blue);
  font-size: 12px;
  font-weight: 750;
  text-decoration: none;
  white-space: nowrap;
}

.billing-files a:hover {
  color: var(--ui-green);
}

.billing-no-file {
  color: var(--ui-label-tertiary);
  font-size: 12px;
}

.billing-empty {
  min-height: 210px;
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: var(--ui-label-secondary);
  text-align: center;
}

.billing-empty strong {
  margin-top: 12px;
  color: var(--ui-label);
}

.billing-empty span {
  margin-top: 6px;
  font-size: 13px;
}

@keyframes billing-spin {
  to { transform: rotate(360deg); }
}

@keyframes billing-loading {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(270%); }
}

@media (max-width: 680px) {
  .billing-input,
  .billing-loading {
    padding: 16px;
  }

  .billing-textarea {
    min-height: 200px;
  }

  .billing-facts {
    grid-template-columns: 1fr;
  }

  .billing-fact-wide {
    grid-column: auto;
  }

  .billing-account-band {
    align-items: flex-start;
  }

  .billing-table-wrap {
    overflow: visible;
  }

  .billing-table,
  .billing-table tbody,
  .billing-table tr,
  .billing-table td {
    display: block;
    width: 100%;
  }

  .billing-table thead {
    display: none;
  }

  .billing-table tr {
    padding: 13px 15px;
    border-bottom: 1px solid var(--fresh-border);
  }

  .billing-table tbody tr:last-child {
    border-bottom: 0;
  }

  .billing-table td {
    min-height: 34px;
    padding: 6px 0 6px 92px;
    position: relative;
    border: 0;
    overflow-wrap: anywhere;
  }

  .billing-table td::before {
    content: attr(data-label);
    position: absolute;
    left: 0;
    top: 7px;
    width: 80px;
    color: var(--ui-label-secondary);
    font-size: 12px;
    font-weight: 700;
  }

  .billing-description {
    white-space: normal;
  }
}
</style>
