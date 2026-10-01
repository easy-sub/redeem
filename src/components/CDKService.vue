<template>
  <div class="cdk-service">
    <div class="subpage-nav">
      <button type="button" class="subpage-back-button" @click="$emit('back')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>返回兑换</span>
      </button>
    </div>

    <div class="service-switch" role="tablist" aria-label="查询订单或调换 CDK">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'query'"
        :class="{ active: activeTab === 'query' }"
        @click="activeTab = 'query'"
      >
        查询订单
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'refresh'"
        :class="{ active: activeTab === 'refresh' }"
        @click="activeTab = 'refresh'"
      >
        调换卡密
      </button>
    </div>

    <OrderQuery v-show="activeTab === 'query'" embedded />
    <CDKRefresh v-show="activeTab === 'refresh'" />
  </div>
</template>

<script>
import OrderQuery from './OrderQuery'
import CDKRefresh from './CDKRefresh'

export default {
  name: 'CDKService',
  components: {
    OrderQuery,
    CDKRefresh
  },
  emits: ['back'],
  data() {
    return {
      activeTab: 'query'
    }
  }
}
</script>

<style scoped>
.service-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin: 0 0 14px;
  padding: 4px;
  border: 1px solid rgba(220, 233, 227, 0.94);
  border-radius: 14px;
  background: rgba(238, 246, 242, 0.9);
  box-shadow: 0 6px 18px rgba(39, 72, 57, 0.05);
}

.service-switch button {
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-label-secondary);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.service-switch button.active {
  background: var(--ui-card);
  color: var(--ui-blue);
  box-shadow: 0 5px 14px rgba(39, 72, 57, 0.1);
}

.service-switch button:focus-visible {
  outline: 3px solid rgba(47, 115, 217, 0.22);
  outline-offset: 1px;
}
</style>
