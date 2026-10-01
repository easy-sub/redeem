<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BellRing, Megaphone, Pin } from '@lucide/vue'
import { getClientAnnouncements } from '../services/api'

const ROTATION_INTERVAL = 6_500

const announcements = ref([])
const activeIndex = ref(0)
const isPaused = ref(false)
const isOpen = ref(false)
const prefersReducedMotion = ref(false)
const announcementCenterRef = ref(null)
let refreshTimer = null
let rotationTimer = null
let motionMediaQuery = null

const visibleAnnouncements = computed(() => announcements.value.slice(0, 5))
const activeAnnouncement = computed(() => visibleAnnouncements.value[activeIndex.value] || null)
const announcementSignature = computed(() => JSON.stringify(visibleAnnouncements.value.map((item) => [
  item.id,
  item.title,
  item.content,
  item.level,
  item.is_pinned,
])))
const levelLabel = (level) => ({
  important: '重要',
  urgent: '紧急',
}[level] || '')

const stopRotation = () => {
  if (rotationTimer) window.clearTimeout(rotationTimer)
  rotationTimer = null
}

const scheduleRotation = () => {
  stopRotation()
  if (visibleAnnouncements.value.length < 2 || isPaused.value || isOpen.value || prefersReducedMotion.value) return

  rotationTimer = window.setTimeout(() => {
    activeIndex.value = (activeIndex.value + 1) % visibleAnnouncements.value.length
  }, ROTATION_INTERVAL)
}

const moveTo = (offset) => {
  const count = visibleAnnouncements.value.length
  if (count < 2) return
  activeIndex.value = (activeIndex.value + offset + count) % count
}

const setPaused = (paused) => {
  isPaused.value = paused
}

const togglePanel = () => {
  isOpen.value = !isOpen.value
}

const selectAnnouncement = (index) => {
  activeIndex.value = index
  isOpen.value = true
}

const refresh = async () => {
  announcements.value = await getClientAnnouncements()
}

const refreshWhenVisible = () => {
  if (document.visibilityState === 'visible') {
    void refresh()
    scheduleRotation()
  } else {
    stopRotation()
  }
}

const handleMotionPreference = (event) => {
  prefersReducedMotion.value = event.matches
}

const handleDocumentClick = (event) => {
  if (!isOpen.value || !announcementCenterRef.value) return
  if (!announcementCenterRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

watch(announcementSignature, () => {
  activeIndex.value = 0
  scheduleRotation()
})

watch(activeIndex, scheduleRotation)

watch([isPaused, isOpen, prefersReducedMotion], scheduleRotation)

onMounted(() => {
  motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = motionMediaQuery.matches
  motionMediaQuery.addEventListener?.('change', handleMotionPreference)
  document.addEventListener('click', handleDocumentClick)

  void refresh()
  refreshTimer = window.setInterval(refresh, 60_000)
  document.addEventListener('visibilitychange', refreshWhenVisible)
})

onBeforeUnmount(() => {
  stopRotation()
  if (refreshTimer) window.clearInterval(refreshTimer)
  motionMediaQuery?.removeEventListener?.('change', handleMotionPreference)
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
})
</script>

<template>
  <div
    v-if="activeAnnouncement"
    ref="announcementCenterRef"
    class="announcement-center"
    :class="{ 'is-open': isOpen }"
    @mouseenter="setPaused(true)"
    @mouseleave="setPaused(false)"
  >
    <button
      type="button"
      class="announcement-trigger"
      aria-label="打开公告通知"
      :aria-expanded="isOpen"
      @click="togglePanel"
    >
      <BellRing :size="19" aria-hidden="true" />
      <span v-if="visibleAnnouncements.length" class="announcement-badge">{{ visibleAnnouncements.length }}</span>
    </button>

    <section v-if="isOpen" class="announcement-panel" aria-label="平台公告" aria-live="polite">
      <header class="announcement-panel-header">
        <div>
          <strong>公告通知</strong>
          <span>{{ visibleAnnouncements.length }} 条</span>
        </div>
        <button type="button" class="announcement-panel-nav" aria-label="关闭公告通知" @click="isOpen = false">×</button>
      </header>
      <div class="announcement-list">
        <button
          v-for="(item, index) in visibleAnnouncements"
          :key="item.id"
          type="button"
          class="announcement-item"
          :class="[`is-${item.level}`, { 'is-active': index === activeIndex }]"
          @click="selectAnnouncement(index)"
        >
          <span class="announcement-item-icon" aria-hidden="true"><Megaphone :size="15" /></span>
          <span class="announcement-item-body">
            <span class="announcement-item-title">
              <span v-if="levelLabel(item.level)" class="broadcast-level">{{ levelLabel(item.level) }}</span>
              <Pin v-if="item.is_pinned" :size="12" aria-label="置顶" />
              <strong>{{ item.title }}</strong>
            </span>
            <span class="announcement-item-content">{{ item.content }}</span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.announcement-center {
  position: fixed;
  z-index: 80;
  top: 22px;
  right: max(38px, env(safe-area-inset-right));
  width: 38px;
  height: 38px;
}

.announcement-trigger {
  position: relative;
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(31, 157, 114, 0.2);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.88);
  color: #267a61;
  box-shadow: 0 8px 20px rgba(39, 72, 57, 0.12);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition: background 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.announcement-trigger svg {
  transform-origin: 50% 12%;
  animation: bell-attention 2.8s ease-in-out infinite;
}

.announcement-trigger::before {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1px solid rgba(38, 122, 97, 0.22);
  border-radius: 50%;
  opacity: 0;
  animation: bell-ripple 2.8s ease-out infinite;
  pointer-events: none;
}

.announcement-trigger:hover,
.announcement-trigger:focus-visible {
  background: #fff;
  box-shadow: 0 10px 24px rgba(39, 72, 57, 0.18);
  outline: none;
  transform: translateY(-1px);
}

.announcement-center.is-open .announcement-trigger svg,
.announcement-center.is-open .announcement-trigger::before,
.announcement-center.is-open .announcement-badge {
  animation-play-state: paused;
}

.announcement-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  display: inline-flex;
  min-width: 17px;
  height: 17px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid #f3faf6;
  border-radius: 10px;
  background: #d97757;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  animation: badge-pulse 2.8s ease-in-out infinite;
}

.announcement-panel {
  position: absolute;
  top: 46px;
  right: 0;
  width: min(360px, calc(100vw - 24px));
  overflow: hidden;
  border: 1px solid rgba(31, 157, 114, 0.16);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 42px rgba(39, 72, 57, 0.18);
  backdrop-filter: blur(18px);
  animation: panel-arrive 180ms ease-out both;
}

.announcement-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 13px;
}

.announcement-panel-header {
  border-bottom: 1px solid #e5eee9;
}

.announcement-panel-header > div {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.announcement-panel-header strong {
  color: #17211d;
  font-size: 14px;
}

.announcement-panel-header span {
  color: #8a9891;
  font-size: 11px;
}

.announcement-panel-nav {
  border: 0;
  background: transparent;
  color: #8a9891;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.announcement-list {
  max-height: min(360px, 50vh);
  overflow-y: auto;
  padding: 5px;
}

.announcement-item {
  display: flex;
  width: 100%;
  gap: 9px;
  padding: 10px 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.announcement-item:hover,
.announcement-item.is-active {
  background: #f1f8f4;
}

.announcement-item-icon {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e6f5ee;
  color: #267a61;
}

.announcement-item.is-important .announcement-item-icon { background: #fff3df; color: #b36b19; }
.announcement-item.is-urgent .announcement-item-icon { background: #fdeceb; color: #bd3e38; }

.announcement-item-body { min-width: 0; }

.announcement-item-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
}

.announcement-item-title strong {
  min-width: 0;
  overflow: hidden;
  color: #17211d;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.announcement-item-content {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: #66746e;
  font-size: 11px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes panel-arrive {
  from { opacity: 0; transform: translateY(-5px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes bell-attention {
  0%, 36%, 100% { transform: rotate(0); }
  42% { transform: rotate(-13deg); }
  48% { transform: rotate(11deg); }
  54% { transform: rotate(-7deg); }
  60% { transform: rotate(4deg); }
  66% { transform: rotate(0); }
}

@keyframes bell-ripple {
  0%, 36%, 100% { opacity: 0; transform: scale(0.92); }
  44% { opacity: 0.55; }
  78% { opacity: 0; transform: scale(1.28); }
}

@keyframes badge-pulse {
  0%, 40%, 100% { transform: scale(1); }
  52% { transform: scale(1.12); }
  64% { transform: scale(1); }
}

.announcement-broadcast {
  position: fixed;
  z-index: 80;
  pointer-events: auto;
  right: max(18px, env(safe-area-inset-right));
  bottom: max(18px, env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  width: min(440px, calc(100vw - 32px));
  min-height: 46px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 24px;
  outline: none;
  background: rgba(23, 31, 28, 0.96);
  box-shadow: 0 10px 30px rgba(23, 33, 29, 0.18);
  backdrop-filter: blur(16px);
  transform: translateY(0);
  touch-action: pan-y;
  transition: min-height 280ms ease, border-radius 280ms ease, box-shadow 280ms ease;
  animation: broadcast-arrive 620ms cubic-bezier(0.2, 0.9, 0.35, 1.18) both;
}

.announcement-broadcast.is-expanded {
  min-height: 70px;
  border-radius: 18px;
  box-shadow: 0 14px 36px rgba(23, 33, 29, 0.22);
}

.announcement-broadcast:focus-visible {
  border-color: rgba(103, 200, 167, 0.72);
  box-shadow: 0 0 0 3px rgba(103, 200, 167, 0.16), 0 14px 36px rgba(23, 33, 29, 0.22);
}

.broadcast-icon {
  display: flex;
  width: 28px;
  height: 28px;
  align-self: center;
  align-items: center;
  justify-content: center;
  margin-left: 7px;
  border-radius: 50%;
  background: rgba(79, 190, 151, 0.14);
  color: #7ed7b8;
}

.broadcast-icon svg {
  transform-origin: 50% 20%;
}

.broadcast-message {
  min-width: 0;
  align-self: center;
  padding: 7px 9px 7px 3px;
}

.broadcast-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
}

.broadcast-heading strong {
  min-width: 0;
  overflow: hidden;
  color: #f6faf8;
  font-size: 13px;
  font-weight: 760;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.broadcast-label,
.broadcast-level {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(126, 215, 184, 0.13);
  color: #8ce0c3;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
}

.broadcast-level {
  background: rgba(239, 177, 91, 0.14);
  color: #f0bd75;
}

.broadcast-pin {
  flex: 0 0 auto;
  color: #efbd70;
}

.broadcast-message p {
  display: -webkit-box;
  max-height: 0;
  margin-top: 0;
  overflow: hidden;
  color: #becbc5;
  font-size: 12px;
  line-height: 1.4;
  opacity: 0;
  overflow-wrap: anywhere;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  transition: max-height 260ms ease, margin-top 260ms ease, opacity 180ms ease;
}

.announcement-broadcast.is-expanded .broadcast-message p {
  max-height: 34px;
  margin-top: 4px;
  opacity: 1;
}

.broadcast-position {
  display: flex;
  width: auto;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0 7px 0 0;
  color: #89978f;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.broadcast-position button {
  display: inline-flex;
  width: 22px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #b7c7c0;
  font: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.broadcast-position button:hover,
.broadcast-position button:focus-visible {
  background: rgba(126, 215, 184, 0.14);
  color: #f6faf8;
  outline: none;
}

.announcement-broadcast.is-important {
  border-color: rgba(239, 177, 91, 0.34);
}

.is-important .broadcast-icon {
  background: rgba(239, 177, 91, 0.14);
  color: #efb15b;
}

.announcement-broadcast.is-urgent {
  border-color: rgba(238, 104, 96, 0.42);
}

.is-urgent .broadcast-icon {
  background: rgba(238, 104, 96, 0.15);
  color: #ff8a83;
}

.is-urgent .broadcast-level {
  background: rgba(238, 104, 96, 0.15);
  color: #ff9a94;
}

.announcement-broadcast.is-urgent .broadcast-icon svg {
  animation: urgent-reminder 7s 1.2s ease-in-out infinite;
}

.announcement-slide-enter-active {
  animation: message-arrive 440ms cubic-bezier(0.2, 0.85, 0.3, 1.12);
}

.announcement-slide-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.announcement-slide-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

@keyframes broadcast-arrive {
  0% {
    opacity: 0;
    transform: translateY(18px) scale(0.96);
  }
  72% {
    opacity: 1;
    transform: translateY(-3px) scale(1);
  }
  88% {
    transform: translateY(1px) scale(1);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes message-arrive {
  0% {
    opacity: 0;
    transform: translateX(-24px);
  }
  72% {
    opacity: 1;
    transform: translateX(3px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes urgent-reminder {
  0%, 5%, 10%, 100% { transform: rotate(0); }
  2.5% { transform: rotate(-12deg); }
  7.5% { transform: rotate(10deg); }
}

@media (max-width: 680px) {
  .announcement-center {
    top: 14px;
    right: max(24px, env(safe-area-inset-right));
  }

  .announcement-panel {
    top: 46px;
    right: -2px;
  }

  .announcement-broadcast {
    right: max(12px, env(safe-area-inset-right));
    bottom: max(12px, env(safe-area-inset-bottom));
    grid-template-columns: 40px minmax(0, 1fr) auto;
    width: calc(100vw - 24px);
    min-height: 44px;
  }

  .broadcast-message {
    padding: 6px 7px 6px 3px;
  }

  .broadcast-heading {
    gap: 5px;
  }

  .broadcast-position {
    padding-right: 5px;
  }

  .broadcast-label {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .announcement-trigger svg,
  .announcement-trigger::before,
  .announcement-badge,
  .announcement-broadcast,
  .announcement-broadcast.is-urgent .broadcast-icon svg,
  .announcement-slide-enter-active {
    animation: none;
  }

  .announcement-slide-leave-active {
    transition: none;
  }
}
</style>
