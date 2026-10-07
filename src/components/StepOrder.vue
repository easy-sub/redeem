<template>
  <div class="step-order">
    <template v-if="!orderInfo">
      <div class="ui-card confirm-card">
        <div class="card-icon-row confirm-card-head">
          <div class="card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12.5 20 4l-4.5 16-3.2-6.8L4 12.5z"></path>
              <path d="m12.3 13.2 3.2-3.2"></path>
            </svg>
          </div>
          <div>
            <div class="card-title">确认兑换</div>
            <div class="card-desc">核对信息后提交{{ redemptionLabel }}</div>
          </div>
        </div>

        <div class="ui-list">
          <div class="ui-row">
            <span class="ui-row-label">CDK</span>
            <span class="ui-row-value">{{ cardCode }}</span>
          </div>
          <div class="ui-row">
            <span class="ui-row-label">{{ productFieldLabel }}</span>
            <span class="ui-row-value">{{ cardInfo && cardInfo.productName }}</span>
          </div>
          <div v-if="isCreditsProduct" class="ui-row">
            <span class="ui-row-label">充值数量</span>
            <span class="ui-row-value">{{ currentCreditQuantity }} Credits</span>
          </div>
          <div class="ui-row">
            <span class="ui-row-label">目标账号</span>
            <span class="ui-row-value">{{ tokenInfo && tokenInfo.email }}</span>
          </div>
          <div class="ui-row">
            <span class="ui-row-label">账号昵称</span>
            <span class="ui-row-value">{{ tokenInfo && tokenInfo.name }}</span>
          </div>
        </div>
      </div>

      <div class="section-gap">
        <div v-if="error" class="ui-callout is-danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ error }}</span>
          <button v-if="errorURL" type="button" class="copy-error-button" :title="getErrorCopyTitle('submit')" :aria-label="getErrorCopyTitle('submit')" @click="copyErrorURL('submit', errorURL)">
            <Check v-if="isErrorCopySuccessful('submit')" :size="15" aria-hidden="true" />
            <Copy v-else :size="15" aria-hidden="true" />
          </button>
        </div>

        <div class="ui-callout is-danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>兑换完成之前请不要退出 {{ providerLabel }} 登录状态，否则可能导致订阅失败。</span>
        </div>

        <div class="button-group">
          <button
            v-if="!confirming"
            @click="confirming = true"
            class="btn-filled"
            :disabled="!cardCode || !token || loading"
          >
            <span v-if="loading" class="ui-spinner"></span>
            {{ loading ? '提交中…' : '立即兑换' }}
          </button>
          <template v-else>
            <button @click="confirming = false" class="btn-gray">
              取消
            </button>
            <button
              @click="submitOrder"
              class="btn-filled btn-destructive"
              :disabled="loading"
            >
              <span v-if="loading" class="ui-spinner"></span>
              {{ loading ? '提交中…' : '确认提交' }}
            </button>
          </template>
        </div>
      </div>
    </template>

    <template v-if="orderInfo">
      <div class="order-success ui-card" :class="{ 'is-returned': isCardReturned, 'is-partial': isPartialClosed }">
        <div class="success-icon">
          <svg v-if="isCardReturned || isPartialClosed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="success-title">{{ orderResultTitle }}</div>
        <div class="success-subtitle error-with-copy"><span>{{ orderResultSubtitle }}</span>
          <button v-if="orderResultURL" type="button" class="copy-error-button" :title="getErrorCopyTitle('result')" :aria-label="getErrorCopyTitle('result')" @click="copyErrorURL('result', orderResultURL)">
            <Check v-if="isErrorCopySuccessful('result')" :size="15" aria-hidden="true" />
            <Copy v-else :size="15" aria-hidden="true" />
          </button>
        </div>
        <button
          v-if="canCopyAccountCard"
          type="button"
          class="copy-account-button"
          :class="getCopyButtonClass('page')"
          @click="copyAccountAndCard('page')"
        >
          <Check v-if="isCopySuccessful('page')" :size="16" aria-hidden="true" />
          <Copy v-else :size="16" aria-hidden="true" />
          <span>{{ getCopyButtonText('page') }}</span>
        </button>
      </div>

      <div class="ui-card ui-list">
        <div class="ui-row">
          <span class="ui-row-label">订单编号</span>
          <span class="ui-row-value">{{ orderInfo.orderId }}</span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">CDK</span>
          <span class="ui-row-value">{{ cardCode }}</span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">{{ productFieldLabel }}</span>
          <span class="ui-row-value">{{ orderInfo.productName }}</span>
        </div>
        <div v-if="isCreditsProduct" class="ui-row">
          <span class="ui-row-label">充值数量</span>
          <span class="ui-row-value">{{ currentCreditQuantity }} Credits</span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">目标账号</span>
          <span class="ui-row-value">{{ orderInfo.email }}</span>
        </div>
        <div v-if="orderInfo.paymentCard" class="ui-row">
          <span class="ui-row-label">支付卡</span>
          <span class="ui-row-value">{{ orderInfo.paymentCard }}</span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">订单状态</span>
          <span class="ui-row-value" :class="getStatusClass(orderInfo.status)">{{ getStatusText(orderInfo.status) }}</span>
        </div>
        <div v-if="orderFailureMessage" class="ui-row">
          <span class="ui-row-label">失败原因</span>
          <span class="ui-row-value status-error error-with-copy"><span>{{ orderFailureMessage }}</span>
            <button v-if="orderFailureURL" type="button" class="copy-error-button" :title="getErrorCopyTitle('order')" :aria-label="getErrorCopyTitle('order')" @click="copyErrorURL('order', orderFailureURL)">
            <Check v-if="isErrorCopySuccessful('order')" :size="15" aria-hidden="true" />
            <Copy v-else :size="15" aria-hidden="true" />
          </button>
          </span>
        </div>
        <div class="ui-row">
          <span class="ui-row-label">创建时间</span>
          <span class="ui-row-value">{{ formatTime(orderInfo.createTime) }}</span>
        </div>
      </div>
      <div class="ui-group-footer">
        温馨提示：{{ redemptionLabel }}一般会在 15 秒到 1 分钟内完成，高峰期可能延迟到 3 分钟；如未到账请联系客服处理。
      </div>

      <div class="section-gap">
        <button @click="reset" class="btn-gray">继续兑换</button>
      </div>
    </template>

    <transition name="alert-fade">
      <div v-if="progressDialogVisible" class="alert-overlay">
        <div class="ui-alert">
          <div class="ui-alert-body">
            <div class="ui-alert-icon" :class="progressDialogIconClass">
              <svg v-if="isFinalCompleted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <svg v-else-if="isFinalException || isCardReturned || isPartialClosed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span v-else class="ui-spinner alert-spinner"></span>
            </div>
            <div class="ui-alert-title">{{ progressDialogTitle }}</div>
            <div class="ui-alert-message error-with-copy"><span>{{ progressDialogSubtitle }}</span>
              <button v-if="progressDialogURL" type="button" class="copy-error-button" :title="getErrorCopyTitle('progress')" :aria-label="getErrorCopyTitle('progress')" @click="copyErrorURL('progress', progressDialogURL)">
            <Check v-if="isErrorCopySuccessful('progress')" :size="15" aria-hidden="true" />
            <Copy v-else :size="15" aria-hidden="true" />
          </button>
            </div>

            <div class="alert-progress">
              <div class="ui-progress-track">
                <div
                  class="ui-progress-fill"
                  :class="{ 'is-completed': isFinalCompleted, 'is-error': isFinalException, 'is-returned': isCardReturned, 'is-partial': isPartialClosed }"
                  :style="{ width: displayProgress + '%' }"
                ></div>
              </div>
              <div class="alert-progress-meta">
                <span>{{ displayProgress }}%</span>
                <span :class="getStatusClass(currentOrderStatus)">{{ getStatusText(currentOrderStatus) }}</span>
              </div>
            </div>

            <div class="alert-details">
              <div class="alert-detail-item">
                <span>订单编号</span>
                <strong>{{ orderInfo && orderInfo.orderId }}</strong>
              </div>
              <div class="alert-detail-item">
                <span>目标账号</span>
                <strong>{{ orderInfo && orderInfo.email }}</strong>
              </div>
              <div v-if="paymentCardLastFour" class="alert-detail-item">
                <span>支付卡尾号</span>
                <strong>{{ paymentCardLastFour }}</strong>
              </div>
              <div class="alert-detail-item">
                <span>当前状态</span>
                <strong :class="getStatusClass(currentOrderStatus)">{{ getStatusText(currentOrderStatus) }}</strong>
              </div>
            </div>

            <button
              v-if="canCopyAccountCard"
              type="button"
              class="copy-account-button alert-copy-button"
              :class="getCopyButtonClass('dialog')"
              @click="copyAccountAndCard('dialog')"
            >
              <Check v-if="isCopySuccessful('dialog')" :size="16" aria-hidden="true" />
              <Copy v-else :size="16" aria-hidden="true" />
              <span>{{ getCopyButtonText('dialog') }}</span>
            </button>

            <div
              v-if="pollError"
              class="alert-poll-error"
              :class="{ 'is-returned': isCardReturned }"
            >
              <span>{{ pollError }}</span>
              <button v-if="pollErrorURL" type="button" class="copy-error-button" :title="getErrorCopyTitle('poll')" :aria-label="getErrorCopyTitle('poll')" @click="copyErrorURL('poll', pollErrorURL)">
            <Check v-if="isErrorCopySuccessful('poll')" :size="15" aria-hidden="true" />
            <Copy v-else :size="15" aria-hidden="true" />
          </button>
            </div>
          </div>

          <button
            v-if="isFinalStatus"
            @click="closeProgressDialog"
            class="ui-alert-action"
          >
            我知道了
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { Check, Copy } from '@lucide/vue'
import { createOrder, queryOrderByCard, queryRedeemResult } from '../services/api'
import {
  ORDER_STATUS,
  getOrderStatusClass,
  getOrderStatusText,
  normalizeOrderStatus
} from '../constants/orderStatus'
import { extractErrorURL } from '../utils/errorUrl'

const PROGRESS_DURATION = 30000
const PROGRESS_INTERVAL = 200
const POLL_INTERVAL = 3000
const RETRY_PROGRESS_START = 88
const RETRY_PROGRESS_MAX = 96
const RECHARGE_PROGRESS_TIPS = [
  '正在验证 CDK 与账号状态',
  '正在获取支付信息',
  '正在提交支付',
  '正在兑换订阅',
  '正在等待支付结果'
]

export default {
  name: 'StepOrder',
  components: {
    Check,
    Copy
  },
  props: {
    cardCode: {
      type: String,
      default: ''
    },
    token: {
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
    },
    tokenInfo: {
      type: Object,
      default: null
    },
    provider: {
      type: String,
      default: 'openai'
    },
    initialOrder: {
      type: Object,
      default: null
    }
  },
  emits: ['completed', 'reset', 'submitting', 'submit-failed', 'card-verified'],
  data() {
    return {
      orderInfo: this.initialOrder,
      loading: false,
      error: '',
      confirming: false,
      progressDialogVisible: false,
      progressValue: 0,
      pollError: '',
      progressTimer: null,
      pollTimer: null,
      copyFeedback: '',
      copyResetTimer: null,
      copyErrorFeedback: '',
      copyErrorResetTimer: null,
      progressStartedAt: 0,
      retryProgressStarted: false
    }
  },
  computed: {
    isCreditsProduct() {
      const source = this.orderInfo || this.cardInfo || {}
      return String(source.productType || '').toLowerCase() === 'codex_credits'
    },
    currentCreditQuantity() {
      const source = this.orderInfo || this.cardInfo || {}
      return Number(source.creditQuantity || 0)
    },
    productFieldLabel() {
      return this.isCreditsProduct ? 'Credits 商品' : '订阅方案'
    },
    redemptionLabel() {
      return this.isCreditsProduct ? 'Credits 兑换' : '订阅兑换'
    },
    currentOrderStatus() {
      return this.orderInfo ? normalizeOrderStatus(this.orderInfo.status) : ORDER_STATUS.PENDING
    },
    providerLabel() {
      return ({ openai: 'ChatGPT', claude: 'Claude', grok: 'Grok' })[String(this.provider || '').toLowerCase()] || 'ChatGPT'
    },
    isFinalCompleted() {
      return this.currentOrderStatus === ORDER_STATUS.COMPLETED
    },
    isFinalException() {
      return this.currentOrderStatus === ORDER_STATUS.EXCEPTION
    },
    isPartialClosed() {
      return this.currentOrderStatus === ORDER_STATUS.PARTIAL_CLOSED
    },
    isCardReturned() {
      return this.currentOrderStatus === ORDER_STATUS.CARD_RETURNED
    },
    isFinalStatus() {
      return this.isFinalCompleted || this.isPartialClosed || this.isFinalException || this.isCardReturned
    },
    isRetrying() {
      return Boolean(this.orderInfo && this.orderInfo.retrying && !this.isFinalStatus)
    },
    isPaymentResultChecking() {
      return Boolean(this.orderInfo && this.orderInfo.paymentResultChecking && !this.isFinalStatus)
    },
    displayProgress() {
      return Math.round(this.progressValue)
    },
    progressDialogTitle() {
      if (this.isFinalCompleted) return '兑换完成'
      if (this.isPartialClosed) return '部分履约已关闭'
      if (this.isCardReturned) return '兑换失败，CDK 已释放，请刷新网页重新提交'
      if (this.isFinalException) return '兑换异常'
      if (this.isPaymentResultChecking) return '支付结果确认中'
      if (this.isRetrying) return '正在自动重试'
      return '正在兑换'
    },
    currentProgressTip() {
      const progressStep = 99 / RECHARGE_PROGRESS_TIPS.length
      const tipIndex = Math.min(
        RECHARGE_PROGRESS_TIPS.length - 1,
        Math.floor(this.progressValue / progressStep)
      )

      return RECHARGE_PROGRESS_TIPS[tipIndex]
    },
    progressDialogSubtitle() {
      if (this.isFinalCompleted) return `后台已确认${this.redemptionLabel}完成`
      if (this.isPartialClosed) return this.orderFailureMessage || '基础套餐已保留，CDK 已兑换'
      if (this.isCardReturned) return this.orderFailureMessage || '订单未完成，CDK 已恢复可用'
      if (this.isFinalException) return this.orderFailureMessage || '后台返回异常结果，请联系客服处理'
      if (this.isPaymentResultChecking) return '系统正在确认支付结果，请继续等待'
      if (this.isRetrying) return '系统正在重新尝试，请继续等待'
      return this.currentProgressTip
    },
    progressDialogIconClass() {
      if (this.isFinalCompleted) return 'is-completed'
      if (this.isPartialClosed) return 'is-partial'
      if (this.isCardReturned) return 'is-returned'
      if (this.isFinalException) return 'is-error'
      return 'is-running'
    },
    orderResultTitle() {
      if (this.isPartialClosed) return '部分履约已关闭'
      if (this.isCardReturned) return '兑换失败，CDK 已释放，请刷新网页重新提交'
      return '订单提交成功'
    },
    orderResultSubtitle() {
      if (this.isPartialClosed) return this.orderFailureMessage || '基础套餐已保留，CDK 已兑换'
      if (this.isCardReturned) return this.orderFailureMessage || '原 CDK 已恢复为未兑换状态，可重新提交'
      return `${this.redemptionLabel}任务已进入处理队列`
    },
    orderFailureMessage() {
      if (!this.orderInfo) return ''
      if (!this.isPartialClosed && !this.isCardReturned && !this.isFinalException) return ''
      return this.orderInfo.returnedMessage || this.orderInfo.message || ''
    },
    errorURL() {
      return extractErrorURL(this.error)
    },
    orderFailureURL() {
      return extractErrorURL(this.orderFailureMessage)
    },
    progressDialogURL() {
      return extractErrorURL(this.progressDialogSubtitle)
    },
    orderResultURL() {
      return extractErrorURL(this.orderResultSubtitle)
    },
    pollErrorURL() {
      return extractErrorURL(this.pollError)
    },
    paymentCardLastFour() {
      const digits = String(this.orderInfo && this.orderInfo.paymentCard || '').match(/\d/g)
      return digits && digits.length >= 4 ? digits.slice(-4).join('') : ''
    },
    canCopyAccountCard() {
      return Boolean(this.isFinalCompleted && this.orderInfo && this.orderInfo.email && this.paymentCardLastFour)
    },
    accountCardCopyContent() {
      if (!this.canCopyAccountCard) return ''
      return [
        `目标账号　：${this.orderInfo.email}`,
        `支付卡尾号：${this.paymentCardLastFour}`,
        `${this.productFieldLabel.padEnd(5, '　')}：${this.orderInfo.productName}`,
        `订阅时间　：${this.formatSubscriptionTime(this.orderInfo.finishedTime)}`,
        `当前状态　：${this.getStatusText(this.orderInfo.status)}`
      ].join('\n')
    }
  },
  beforeUnmount() {
    this.stopProgressTracking()
    this.resetCopyFeedback()
    this.resetCopyErrorFeedback()
  },
  mounted() {
    if (this.orderInfo) {
      this.openProgressDialog()
    }
  },
  methods: {
    async copyAccountAndCard(source) {
      if (!this.accountCardCopyContent) return

      try {
        await navigator.clipboard.writeText(this.accountCardCopyContent)
        this.setCopyFeedback(`${source}:success`)
      } catch {
        this.setCopyFeedback(`${source}:error`)
      }
    },
    setCopyFeedback(feedback) {
      this.resetCopyFeedback()
      this.copyFeedback = feedback
      this.copyResetTimer = setTimeout(() => {
        this.copyFeedback = ''
        this.copyResetTimer = null
      }, 1600)
    },
    resetCopyFeedback() {
      if (this.copyResetTimer) {
        clearTimeout(this.copyResetTimer)
        this.copyResetTimer = null
      }
      this.copyFeedback = ''
    },
    isCopySuccessful(source) {
      return this.copyFeedback === `${source}:success`
    },
    getCopyButtonText(source) {
      if (this.isCopySuccessful(source)) return '已复制'
      if (this.copyFeedback === `${source}:error`) return '复制失败，请重试'
      return '复制订单信息'
    },
    getCopyButtonClass(source) {
      return {
        'is-copied': this.isCopySuccessful(source),
        'is-error': this.copyFeedback === `${source}:error`
      }
    },
    async copyErrorURL(source, value) {
      if (!value) return
      try {
        await navigator.clipboard.writeText(value)
        this.setCopyErrorFeedback(`${source}:success`)
      } catch {
        this.setCopyErrorFeedback(`${source}:error`)
      }
    },
    setCopyErrorFeedback(feedback) {
      this.resetCopyErrorFeedback()
      this.copyErrorFeedback = feedback
      this.copyErrorResetTimer = setTimeout(() => {
        this.copyErrorFeedback = ''
        this.copyErrorResetTimer = null
      }, 1600)
    },
    resetCopyErrorFeedback() {
      if (this.copyErrorResetTimer) {
        clearTimeout(this.copyErrorResetTimer)
        this.copyErrorResetTimer = null
      }
      this.copyErrorFeedback = ''
    },
    isErrorCopySuccessful(source) {
      return this.copyErrorFeedback === `${source}:success`
    },
    getErrorCopyTitle(source) {
      if (this.isErrorCopySuccessful(source)) return '已复制网址'
      if (this.copyErrorFeedback === `${source}:error`) return '复制失败，请重试'
      return '复制网址'
    },
    async submitOrder() {
      if (this.loading) return
      this.loading = true
      this.orderInfo = null
      this.error = ''
      this.pollError = ''
      this.resetCopyErrorFeedback()
      this.$emit('submitting')

      try {
        const response = await createOrder(
          this.cardCode, this.token, this.tokenInfo, this.cardInfo, this.requestNonce,
          (cardInfo) => this.$emit('card-verified', cardInfo)
        )

        if (response.code === 200) {
          this.orderInfo = response.data
          this.$emit('completed', response.data)
          this.openProgressDialog()
        } else {
          this.error = response.uncertain
            ? response.message
            : response.message || response.error || '订阅兑换失败'
          if (!response.uncertain) {
            this.$emit('submit-failed')
          }
        }
      } catch {
        this.error = '提交结果暂未确认，请保持当前页面并重新点击确认提交'
      } finally {
        this.loading = false
      }
    },
    getStatusClass(status) {
      return getOrderStatusClass(status)
    },
    getStatusText(status) {
      if (this.isPaymentResultChecking && normalizeOrderStatus(status) === ORDER_STATUS.PROCESSING) {
        return '支付结果确认中'
      }
      return getOrderStatusText(status)
    },
    formatTime(time) {
      if (!time) return ''
      return new Date(time).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    },
    formatSubscriptionTime(time) {
      if (!time) return '-'
      const date = new Date(time)
      if (Number.isNaN(date.getTime())) return '-'
      const pad = (value) => String(value).padStart(2, '0')
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    },
    openProgressDialog() {
      this.progressDialogVisible = true
      this.startProgressTracking()
    },
    closeProgressDialog() {
      this.progressDialogVisible = false
    },
    startProgressTracking() {
      this.stopProgressTracking()
      this.progressValue = this.isFinalStatus ? 100 : 0
      this.progressStartedAt = Date.now()
      this.retryProgressStarted = false

      if (!this.isFinalStatus) {
        this.progressTimer = setInterval(this.updateProgress, PROGRESS_INTERVAL)
        this.pollTimer = setInterval(this.pollOrderResult, POLL_INTERVAL)
        this.pollOrderResult()
      }
    },
    stopProgressTracking() {
      if (this.progressTimer) {
        clearInterval(this.progressTimer)
        this.progressTimer = null
      }
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    updateProgress() {
      if (this.isFinalStatus) {
        this.progressValue = 100
        this.stopProgressTracking()
        return
      }

      const elapsed = Date.now() - this.progressStartedAt
      if (this.isRetrying || this.isPaymentResultChecking) {
        if (!this.retryProgressStarted) {
          this.enterRetryProgress()
        }
        this.progressValue = Math.min(RETRY_PROGRESS_MAX, Math.max(RETRY_PROGRESS_START, this.progressValue) + 0.03)
        return
      }
      this.progressValue = Math.min(99, (elapsed / PROGRESS_DURATION) * 99)
    },
    enterRetryProgress() {
      this.retryProgressStarted = true
      this.progressValue = RETRY_PROGRESS_START
    },
    async pollOrderResult() {
      if (this.isFinalStatus) return

      const orderQueryToken = this.orderInfo && this.orderInfo.orderQueryToken
      const response = orderQueryToken
        ? await queryRedeemResult(orderQueryToken, this.cardCode)
        : await queryOrderByCard(this.cardCode, this.cardInfo && this.cardInfo.activationToken)

      if (response.code === 200 && response.data) {
        const wasRetrying = this.isRetrying
        this.pollError = ''
        this.orderInfo = {
          ...this.orderInfo,
          ...response.data
        }
        this.$emit('completed', this.orderInfo)
        if (!wasRetrying && this.isRetrying) {
          this.enterRetryProgress()
        }

        if (this.isFinalStatus) {
          this.progressValue = 100
          this.stopProgressTracking()
        }
      } else if (response.data && response.data.found === false) {
        this.markCardReturned(response.data.message || response.message)
      } else {
        this.pollError = response.message || '订单结果查询失败，系统将继续重试'
      }
    },
    markCardReturned(message) {
      this.orderInfo = {
        ...this.orderInfo,
        status: ORDER_STATUS.CARD_RETURNED,
        returnedMessage: message
      }
      this.progressValue = 100
      this.pollError = '兑换失败，CDK 已自动释放，可重新使用原 CDK 提交订单或联系客服。'
      this.stopProgressTracking()
      this.$emit('completed', this.orderInfo)
    },
    reset() {
      this.stopProgressTracking()
      this.$emit('reset')
    }
  }
}
</script>

<style scoped>
.section-gap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.button-group {
  display: flex;
  gap: 12px;
}

.button-group .btn-gray {
  flex: 1;
}

.button-group .btn-filled {
  flex: 2;
}

.button-group .btn-filled:only-child {
  flex: 1;
}

.confirm-card {
  overflow: hidden;
}

.confirm-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 18px 10px;
}

.card-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #fff8ed;
  color: var(--ui-orange);
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

/* ===== success view ===== */
.order-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 22px 18px;
  margin-top: 14px;
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

.success-icon {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: #e6f5ee;
  color: var(--ui-green);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  animation: popIn 0.4s ease;
}

.order-success.is-returned .success-icon,
.order-success.is-partial .success-icon {
  background: #fff8ed;
  color: var(--ui-orange);
}

.order-success + .ui-card {
  margin-top: 12px;
}

@keyframes popIn {
  0% {
    transform: scale(0);
  }
  60% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

.success-icon svg {
  width: 26px;
  height: 26px;
}

.success-title {
  font-size: 19px;
  font-weight: 700;
}

.success-subtitle {
  font-size: 14px;
  color: var(--ui-label-secondary);
}

.copy-account-button {
  min-height: 36px;
  margin-top: 12px;
  padding: 8px 12px;
  border: 1px solid var(--ui-separator);
  border-radius: 8px;
  background: var(--ui-fill);
  color: var(--ui-label);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.copy-account-button:hover {
  border-color: var(--ui-blue);
  color: var(--ui-blue);
}

.copy-account-button.is-copied {
  border-color: var(--ui-green);
  background: #e6f5ee;
  color: var(--ui-green);
}

.copy-account-button.is-error {
  border-color: var(--ui-red);
  background: #fff2f1;
  color: var(--ui-red);
}

/* ===== UI alert-style progress dialog ===== */
.alert-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(23, 33, 29, 0.32);
}

.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: opacity 0.25s ease;
}

.alert-fade-enter-active .ui-alert,
.alert-fade-leave-active .ui-alert {
  transition: transform 0.25s ease;
}

.alert-fade-enter,
.alert-fade-leave-to {
  opacity: 0;
}

.alert-fade-enter .ui-alert {
  transform: scale(1.08);
}

.ui-alert {
  width: min(100%, 380px);
  border: 1px solid var(--ui-separator);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(23, 33, 29, 0.18);
  overflow: hidden;
}

.ui-alert-body {
  padding: 24px 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.ui-alert-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.ui-alert-icon svg {
  width: 28px;
  height: 28px;
}

.ui-alert-icon.is-running {
  background: #eef5ff;
  color: var(--ui-blue);
}

.ui-alert-icon.is-completed {
  background: #e6f5ee;
  color: var(--ui-green);
}

.ui-alert-icon.is-error {
  background: #fff2f1;
  color: var(--ui-red);
}

.ui-alert-icon.is-returned {
  background: #fff8ed;
  color: var(--ui-orange);
}

.ui-alert-icon.is-partial {
  background: #fff8ed;
  color: var(--ui-orange);
}

.alert-spinner {
  width: 26px;
  height: 26px;
}

.ui-alert-title {
  font-size: 17px;
  font-weight: 600;
}

.ui-alert-message {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-label-secondary);
  min-height: 20px;
}

.alert-progress {
  width: 100%;
  margin-top: 18px;
}

.ui-progress-fill.is-completed {
  background: var(--ui-green);
}

.ui-progress-fill.is-error {
  background: var(--ui-red);
}

.ui-progress-fill.is-returned {
  background: var(--ui-orange);
}

.ui-progress-fill.is-partial {
  background: var(--ui-orange);
}

.alert-progress-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-label-secondary);
}

.alert-details {
  width: 100%;
  margin-top: 16px;
  border: 1px solid var(--ui-separator);
  border-radius: 8px;
  background: #f8fcfa;
  overflow: hidden;
}

.alert-detail-item {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 12px;
  font-size: 13px;
  position: relative;
}

.alert-detail-item + .alert-detail-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 0;
  height: 1px;
  background: var(--ui-separator);
  transform: scaleY(0.5);
}

.alert-detail-item span {
  color: var(--ui-label-secondary);
  flex-shrink: 0;
}

.alert-detail-item strong {
  font-weight: 600;
  text-align: right;
  word-break: break-all;
}

.alert-copy-button {
  width: 100%;
  margin-top: 12px;
}

.alert-poll-error {
  width: 100%;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff8ed;
  color: #995f12;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
}

.alert-poll-error.is-returned {
  background: #fff8ed;
  color: #995f12;
  text-align: center;
}

.ui-alert-action {
  width: 100%;
  min-height: 46px;
  border: none;
  border-top: 1px solid var(--ui-separator);
  background: transparent;
  color: var(--ui-blue);
  font-size: 17px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ui-alert-action:active {
  background: #eef6f2;
}

@media (max-width: 600px) {
  .alert-overlay {
    padding: 14px;
  }

  .button-group {
    flex-direction: column;
  }
}
</style>
