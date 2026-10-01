<template>
  <div class="progress-bar">
    <div class="progress-line">
      <div
        class="progress-fill"
        :style="{ width: progressWidth }"
      ></div>
    </div>
    <div class="progress-steps">
      <div
        v-for="(step, index) in steps"
        :key="index"
        class="progress-step"
        :class="{
          active: currentStep >= index,
          completed: currentStep > index
        }"
      >
        <div class="step-circle">
          <span v-if="currentStep > index" class="check-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <span class="step-label">{{ step }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProgressBar',
  props: {
    currentStep: {
      type: Number,
      default: 0
    },
    steps: {
      type: Array,
      default: () => ['校验 CDK', '校验账号', '确认兑换']
    }
  },
  computed: {
    progressWidth() {
      if (this.currentStep <= 0) return '0%'
      const progress = (this.currentStep / (this.steps.length - 1)) * 100
      return `${Math.min(progress, 100)}%`
    }
  }
}
</script>

<style scoped>
.progress-bar {
  position: relative;
  width: min(820px, 100%);
  margin: 0 auto;
  padding: 18px 8px 12px;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: 2;
}

.progress-step {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  flex: 1;
}

.step-circle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--ui-card);
  border: 1px solid var(--ui-separator);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 750;
  color: var(--ui-label-secondary);
  box-shadow: 0 6px 16px rgba(39, 72, 57, 0.06);
  transition: border-color 0.22s ease, background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease;
}

.progress-step.active .step-circle {
  background: var(--ui-green);
  border-color: var(--ui-green);
  color: #fff;
  box-shadow: 0 10px 22px rgba(31, 157, 114, 0.18);
}

.progress-step.completed .step-circle {
  background: #e6f5ee;
  border-color: rgba(31, 157, 114, 0.28);
  color: var(--ui-green);
  box-shadow: 0 6px 16px rgba(31, 157, 114, 0.1);
}

.check-icon {
  display: flex;
}

.check-icon svg {
  width: 17px;
  height: 17px;
}

.step-label {
  max-width: 100%;
  font-size: 13px;
  font-weight: 700;
  color: var(--ui-label-tertiary);
  transition: color 0.22s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-step.active .step-label {
  color: var(--ui-label);
}

.progress-step.completed .step-label {
  color: var(--ui-green);
}

.progress-line {
  position: absolute;
  top: 35px;
  left: calc(8px + 16.66%);
  right: calc(8px + 16.66%);
  height: 3px;
  background: #e2ece7;
  border-radius: 100px;
  z-index: 1;
}

.progress-fill {
  height: 100%;
  background: var(--ui-green);
  border-radius: inherit;
  transition: width 0.35s ease;
}

@media (max-width: 600px) {
  .progress-bar {
    padding: 16px 4px 8px;
  }

  .step-circle {
    width: 30px;
    height: 30px;
    font-size: 13px;
  }

  .progress-line {
    top: 31px;
    left: calc(4px + 16.66%);
    right: calc(4px + 16.66%);
    background: #e2ece7;
  }

  .step-label {
    font-size: 11px;
    color: var(--ui-label-tertiary);
  }

  .progress-step.active .step-label {
    color: var(--ui-label);
  }

  .progress-step.completed .step-label {
    color: var(--ui-green);
  }
}
</style>
