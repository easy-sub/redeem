<template>
  <div class="app-container" :class="providerThemeClass">
    <ClientAnnouncements />

    <main class="content-wrapper">
      <header class="hero-header">
        <div class="brand-row">
          <div class="brand-mark" aria-hidden="true">
            <img :src="siteLogoUrl" alt="" />
          </div>
          <div class="brand-copy">
            <strong>{{ siteBrandName }}</strong>
            <span v-if="siteSubtitle">{{ siteSubtitle }}</span>
          </div>
          <div v-if="isExchangeMode" class="header-actions">
            <button v-if="tutorialUrl" type="button" class="header-action-button" aria-label="视频教程" title="视频教程" @click="openTutorial">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <polygon points="8 5 19 12 8 19 8 5"></polygon>
              </svg>
              <span>视频教程</span>
            </button>
            <button type="button" class="header-action-button" aria-label="Token 查询" title="Token 查询" @click="switchToTokenQuery">
              <ScanSearch :size="16" aria-hidden="true" />
              <span>Token 查询</span>
            </button>
            <button type="button" class="header-action-button" aria-label="查询或调换" title="查询或调换" @click="switchToQuery">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <span>查询/调换</span>
            </button>
            <button type="button" class="header-action-button" aria-label="查看账单" title="查看账单" @click="switchToBilling">
              <ReceiptText :size="16" aria-hidden="true" />
              <span>查看账单</span>
            </button>
          </div>
        </div>

        <section class="hero-layout">
          <div class="hero-copy">
            <h1 class="nav-large-title">
              <span>{{ heroTitle }}</span>
              <span>{{ heroAction }}</span>
            </h1>
            <p class="nav-subtitle">{{ providerSubtitle }}</p>
            <div class="hero-trust-badges" aria-label="服务保障">
              <div class="hero-trust-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                  <path d="M12 3 5 6v5c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V6l-7-3Z"></path>
                  <path d="m9.5 12 1.7 1.7 3.3-3.7"></path>
                </svg>
                <span>官方渠道</span>
              </div>
              <div class="hero-trust-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                  <path d="M12 3 5 6v5c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V6l-7-3Z"></path>
                  <path d="m9.5 12 1.7 1.7 3.3-3.7"></path>
                </svg>
                <span>极速到账</span>
              </div>
              <div class="hero-trust-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                  <path d="M12 3 5 6v5c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V6l-7-3Z"></path>
                  <path d="m9.5 12 1.7 1.7 3.3-3.7"></path>
                </svg>
                <span>失败可退</span>
              </div>
            </div>
          </div>
        </section>
      </header>

      <section
        class="workflow-section"
        :class="{ 'workflow-section-wide': isTokenQueryMode || isBillingMode || isQueryMode }"
      >
        <div v-if="isExchangeMode" class="provider-switch-row">
          <div class="provider-switch" aria-label="选择兑换服务">
            <button
              type="button"
              :class="{ active: providerMode === 'openai' }"
              :aria-pressed="providerMode === 'openai'"
              @click="switchProviderMode('openai')"
            >
              ChatGPT
            </button>
            <button
              type="button"
              :class="{ active: providerMode === 'claude' }"
              :aria-pressed="providerMode === 'claude'"
              @click="switchProviderMode('claude')"
            >
              Claude
            </button>
            <button
              type="button"
              :class="{ active: providerMode === 'grok' }"
              :aria-pressed="providerMode === 'grok'"
              @click="switchProviderMode('grok')"
            >
              Grok
            </button>
          </div>
        </div>

        <ProgressBar v-if="isExchangeMode" :currentStep="currentStep" />

        <div class="steps-container">
          <transition name="slide-fade" mode="out-in">
            <BillingQuery
              v-if="isBillingMode"
              @back="switchToExchange"
            />
            <TokenQuery
              v-else-if="isTokenQueryMode"
              @back="switchToExchange"
            />
            <CDKService
              v-else-if="isQueryMode"
              @back="switchToExchange"
            />
            <StepCard
              v-else-if="currentStep === 0"
              :provider="providerMode"
              :card-code="cardData.cardCode"
              :request-nonce="requestNonce"
              @validating="cancelRedeemRestore"
              @validated="handleCardValidated"
            />
            <StepToken
              v-else-if="currentStep === 1"
              :provider="providerMode"
              :card-code="cardData.cardCode"
              :card-info="cardData.cardInfo"
              :request-nonce="requestNonce"
              @card-verified="handleCardReverified"
              @validated="handleTokenValidated"
            />
            <StepOrder
              v-else-if="currentStep === 2"
              :provider="providerMode"
              :cardCode="cardData.cardCode"
              :token="tokenData.token"
              :cardInfo="cardData.cardInfo"
              :request-nonce="requestNonce"
              @card-verified="handleCardReverified"
              :tokenInfo="tokenData.tokenInfo"
              :initial-order="orderData"
              @submitting="handleOrderSubmitting"
              @submit-failed="handleOrderSubmitFailed"
              @completed="handleOrderCompleted"
              @reset="resetAll"
              @prev="prevStep"
            />
          </transition>
        </div>

        <div v-if="isExchangeMode && currentStep > 0 && currentStep <= 2 && !orderCompleted" class="nav-buttons">
          <button @click="prevStep" class="btn-plain flow-back-button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span>上一步</span>
          </button>
        </div>
      </section>

      <aside v-if="isExchangeMode" class="help-row">
        <span>已兑换但权益未更新？先刷新或重新登录。</span>
        <button type="button" class="btn-plain" @click="openHelp">查看说明</button>
      </aside>
      <footer v-if="siteCopyright" class="site-footer">{{ siteCopyright }}</footer>
    </main>

    <div
      v-if="tutorialOpen && tutorialUrl"
      class="video-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="videoTutorialTitle"
      @click.self="closeTutorial"
    >
      <div class="video-modal-panel">
        <div class="video-modal-header">
          <h2 id="videoTutorialTitle">视频教程</h2>
          <button ref="tutorialClose" type="button" class="video-modal-close" aria-label="关闭视频教程" @click="closeTutorial">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="video-frame">
          <video
            ref="tutorialVideo"
            :title="`${siteBrandName} 视频教程`"
            controls
            controlsList="nodownload"
            playsinline
            preload="none"
            @contextmenu.prevent
          >
            <source :src="tutorialUrl" type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
    <div v-if="helpOpen" class="video-modal" role="dialog" aria-modal="true" aria-labelledby="helpTitle" @click.self="closeHelp">
      <section class="video-modal-panel help-modal-panel">
        <div class="video-modal-header">
          <h2 id="helpTitle">兑换后如何查看权益？</h2>
          <button ref="helpClose" type="button" class="video-modal-close" aria-label="关闭说明" @click="closeHelp">×</button>
        </div>
        <div class="help-modal-body">
          <p>兑换成功后，请刷新页面，或退出后重新登录账号，查看最新订阅权益。</p>
          <p>你可以在「查询 / 调换」中查看订单状态。订单处理期间请保持目标账号的登录状态，并耐心等待结果。</p>
          <button type="button" class="btn-filled" @click="closeHelp">知道了</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import ProgressBar from './components/ProgressBar'
import StepCard from './components/StepCard'
import StepToken from './components/StepToken'
import StepOrder from './components/StepOrder'
import CDKService from './components/CDKService'
import BillingQuery from './components/BillingQuery'
import TokenQuery from './components/TokenQuery'
import ClientAnnouncements from './components/ClientAnnouncementBroadcast'
import { ReceiptText, ScanSearch } from '@lucide/vue'
import { queryOrderByCard, queryRedeemResult, validateCard } from './services/api'
import { clearRedeemFlow, createRequestNonce, readRedeemFlow, writeRedeemFlow } from './utils/redeemFlow'
import { siteConfig } from './config/site'

const PROVIDER_STORAGE_KEY = 'redeem.client.provider'

const readInitialViewMode = () => {
  if (typeof window === 'undefined') return 'exchange'
  if (window.location.pathname === '/billing') return 'billing'
  if (window.location.pathname === '/token-query') return 'token-query'
  if (new URLSearchParams(window.location.search).get('view') === 'query') return 'query'
  return 'exchange'
}

const normalizeProviderMode = (provider) => {
  const value = String(provider || '').trim().toLowerCase()
  return ['openai', 'claude', 'grok'].includes(value) ? value : 'openai'
}

const readStoredProviderMode = () => {
  if (typeof window === 'undefined') return 'openai'
  try {
    return normalizeProviderMode(window.localStorage.getItem(PROVIDER_STORAGE_KEY))
  } catch (error) {
    return 'openai'
  }
}

const writeStoredProviderMode = (provider) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PROVIDER_STORAGE_KEY, normalizeProviderMode(provider))
  } catch (error) {
    // 隐私模式下存储可能受限，仍允许切换服务。
  }
}

export default {
  name: 'App',
  components: {
    ProgressBar,
    StepCard,
    StepToken,
    StepOrder,
    CDKService,
    BillingQuery,
    TokenQuery,
    ClientAnnouncements,
    ReceiptText,
    ScanSearch
  },
  data() {
    return {
      siteBrandName: siteConfig.brandName,
      siteSubtitle: siteConfig.subtitle?.trim() || '',
      siteLogoUrl: siteConfig.logoUrl?.trim() || '/icon.svg',
      tutorialUrl: siteConfig.tutorialUrl?.trim() || '',
      siteCopyright: siteConfig.copyright?.trim() || '',
      currentStep: 0,
      requestNonce: createRequestNonce(),
      restoreVersion: 0,
      providerMode: readStoredProviderMode(),
      viewMode: readInitialViewMode(),
      cardData: {
        cardCode: '',
        cardInfo: null
      },
      tokenData: {
        token: '',
        tokenInfo: null
      },
      orderData: null,
      orderCompleted: false,
      tutorialOpen: false,
      helpOpen: false,
      dialogTrigger: null
    }
  },
  computed: {
    providerThemeClass() {
      return this.isBillingMode || this.isTokenQueryMode ? 'provider-openai' : `provider-${this.providerMode}`
    },
    isExchangeMode() {
      return this.viewMode === 'exchange'
    },
    isQueryMode() {
      return this.viewMode === 'query'
    },
    isBillingMode() {
      return this.viewMode === 'billing'
    },
    isTokenQueryMode() {
      return this.viewMode === 'token-query'
    },
    providerTitle() {
      return { openai: 'ChatGPT', claude: 'Claude', grok: 'Grok' }[this.providerMode]
    },
    heroTitle() {
      return this.isBillingMode || this.isTokenQueryMode ? 'ChatGPT' : this.providerTitle
    },
    heroAction() {
      if (this.isBillingMode) return '账单查询'
      if (this.isTokenQueryMode) return 'Token 查询'
      return '订阅兑换'
    },
    providerSubtitle() {
      if (this.isBillingMode) return '查询当前订阅、支付方式和最近账单'
      if (this.isTokenQueryMode) return '查询账号套餐、订阅状态、续费信息等'
      return 'CDK 校验、账号确认、订阅提交，充值时间约 15 秒－1 分钟'
    }
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeydown)
    window.addEventListener('popstate', this.handlePopState)
    this.restoreRedeemFlow()
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeydown)
    window.removeEventListener('popstate', this.handlePopState)
    document.body.style.overflow = ''
  },
  methods: {
    handleCardValidated(data) {
      this.restoreVersion++
      this.cardData = {
        cardCode: data.cardCode,
        cardInfo: data.cardInfo
      }
      this.currentStep = 1
      this.persistRedeemFlow('reserved')
    },
    cancelRedeemRestore() {
      this.restoreVersion++
    },
    handleCardReverified(cardInfo) {
      this.cardData = { ...this.cardData, cardInfo }
      this.persistRedeemFlow(this.currentStep === 2 ? 'submitting' : 'reserved')
    },
    handleTokenValidated(data) {
      this.tokenData = {
        token: data.token,
        tokenInfo: data.tokenInfo
      }
      this.currentStep = 2
      this.persistRedeemFlow('account_validated')
    },
    handleOrderSubmitting() {
      this.persistRedeemFlow('submitting')
    },
    handleOrderSubmitFailed() {
      this.persistRedeemFlow('account_validated')
    },
    handleOrderCompleted(data) {
      this.orderData = data
      this.orderCompleted = true
      this.persistRedeemFlow('ordered')
    },
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--
      }
    },
    resetAll() {
      this.restoreVersion++
      clearRedeemFlow()
      this.requestNonce = createRequestNonce()
      this.currentStep = 0
      this.cardData = { cardCode: '', cardInfo: null }
      this.tokenData = { token: '', tokenInfo: null }
      this.orderData = null
      this.orderCompleted = false
    },
    persistRedeemFlow(state) {
      if (!this.requestNonce || !this.cardData.cardCode || !this.cardData.cardInfo) return
      writeRedeemFlow({
        state,
        requestNonce: this.requestNonce,
        provider: this.providerMode,
        cdk: this.cardData.cardCode,
        cardInfo: this.cardData.cardInfo,
        expiresAt: this.cardData.cardInfo.expiresAt || '',
        orderData: state === 'ordered' ? this.orderData : null,
        orderQueryToken: state === 'ordered' && this.orderData ? this.orderData.orderQueryToken || '' : ''
      })
    },
    async restoreRedeemFlow() {
      const flow = readRedeemFlow()
      if (!flow || !flow.requestNonce || !flow.cdk) return

      const restoreVersion = ++this.restoreVersion
      const restoreIsCurrent = () => (
        this.restoreVersion === restoreVersion && this.requestNonce === flow.requestNonce
      )

      const provider = normalizeProviderMode(flow.provider)
      this.providerMode = provider
      writeStoredProviderMode(provider)
      this.requestNonce = flow.requestNonce

      if (flow.state === 'ordered' && flow.orderData) {
        this.cardData = { cardCode: flow.cdk, cardInfo: flow.cardInfo || null }
        this.orderData = flow.orderData
        this.orderCompleted = true
        this.currentStep = 2
        return
      }

      if (flow.state === 'submitting') {
        const activationToken = flow.cardInfo && flow.cardInfo.activationToken
        const recovered = flow.orderQueryToken
          ? await queryRedeemResult(flow.orderQueryToken, flow.cdk)
          : activationToken
            ? await queryOrderByCard(flow.cdk, activationToken)
            : null
        if (!restoreIsCurrent()) return
        if (recovered && recovered.code === 200 && recovered.data) {
          this.cardData = { cardCode: flow.cdk, cardInfo: flow.cardInfo || null }
          this.orderData = recovered.data
          this.orderCompleted = true
          this.currentStep = 2
          this.persistRedeemFlow('ordered')
          return
        }
        if (recovered && recovered.retryable) {
          this.cardData = { cardCode: flow.cdk, cardInfo: null }
          this.currentStep = 0
          return
        }
      }

      const verified = await validateCard(flow.cdk, provider, flow.requestNonce)
      if (!restoreIsCurrent()) return
      if (verified.code === 200) {
        this.cardData = { cardCode: flow.cdk, cardInfo: verified.data }
        this.currentStep = 1
        this.persistRedeemFlow('reserved')
        return
      }

      if (verified.retryable) {
        this.cardData = { cardCode: flow.cdk, cardInfo: null }
        this.currentStep = 0
        return
      }

      clearRedeemFlow()
      this.requestNonce = createRequestNonce()
    },
    switchProviderMode(provider) {
      const nextProvider = normalizeProviderMode(provider)
      if (this.providerMode === nextProvider) {
        this.switchToExchange()
        return
      }
      if (window.location.pathname !== '/' || window.location.search) window.history.pushState({ view: 'exchange' }, '', '/')
      this.viewMode = 'exchange'
      this.providerMode = nextProvider
      writeStoredProviderMode(nextProvider)
      this.resetAll()
    },
    switchToQuery() {
      this.viewMode = 'query'
      window.history.pushState({ view: 'query' }, '', '/?view=query')
    },
    switchToBilling() {
      this.viewMode = 'billing'
      window.history.pushState({ view: 'billing' }, '', '/billing')
    },
    switchToTokenQuery() {
      this.viewMode = 'token-query'
      window.history.pushState({ view: 'token-query' }, '', '/token-query')
    },
    switchToExchange() {
      if (window.location.pathname !== '/' || window.location.search) {
        window.history.pushState({ view: 'exchange' }, '', '/')
      }
      this.viewMode = 'exchange'
      this.currentStep = 0
    },
    openTutorial() {
      if (!this.tutorialUrl) return
      this.dialogTrigger = document.activeElement
      this.helpOpen = false
      this.tutorialOpen = true
      this.$nextTick(() => this.$refs.tutorialClose?.focus())
      document.body.style.overflow = 'hidden'
    },
    closeTutorial() {
      this.$refs.tutorialVideo?.pause()
      this.tutorialOpen = false
      document.body.style.overflow = ''
      this.dialogTrigger?.focus()
    },
    openHelp() {
      this.dialogTrigger = document.activeElement
      this.tutorialOpen = false
      this.$refs.tutorialVideo?.pause()
      this.helpOpen = true
      document.body.style.overflow = 'hidden'
      this.$nextTick(() => this.$refs.helpClose?.focus())
    },
    closeHelp() {
      this.helpOpen = false
      document.body.style.overflow = ''
      this.dialogTrigger?.focus()
    },
    handleKeydown(event) {
      if (event.key === 'Escape') {
        if (this.tutorialOpen) this.closeTutorial()
        if (this.helpOpen) this.closeHelp()
      }
      if (event.key === 'Tab' && (this.tutorialOpen || this.helpOpen)) {
        const dialog = this.$el.querySelector('[role="dialog"]')
        const controls = [...dialog.querySelectorAll('button, video[controls]')]
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    },
    handlePopState() {
      this.viewMode = readInitialViewMode()
      if (this.viewMode === 'exchange') {
        this.currentStep = 0
      }
    }
  }
}
</script>

<style>
:root {
  --ui-bg: #f6fbf8;
  --ui-card: #ffffff;
  --ui-fill: #eef6f2;
  --ui-separator: #d9e7e0;
  --ui-label: #17211d;
  --ui-label-secondary: #66746e;
  --ui-label-tertiary: #a0aca7;
  --ui-blue: #2f73d9;
  --ui-green: #1f9d72;
  --ui-red: #dc4c45;
  --ui-orange: #d98a22;
  --ui-yellow: #d7aa2f;
  --ui-purple: #6f63c7;
  --ui-gray: #8a9691;
  --ui-radius-card: 8px;
  --ui-radius-control: 8px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--ui-bg);
  color: var(--ui-label);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC',
    'Helvetica Neue', 'Segoe UI', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-container {
  min-height: 100vh;
  padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom);
}

.content-wrapper {
  max-width: 960px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 32px 0 56px;
}

.ui-card {
  background: var(--ui-card);
  border-radius: var(--ui-radius-card);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.ui-group-footer {
  padding: 8px 18px 0;
  color: var(--ui-label-secondary);
  font-size: 14px;
  line-height: 1.45;
}

.ui-list {
  overflow: hidden;
}

.ui-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 50px;
  padding: 13px 18px;
}

.ui-row + .ui-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 18px;
  right: 0;
  height: 1px;
  background: var(--ui-separator);
  transform: scaleY(0.5);
}

.ui-row-label {
  flex-shrink: 0;
  color: var(--ui-label);
  font-size: 16px;
}

.ui-row-value {
  color: var(--ui-label-secondary);
  font-size: 16px;
  text-align: right;
  word-break: break-all;
}

.ui-input,
.ui-textarea {
  width: 100%;
  padding: 15px 16px;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-control);
  outline: none;
  background: var(--ui-fill);
  color: var(--ui-label);
  font-family: inherit;
  font-size: 17px;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  appearance: none;
}

.ui-textarea {
  resize: none;
  line-height: 1.5;
}

.ui-input::placeholder,
.ui-textarea::placeholder {
  color: var(--ui-label-tertiary);
}

.ui-input:focus,
.ui-textarea:focus {
  border-color: var(--ui-blue);
  background: var(--ui-card);
  box-shadow: 0 0 0 3px rgba(47, 115, 217, 0.15);
}

.ui-input.has-error,
.ui-textarea.has-error {
  border-color: var(--ui-red);
  box-shadow: 0 0 0 3px rgba(220, 76, 69, 0.12);
}

.btn-filled,
.btn-gray,
.btn-tinted,
.btn-plain,
.header-action-button,
.subpage-back-button,
.product-card {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-weight: 600;
  transition: opacity 0.15s ease, transform 0.1s ease, background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.btn-filled {
  width: 100%;
  min-height: 54px;
  padding: 0 20px;
  border-radius: var(--ui-radius-control);
  background: var(--ui-blue);
  color: #fff;
  font-size: 18px;
}

.btn-filled.btn-destructive {
  background: var(--ui-red);
}

.btn-filled:active:not(:disabled),
.btn-gray:active,
.btn-tinted:active {
  opacity: 0.72;
}

.btn-filled:disabled {
  background: rgba(47, 115, 217, 0.35);
  cursor: not-allowed;
}

.btn-filled.btn-destructive:disabled {
  background: rgba(220, 76, 69, 0.35);
}

.btn-gray {
  width: 100%;
  min-height: 54px;
  padding: 0 20px;
  border-radius: var(--ui-radius-control);
  background: var(--ui-fill);
  color: var(--ui-blue);
  font-size: 18px;
}

.btn-tinted {
  padding: 10px 18px;
  border-radius: var(--ui-radius-control);
  background: rgba(47, 115, 217, 0.12);
  color: var(--ui-blue);
  font-size: 15px;
}

.btn-tinted svg {
  width: 15px;
  height: 15px;
}

.btn-plain {
  background: none;
  color: var(--ui-blue);
  font-size: 17px;
  font-weight: 400;
  padding: 8px 12px;
}

.btn-plain svg {
  width: 18px;
  height: 18px;
  margin-left: -6px;
}

.ui-spinner {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 40deg, currentColor 320deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
  animation: ui-spin 0.8s linear infinite;
}

@keyframes ui-spin {
  to {
    transform: rotate(360deg);
  }
}

.ui-progress-track {
  height: 5px;
  border-radius: 100px;
  background: #e2ece7;
  overflow: hidden;
}

.ui-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--ui-blue);
  transition: width 0.25s ease;
}

.ui-callout {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 15px 16px;
  border-radius: var(--ui-radius-control);
  font-size: 14px;
  line-height: 1.55;
}

.ui-callout svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.ui-callout.is-info {
  background: #eef5ff;
  color: #245fba;
}

.ui-callout.is-warning {
  background: #fff8ed;
  color: #995f12;
}

.ui-callout.is-danger {
  background: #fff2f1;
  color: #b83b35;
}

.ui-callout-title {
  margin-bottom: 3px;
  font-size: 15px;
  font-weight: 600;
}

.ui-error-text {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: var(--ui-red);
  font-size: 13px;
}

.ui-error-text svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.status-pending { color: var(--ui-orange) !important; }
.status-processing { color: var(--ui-blue) !important; }
.status-completed { color: var(--ui-green) !important; }
.status-partial { color: var(--ui-orange) !important; }
.status-error { color: var(--ui-red) !important; }
.status-returned { color: var(--ui-purple) !important; }
.status-retrying { color: var(--ui-orange) !important; }
.status-canceled,
.status-unknown { color: var(--ui-gray) !important; }
.status-available { color: var(--ui-green) !important; }
.status-used { color: var(--ui-orange) !important; }
.status-unavailable { color: var(--ui-red) !important; }

.nav-buttons {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.site-footer {
  margin-top: auto;
  padding: 10px 0 4px;
  text-align: center;
  color: var(--ui-label-secondary);
  font-size: 13px;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.slide-fade-enter,
.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

@media (max-width: 600px) {
  .app-container {
    padding-left: 14px;
    padding-right: 14px;
  }

  .content-wrapper {
    padding: 10px 0 24px;
  }

  .ui-group-footer {
    padding: 7px 16px 0;
    font-size: 13px;
  }

  .ui-row {
    min-height: 46px;
    padding: 12px 16px;
  }

  .ui-row + .ui-row::before {
    left: 16px;
  }

  .ui-row-label,
  .ui-row-value {
    font-size: 15px;
  }

  .ui-input,
  .ui-textarea {
    padding: 13px 14px;
    font-size: 16px;
  }

  .btn-filled,
  .btn-gray {
    min-height: 50px;
    font-size: 17px;
    border-radius: var(--ui-radius-control);
  }

  .ui-callout {
    padding: 13px 14px;
    font-size: 13px;
  }
}
</style>
